import { ctx2d, makeCanvas, type AnyCanvas } from './kit';

/**
 * Turns an image into an oil-on-canvas painting on the GPU.
 *
 *  1. Structure tensor of the image, smoothed, gives the local edge direction.
 *  2. Anisotropic Kuwahara filter (Kyprianidis et al.) averages colours in
 *     8 elliptic sectors aligned with that direction and keeps the most
 *     uniform ones. Shapes, edges and architecture survive while textures
 *     flatten into brush strokes - the photo stays recognisable.
 *  3. Finishing: brush streaks that follow the strokes (line-integral noise),
 *     canvas weave relief and a gentle colour grade.
 *
 * Runs with an OffscreenCanvas in a worker or a normal canvas on the main
 * thread. The heavy Kuwahara pass is drawn in tiles so slow mobile GPUs
 * never block on one huge draw call.
 */

export interface PainterlyOptions {
  /** Kuwahara radius in px (scale with image size; ~5 at 1920 px). */
  radius: number;
  /** Sector sharpness (8 = classic). */
  q?: number;
  /** Brush streak strength 0..1. */
  strokes?: number;
  /** Canvas weave strength 0..1. */
  weave?: number;
  /** Saturation multiplier. */
  saturation?: number;
  /** Warm (+) / cool (-) shift. */
  warmth?: number;
  /** Brightness multiplier. */
  exposure?: number;
  /** Contrast around mid grey (1 = unchanged). */
  contrast?: number;
}

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float;
precision highp int;
out vec4 o;
uniform vec2 size;
`;

// Structure tensor (Sobel on RGB). Encoded as sqrt-companded values when only
// 8-bit render targets are available.
const SST = `${HEAD}
uniform sampler2D src;
uniform float encode;
vec3 S(vec2 d) { return texture(src, (gl_FragCoord.xy + d) / size).rgb; }
void main() {
  vec3 u = (-1.0 * S(vec2(-1,-1)) - 2.0 * S(vec2(-1,0)) - 1.0 * S(vec2(-1,1))
            + 1.0 * S(vec2(1,-1)) + 2.0 * S(vec2(1,0)) + 1.0 * S(vec2(1,1))) / 4.0;
  vec3 v = (-1.0 * S(vec2(-1,-1)) - 2.0 * S(vec2(0,-1)) - 1.0 * S(vec2(1,-1))
            + 1.0 * S(vec2(-1,1)) + 2.0 * S(vec2(0,1)) + 1.0 * S(vec2(1,1))) / 4.0;
  vec3 g = vec3(dot(u, u), dot(v, v), dot(u, v));
  if (encode > 0.5) g = vec3(sqrt(g.x / 3.0), sqrt(g.y / 3.0), 0.5 + 0.5 * sign(g.z) * sqrt(abs(g.z) / 3.0));
  o = vec4(g, 1.0);
}`;

const GAUSS = `${HEAD}
uniform sampler2D src;
uniform vec2 dir;
uniform float sigma;
uniform float encode;
vec3 dec(vec3 e) {
  if (encode < 0.5) return e;
  float f = (e.z - 0.5) * 2.0;
  return vec3(e.x * e.x * 3.0, e.y * e.y * 3.0, sign(f) * f * f * 3.0);
}
vec3 enc(vec3 g) {
  if (encode < 0.5) return g;
  return vec3(sqrt(max(g.x, 0.0) / 3.0), sqrt(max(g.y, 0.0) / 3.0), 0.5 + 0.5 * sign(g.z) * sqrt(abs(g.z) / 3.0));
}
void main() {
  float twoSigma2 = 2.0 * sigma * sigma;
  int r = int(ceil(2.0 * sigma));
  vec3 sum = vec3(0.0);
  float ws = 0.0;
  for (int i = -r; i <= r; i++) {
    float w = exp(-float(i * i) / twoSigma2);
    sum += w * dec(texture(src, (gl_FragCoord.xy + dir * float(i)) / size).rgb);
    ws += w;
  }
  o = vec4(enc(sum / ws), 1.0);
}`;

// Tangent direction and anisotropy from the smoothed tensor.
const TFM = `${HEAD}
uniform sampler2D src;
uniform float encode;
void main() {
  vec3 e = texture(src, gl_FragCoord.xy / size).rgb;
  vec3 g = e;
  if (encode > 0.5) { float f = (e.z - 0.5) * 2.0; g = vec3(e.x * e.x * 3.0, e.y * e.y * 3.0, sign(f) * f * f * 3.0); }
  float d = sqrt(max(0.0, g.y * g.y - 2.0 * g.x * g.y + g.x * g.x + 4.0 * g.z * g.z));
  float l1 = 0.5 * (g.y + g.x + d);
  float l2 = 0.5 * (g.y + g.x - d);
  vec2 v = vec2(l1 - g.x, -g.z);
  vec2 t = length(v) > 0.0 ? normalize(v) : vec2(0.0, 1.0);
  float A = (l1 + l2 > 0.0) ? (l1 - l2) / (l1 + l2) : 0.0;
  o = vec4(t * 0.5 + 0.5, A, 1.0);
}`;

// Anisotropic Kuwahara with polynomial sector weights (8 sectors).
const AKF = `${HEAD}
uniform sampler2D src;
uniform sampler2D tfm;
uniform float radius;
uniform float q;
const float alpha = 1.0;
void main() {
  vec2 uv = gl_FragCoord.xy / size;
  vec4 m[8];
  vec3 s[8];
  for (int k = 0; k < 8; ++k) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
  vec4 t = texture(tfm, uv);
  vec2 dirv = t.xy * 2.0 - 1.0;
  float A = t.z;
  float a = radius * clamp((alpha + A) / alpha, 0.1, 2.0);
  float b = radius * clamp(alpha / (alpha + A), 0.1, 2.0);
  float cos_phi = dirv.x;
  float sin_phi = dirv.y;
  mat2 SR = mat2(cos_phi / a, -sin_phi / b, sin_phi / a, cos_phi / b);
  int max_x = int(sqrt(a * a * cos_phi * cos_phi + b * b * sin_phi * sin_phi));
  int max_y = int(sqrt(a * a * sin_phi * sin_phi + b * b * cos_phi * cos_phi));
  {
    vec3 c = texture(src, uv).rgb;
    float w = 1.0 / 8.0;
    for (int k = 0; k < 8; ++k) { m[k] += vec4(c * w, w); s[k] += c * c * w; }
  }
  for (int j = 0; j <= max_y; ++j) {
    for (int i = -max_x; i <= max_x; ++i) {
      if ((j != 0) || (i > 0)) {
        vec2 v = SR * vec2(float(i), float(j));
        if (dot(v, v) <= 1.0) {
          vec3 c0 = texture(src, uv + vec2(i, j) / size).rgb;
          vec3 c1 = texture(src, uv - vec2(i, j) / size).rgb;
          vec3 cc0 = c0 * c0;
          vec3 cc1 = c1 * c1;
          float sum = 0.0;
          float w[8];
          float z, vxx, vyy;
          vxx = 0.33 - 3.77 * v.x * v.x;
          vyy = 0.33 - 3.77 * v.y * v.y;
          z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
          z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
          z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
          z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
          v = sqrt(2.0) / 2.0 * vec2(v.x - v.y, v.x + v.y);
          vxx = 0.33 - 3.77 * v.x * v.x;
          vyy = 0.33 - 3.77 * v.y * v.y;
          z = max(0.0, v.y + vxx); w[1] = z * z; sum += w[1];
          z = max(0.0, -v.x + vyy); w[3] = z * z; sum += w[3];
          z = max(0.0, -v.y + vxx); w[5] = z * z; sum += w[5];
          z = max(0.0, v.x + vyy); w[7] = z * z; sum += w[7];
          float g = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
          for (int k = 0; k < 8; ++k) {
            float wk = w[k] * g;
            m[k] += vec4(c0 * wk, wk);
            s[k] += cc0 * wk;
            int k2 = (k + 4) & 7;
            m[k2] += vec4(c1 * wk, wk);
            s[k2] += cc1 * wk;
          }
        }
      }
    }
  }
  vec4 res = vec4(0.0);
  for (int k = 0; k < 8; ++k) {
    vec3 mean = m[k].rgb / m[k].w;
    vec3 var = abs(s[k] / m[k].w - mean * mean);
    float sigma2 = var.r + var.g + var.b;
    float w = 1.0 / (1.0 + pow(255.0 * sigma2, 0.5 * q));
    res += vec4(mean * w, w);
  }
  o = vec4(res.rgb / res.w, 1.0);
}`;

// Brush streaks, canvas weave and grade. Writes to the visible framebuffer,
// flipping vertically so the result reads back upright.
const FINAL = `${HEAD}
uniform sampler2D src;
uniform sampler2D tfm;
uniform float strokes;
uniform float weave;
uniform float saturation;
uniform float warmth;
uniform float exposure;
uniform float contrast;
uniform float strokeW;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 fc = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec2 uv = fc / size;
  vec3 c = texture(src, uv).rgb;
  vec4 t = texture(tfm, uv);
  // follow edges where there are some; elsewhere a slow random flow, like loose brushwork
  float fa = vnoise(fc / (strokeW * 22.0)) * 6.2832 * 1.5;
  vec2 flow = vec2(cos(fa), sin(fa));
  vec2 dir = normalize(mix(flow, t.xy * 2.0 - 1.0, smoothstep(0.03, 0.35, t.z)) + 1e-5);
  // line-integral noise along the stroke direction
  float lic = 0.0;
  for (int k = -6; k <= 6; k++) lic += vnoise((fc + dir * float(k) * strokeW * 0.9) / strokeW);
  lic /= 13.0;
  c *= 1.0 + strokes * (lic - 0.5) * 0.5;
  // canvas weave relief
  float per = max(2.2, size.x / 640.0);
  float hx = sin(fc.x * 3.14159 / per);
  float hy = sin(fc.y * 3.14159 / per);
  float wv = hx * hy * 0.5 + (vnoise(fc / per * 0.5) - 0.5) * 0.6;
  c *= 1.0 + weave * wv * 0.07;
  // grade
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c *= vec3(1.0 + warmth * 0.07, 1.0 + warmth * 0.015, 1.0 - warmth * 0.08);
  c = (c - 0.5) * contrast + 0.5;
  c *= exposure;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

