import { CanvasTexture, Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, SRGBColorSpace, ShaderMaterial, Texture, UnsignedByteType, Vector2, Vector3, Vector4 } from 'three';

/** Normalised rectangle [x0, y0, x1, y1], y down (image convention). */
export type NRect = [number, number, number, number];

/** A painted or uploaded picture to stand in front of. */
export interface BackdropImage {
  kind: 'image';
  id: string;
  image: HTMLCanvasElement;
  /** Open sky where live fireworks may appear (0-255, top row first). */
  sky: { data: Uint8Array; w: number; h: number } | null;
  skyRects: NRect[];
  /** Average colour (sRGB 0..1). */
  mean: [number, number, number];
}

/**
 * What appears behind the person:
 *  - camera: the original camera image (no segmentation runs)
 *  - none:   background removed, a plain soft backdrop
 *  - image:  a painted Diwali scene, the office painting or an upload
 */
export type Backdrop = { kind: 'camera' } | { kind: 'none' } | BackdropImage;

export const CAMERA_BACKDROP: Backdrop = { kind: 'camera' };

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tVideo;
uniform sampler2D tBg;
uniform sampler2D tMask;
uniform sampler2D tSky;
uniform float mode;      // 0 camera, 1 picture, 2 plain backdrop, 3 picture only (mannequin)
uniform float hasMask;
uniform float mirror;
uniform vec2 viewSize;   // plane size in scene units
uniform vec2 frameSize;  // camera frame size in scene units
uniform vec2 maskTexel;
uniform vec4 bgRect;     // cover-fit: offset.xy, scale.zw
uniform float bgAspect;
uniform vec3 outside;
uniform vec3 plainTop;
uniform vec3 plainBottom;
uniform vec3 bgTint;
uniform float harmonize;
uniform float wrap;
uniform vec2 edge;
uniform float time;
uniform float live;
uniform float twinkle;
uniform float hasSky;
uniform vec4 skyRects[3];
uniform float skyCount;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 hash31(float p) { vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xxy + p3.yzz) * p3.zyx); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }

// Person mask, refined against the full-resolution camera image (joint
// bilateral upsampling) only along the silhouette edge.
float personMask(vec2 vuv) {
  float coarse = textureLod(tMask, vuv, 1.0).r;
  if (coarse < 0.004) return 0.0;
  if (coarse > 0.996) return 1.0;
  vec3 c0 = texture2D(tVideo, vuv).rgb;
  float ws = 0.0;
  float ms = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j)) * maskTexel;
      float m = texture2D(tMask, vuv + o).r;
      vec3 d = texture2D(tVideo, vuv + o).rgb - c0;
      float w = exp(-dot(d, d) * 55.0) * ((i == 0 && j == 0) ? 1.0 : 0.75);
      ws += w;
      ms += w * m;
    }
  }
  return ms / max(ws, 1e-4);
}