type GL = WebGL2RenderingContext;

interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
}

export class Painterly {
  private gl: GL;
  private canvas: AnyCanvas;
  private progs: Record<string, WebGLProgram> = {};
  private vao: WebGLVertexArrayObject;
  private floatRT: boolean;
  private lost = false;

  private constructor(canvas: AnyCanvas, gl: GL) {
    this.canvas = canvas;
    this.gl = gl;
    this.floatRT = !!gl.getExtension('EXT_color_buffer_float');
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;
    for (const [k, src] of Object.entries({ SST, GAUSS, TFM, AKF, FINAL })) this.progs[k] = this.program(src);
    (canvas as HTMLCanvasElement).addEventListener?.('webglcontextlost', () => (this.lost = true));
  }

  /** Returns null when WebGL 2 is unavailable in this context. */
  static create(): Painterly | null {
    try {
      const c = makeCanvas(4, 4);
      const gl = c.getContext('webgl2', { antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true }) as GL | null;
      if (!gl) return null;
      return new Painterly(c, gl);
    } catch (err) {
      console.warn('[painterly] unavailable', err);
      return null;
    }
  }

  private program(fs: string): WebGLProgram {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
    return p;
  }

  private texture(w: number, h: number, float: boolean): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  private target(w: number, h: number, float = false): Target {
    const gl = this.gl;
    const tex = this.texture(w, h, float);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  }