// Live fireworks: a few rockets that rise and burst inside the open sky.
vec3 fireworks(vec2 uv, out vec3 flash) {
  vec3 acc = vec3(0.0);
  flash = vec3(0.0);
  vec2 asp = vec2(bgAspect, 1.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float period = 3.3 + fi * 1.15;
    float t = time + fi * 2.1;
    float cyc = floor(t / period);
    float lt = t - cyc * period;
    vec3 h = hash31(cyc * 17.31 + fi * 101.7);
    float ri = mod(cyc + fi, max(skyCount, 1.0));
    vec4 R = skyRects[0];
    if (ri > 0.5) R = skyRects[1];
    if (ri > 1.5) R = skyRects[2];
    vec2 c = mix(R.xy, R.zw, h.xy);
    float size = mix(0.07, 0.15, h.z) * clamp((R.w - R.y) * 2.5, 0.45, 1.0);
    vec3 col = mix(hue(fract(h.x * 3.7 + h.z * 1.3)), vec3(1.0, 0.75, 0.32), step(0.68, h.y));
    col = mix(col, vec3(1.0), 0.12);
    float rise = 0.75;
    if (lt < rise) {
      float k = lt / rise;
      vec2 head = c - vec2(0.0, 0.2 * (1.0 - k) * (1.0 - k));
      vec2 a = (uv - head) * asp;
      float along = clamp(-a.y / 0.06, 0.0, 1.0);
      float perp = abs(a.x);
      float inTrail = step(a.y, 0.0) * step(-0.06, a.y);
      acc += vec3(1.0, 0.75, 0.45) * exp(-perp * perp / 1.6e-6) * (1.0 - along) * inTrail * 0.7;
      acc += vec3(1.0, 0.85, 0.6) * exp(-dot(a, a) / 1.5e-5) * 0.9;
    } else {
      float et = lt - rise;
      float life = 2.5;
      if (et < life) {
        vec2 d = (uv - c) * asp;
        d.y += 0.045 * et * et;
        float rad = size * (1.0 - exp(-et * 3.0));
        float r = length(d);
        float fade = 1.0 - smoothstep(life * 0.3, life, et);
        if (r < rad * 1.3 + 0.01) {
          float N = 18.0 + floor(h.z * 16.0);
          float k = floor(atan(d.y, d.x) / 6.28318 * N + 0.5);
          float ang = k / N * 6.28318;
          float j = hash11(k * 3.7 + cyc * 13.1 + fi * 7.0);
          vec2 dir = vec2(cos(ang), sin(ang));
          float pr = rad * (0.78 + 0.22 * j);
          float al = dot(d, dir);
          float pp = abs(d.x * dir.y - d.y * dir.x);
          float sparkle = 0.6 + 0.4 * sin(time * 38.0 + j * 60.0);
          float tip = exp(-((al - pr) * (al - pr) + pp * pp) / 1.1e-5);
          float trail = smoothstep(pr * 0.4, pr, al) * step(al, pr) * exp(-pp * pp / 3.5e-6) * 0.5;
          acc += col * (tip * sparkle + trail) * fade * 1.5;
        }
        float fl = exp(-et * 5.0);
        acc += col * exp(-r * r / (size * size * 0.06)) * fl;
        flash += col * fl * 0.05;
      }
    }
  }
  return acc;
}