  private pass(name: string, out: Target | null, w: number, h: number, tex: Record<string, WebGLTexture>, uni: Record<string, number | number[]>, tile = 0) {
    const gl = this.gl;
    const p = this.progs[name];
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, w, h);
    let unit = 0;
    for (const [k, t] of Object.entries(tex)) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(gl.getUniformLocation(p, k), unit++);
    }
    gl.uniform2f(gl.getUniformLocation(p, 'size'), w, h);
    for (const [k, v] of Object.entries(uni)) {
      const loc = gl.getUniformLocation(p, k);
      if (Array.isArray(v)) gl.uniform2f(loc, v[0], v[1]);
      else gl.uniform1f(loc, v);
    }
    gl.bindVertexArray(this.vao);
    if (tile > 0) {
      gl.enable(gl.SCISSOR_TEST);
      for (let y = 0; y < h; y += tile)
        for (let x = 0; x < w; x += tile) {
          gl.scissor(x, y, Math.min(tile, w - x), Math.min(tile, h - y));
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.flush();
        }
      gl.disable(gl.SCISSOR_TEST);
    } else {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  /** Paints `src` (w x h) and returns a 2D canvas with the result. */
  apply(src: TexImageSource, w: number, h: number, o: PainterlyOptions): AnyCanvas {
    if (this.lost) throw new Error('WebGL context lost');
    const gl = this.gl;
    this.canvas.width = w;
    this.canvas.height = h;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    const srcTex = this.texture(w, h, false);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    const float = this.floatRT;
    const enc = float ? 0 : 1;
    const sst = this.target(w, h, float);
    const tmp = this.target(w, h, float);
    const tfm = this.target(w, h, false);
    const akf = this.target(w, h, false);
    try {
      this.pass('SST', sst, w, h, { src: srcTex }, { encode: enc });
      const sigma = Math.max(1.2, o.radius * 0.45);
      this.pass('GAUSS', tmp, w, h, { src: sst.tex }, { dir: [1, 0], sigma, encode: enc });
      this.pass('GAUSS', sst, w, h, { src: tmp.tex }, { dir: [0, 1], sigma, encode: enc });
      this.pass('TFM', tfm, w, h, { src: sst.tex }, { encode: enc });
      this.pass('AKF', akf, w, h, { src: srcTex, tfm: tfm.tex }, { radius: o.radius, q: o.q ?? 8 }, 256);
      this.pass('FINAL', null, w, h, { src: akf.tex, tfm: tfm.tex }, {
        strokes: o.strokes ?? 0.6,
        weave: o.weave ?? 0.6,
        saturation: o.saturation ?? 1.08,
        warmth: o.warmth ?? 0.3,
        exposure: o.exposure ?? 1,
        contrast: o.contrast ?? 1.04,
        strokeW: Math.max(1.5, o.radius * 0.7),
      });
      const out = makeCanvas(w, h);
      ctx2d(out).drawImage(this.canvas as CanvasImageSource, 0, 0);
      return out;
    } finally {
      for (const t of [sst, tmp, tfm, akf]) {
        gl.deleteFramebuffer(t.fb);
        gl.deleteTexture(t.tex);
      }
      gl.deleteTexture(srcTex);
    }
  }

  dispose() {
    (this.gl.getExtension('WEBGL_lose_context') as { loseContext(): void } | null)?.loseContext();
  }
}