void main() {
  vec2 p = (vUv - 0.5) * viewSize;
  vec2 vuv = p / frameSize + 0.5;
  float inF = step(0.0, vuv.x) * step(vuv.x, 1.0) * step(0.0, vuv.y) * step(vuv.y, 1.0);
  vec3 cam = texture2D(tVideo, clamp(vuv, vec2(0.0), vec2(1.0))).rgb;
  if (mode < 0.5) {
    // outside the camera picture: a dim continuation of its edges rather than a hard bar
    gl_FragColor = vec4(mix(mix(outside, cam, 0.35), cam, inF), 1.0);
  } else {
    vec2 suv = vec2(mirror > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
    vec2 buv = bgRect.xy + suv * bgRect.zw;
    vec3 bg;
    bool plain = mode > 1.5 && mode < 2.5;
    if (plain) {
      bg = mix(plainBottom, plainTop, smoothstep(0.0, 1.0, suv.y));
      bg *= 1.0 - 0.22 * smoothstep(0.35, 1.0, length((suv - vec2(0.5, 0.62)) * vec2(1.25, 1.0)));
    } else {
      bg = texture2D(tBg, buv).rgb;
      if (live > 0.5) {
        float l = dot(bg, vec3(0.2126, 0.7152, 0.0722));
        float hl = smoothstep(0.3, 0.9, l);
        float n = vnoise(buv * vec2(bgAspect, 1.0) * 70.0 + vec2(time * 0.8, time * 0.3));
        float n2 = vnoise(buv * vec2(bgAspect, 1.0) * 24.0 - vec2(time * 0.2, time * 1.4));
        bg *= 1.0 + twinkle * hl * ((n * 0.6 + n2 * 0.4) - 0.5) * 0.7;
        if (hasSky > 0.5) {
          float s = texture2D(tSky, buv).r;
          vec3 flash;
          vec3 fw = fireworks(buv, flash);
          bg += fw * s + flash;
        }
      }
    }
    float m = 0.0;
    if (mode < 2.5 && inF > 0.5) m = hasMask > 0.5 ? smoothstep(edge.x, edge.y, personMask(vuv)) : 1.0;
    vec3 fg = cam;
    if (m > 0.0 && hasMask > 0.5) {
      // nudge the person toward the scene's light colour
      fg *= mix(vec3(1.0), bgTint, harmonize);
      // light wrap: the backdrop's light spills softly over the silhouette edge
      float soft = textureLod(tMask, vuv, 3.0).r;
      vec3 spill = plain ? bg : textureLod(tBg, buv, 4.0).rgb;
      fg += spill * m * (1.0 - soft) * wrap;
    }
    gl_FragColor = vec4(mix(bg, fg, m), 1.0);
  }
  #include <colorspace_fragment>
}
`;

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** Shader material and textures that composite person, camera and backdrop. */
export class BackdropLayer {
  readonly material: ShaderMaterial;
  private maskTex: DataTexture;
  private skyTex: DataTexture;
  private bgTex: Texture | null = null;
  private bgW = 1;
  private bgH = 1;
  private viewW = 1;
  private viewH = 1;
  backdrop: Backdrop = CAMERA_BACKDROP;
  hasMask = false;

  constructor() {
    this.maskTex = BackdropLayer.r8(new Uint8Array(16 * 16), 16, 16, true);
    this.skyTex = BackdropLayer.r8(new Uint8Array(4 * 4), 4, 4, false);
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        tVideo: { value: null },
        tBg: { value: null },
        tMask: { value: this.maskTex },
        tSky: { value: this.skyTex },
        mode: { value: 0 },
        hasMask: { value: 0 },
        mirror: { value: 0 },
        viewSize: { value: new Vector2(1, 1) },
        frameSize: { value: new Vector2(1, 1) },
        maskTexel: { value: new Vector2(1 / 16, 1 / 16) },
        bgRect: { value: new Vector4(0, 0, 1, 1) },
        bgAspect: { value: 1 },
        outside: { value: new Color('#1a1416') },
        plainTop: { value: new Color('#f4ece2') },
        plainBottom: { value: new Color('#d9c8b8') },
        bgTint: { value: new Vector3(1, 1, 1) },
        harmonize: { value: 0.14 },
        wrap: { value: 0.32 },
        edge: { value: new Vector2(0.32, 0.72) },
        time: { value: 0 },
        live: { value: 1 },
        twinkle: { value: 1 },
        hasSky: { value: 0 },
        skyRects: { value: [new Vector4(0, 0.6, 1, 1), new Vector4(0, 0.6, 1, 1), new Vector4(0, 0.6, 1, 1)] },
        skyCount: { value: 1 },
      },
    });
  }

  private static r8(data: Uint8Array, w: number, h: number, mips: boolean) {
    const t = new DataTexture(data, w, h, RedFormat, UnsignedByteType);
    t.magFilter = LinearFilter;
    t.minFilter = mips ? LinearMipmapLinearFilter : LinearFilter;
    t.generateMipmaps = mips;
    t.unpackAlignment = 1;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  }

  /** Copies rows bottom-up so texture v=0 is the bottom, matching video textures. */
  private static fill(dst: Uint8Array, src: Uint8Array, w: number, h: number) {
    for (let y = 0; y < h; y++) dst.set(src.subarray((h - 1 - y) * w, (h - y) * w), y * w);
  }

  setVideo(tex: Texture | null) {
    this.material.uniforms.tVideo.value = tex;
  }

  setMirror(m: boolean) {
    this.material.uniforms.mirror.value = m ? 1 : 0;
  }

  setBackdrop(b: Backdrop) {
    this.backdrop = b;
    const u = this.material.uniforms;
    if (this.bgTex && (b.kind !== 'image' || this.bgTex.image !== b.image)) {
      this.bgTex.dispose();
      this.bgTex = null;
    }
    if (b.kind === 'image') {
      if (!this.bgTex) {
        const t = new CanvasTexture(b.image);
        t.colorSpace = SRGBColorSpace;
        t.minFilter = LinearMipmapLinearFilter;
        t.magFilter = LinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 4;
        t.needsUpdate = true;
        this.bgTex = t;
      }
      this.bgW = b.image.width;
      this.bgH = b.image.height;
      u.tBg.value = this.bgTex;
      u.bgAspect.value = this.bgW / this.bgH;
      const lin = b.mean.map(srgbToLinear);
      const l = Math.max(0.02, 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]);
      (u.bgTint.value as Vector3).set(...(lin.map((c) => Math.min(1.6, Math.max(0.6, c / l))) as [number, number, number]));
      if (b.sky && b.skyRects.length) {
        const { data, w, h } = b.sky;
        const buf = new Uint8Array(w * h);
        BackdropLayer.fill(buf, data, w, h);
        this.skyTex.dispose();
        this.skyTex = BackdropLayer.r8(buf, w, h, false);
        u.tSky.value = this.skyTex;
        u.hasSky.value = 1;
        const rects = u.skyRects.value as Vector4[];
        b.skyRects.slice(0, 3).forEach(([x0, y0, x1, y1], i) => rects[i].set(x0, 1 - y1, x1, 1 - y0));
        u.skyCount.value = Math.min(3, b.skyRects.length);
      } else {
        u.hasSky.value = 0;
      }
    } else {
      u.tBg.value = null;
      u.hasSky.value = 0;
      (u.bgTint.value as Vector3).set(1.02, 1, 0.97);
    }
    this.fit();
  }

  /** Person mask in camera orientation (top row first). */
  setMask(data: Uint8Array, w: number, h: number) {
    const img = this.maskTex.image as { data: Uint8Array; width: number; height: number };
    if (img.width !== w || img.height !== h) {
      this.maskTex.dispose();
      this.maskTex = BackdropLayer.r8(new Uint8Array(w * h), w, h, true);
      this.material.uniforms.tMask.value = this.maskTex;
      this.material.uniforms.maskTexel.value.set(1 / w, 1 / h);
    }
    BackdropLayer.fill((this.maskTex.image as { data: Uint8Array }).data, data, w, h);
    this.maskTex.needsUpdate = true;
    this.hasMask = true;
    this.material.uniforms.hasMask.value = 1;
  }

  clearMask() {
    this.hasMask = false;
    this.material.uniforms.hasMask.value = 0;
  }

  setMode(mode: 0 | 1 | 2 | 3) {
    this.material.uniforms.mode.value = mode;
  }

  setLive(on: boolean) {
    this.material.uniforms.live.value = on ? 1 : 0;
  }

  advance(dt: number) {
    const u = this.material.uniforms.time;
    u.value = (u.value + dt) % 3600;
  }

  /** Plane size (scene units) and the camera frame size. */
  setGeometry(viewW: number, viewH: number, frameW: number, frameH: number) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.material.uniforms.viewSize.value.set(viewW, viewH);
    this.material.uniforms.frameSize.value.set(frameW, frameH);
    this.fit();
  }

  /** Cover-fits the backdrop picture into the visible view. */
  private fit() {
    const va = this.viewW / Math.max(1e-6, this.viewH);
    const ba = this.bgW / Math.max(1e-6, this.bgH);
    const r = this.material.uniforms.bgRect.value as Vector4;
    if (ba > va) {
      const sx = va / ba;
      r.set((1 - sx) / 2, 0, sx, 1);
    } else {
      const sy = ba / va;
      r.set(0, (1 - sy) / 2, 1, sy);
    }
  }

  /** Mean colour of the backdrop, linear, or null for camera/plain. */
  get tint(): Vector3 | null {
    return this.backdrop.kind === 'image' ? (this.material.uniforms.bgTint.value as Vector3) : null;
  }

  dispose() {
    this.maskTex.dispose();
    this.skyTex.dispose();
    this.bgTex?.dispose();
    this.material.dispose();
  }
}
