import {
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NeutralToneMapping,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  Vector3,
  VideoTexture,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { BodyRig } from '../body/BodyRig';
import { clamp, damp, lerp, smoothstep } from '../core/math';

export type BackgroundKind = 'video' | 'image' | 'studio';

const STUDIO_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const STUDIO_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 top; uniform vec3 bottom; uniform vec3 glow; uniform float floorY; uniform float aspect;
void main() {
  vec2 p = vUv;
  vec3 c = mix(bottom, top, smoothstep(0.0, 1.0, p.y));
  float g = 1.0 - smoothstep(0.0, 0.62, length((p - vec2(0.5, 0.62)) * vec2(aspect, 1.0)));
  c = mix(c, glow, g * 0.55);
  // floor
  float f = smoothstep(floorY + 0.012, floorY - 0.012, p.y);
  vec3 floorCol = bottom * 0.94;
  c = mix(c, floorCol, f * 0.8);
  // vignette
  float v = smoothstep(1.15, 0.35, length((p - 0.5) * vec2(aspect * 0.9, 1.1)));
  c *= mix(0.82, 1.0, v);
  gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * Three.js renderer for the AR view. The scene is laid out in source-frame
 * pixels with an orthographic camera, so a landmark at pixel (x,y) renders at
 * exactly that pixel of the video background. Mirroring (selfie view) flips
 * the whole root group, keeping garments, video and occluders consistent.
 */
export class ARRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 1, 40000);
  readonly root = new Group();
  readonly garments = new Group();
  readonly overlay = new Group();
  private bg: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private studio: Mesh<PlaneGeometry, ShaderMaterial>;
  private shadow: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private bgTex: Texture | null = null;
  private hemi: HemisphereLight;
  private key: DirectionalLight;
  private fill: DirectionalLight;
  private rim: DirectionalLight;
  private probe: CanvasRenderingContext2D | null;
  private probeCanvas: HTMLCanvasElement;
  private lightT = 0;
  private lum = 0.45;
  private tint = new Color(1, 1, 1);
  private keyDir = new Vector3(0.4, 0.6, 1);
  frameW = 1280;
  frameH = 720;
  mirror = false;
  fit: 'cover' | 'contain' = 'cover';
  kind: BackgroundKind = 'studio';
  viewW = 1;
  viewH = 1;
  pixelRatioCap = 2;

  constructor(canvas: HTMLCanvasElement, antialias = true) {
    this.renderer = new WebGLRenderer({ canvas, antialias, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor('#1a1416');
    this.camera.position.set(0, 0, 20000);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.root);
    this.root.add(this.garments, this.overlay);

    const pm = new PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();

    this.hemi = new HemisphereLight('#ffffff', '#5a4a44', 1.0);
    this.key = new DirectionalLight('#fff4e6', 1.9);
    this.fill = new DirectionalLight('#dfe8ff', 0.55);
    this.rim = new DirectionalLight('#ffe9d2', 0.9);
    this.scene.add(this.hemi, this.key, this.fill, this.rim, this.key.target, this.fill.target, this.rim.target);

    const plane = new PlaneGeometry(1, 1);
    this.bg = new Mesh(plane, new MeshBasicMaterial({ toneMapped: false, depthWrite: false, depthTest: false }));
    this.bg.renderOrder = -100;
    this.bg.frustumCulled = false;
    this.studio = new Mesh(
      plane,
      new ShaderMaterial({
        vertexShader: STUDIO_VERT,
        fragmentShader: STUDIO_FRAG,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        uniforms: {
          top: { value: new Color('#f3e7dc') },
          bottom: { value: new Color('#d8c3b2') },
          glow: { value: new Color('#fff7ee') },
          floorY: { value: 0.11 },
          aspect: { value: 1 },
        },
      }),
    );
    this.studio.renderOrder = -100;
    this.studio.frustumCulled = false;
    this.shadow = new Mesh(plane, new MeshBasicMaterial({ map: ARRenderer.shadowTexture(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    this.shadow.renderOrder = -90;
    this.shadow.frustumCulled = false;
    this.root.add(this.bg, this.studio, this.shadow);
    this.probeCanvas = document.createElement('canvas');
    this.probeCanvas.width = 48;
    this.probeCanvas.height = 48;
    this.probe = this.probeCanvas.getContext('2d', { willReadFrequently: true });
    this.setBackground('studio');
  }

  private static shadowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(60,35,30,0.55)');
    grd.addColorStop(0.5, 'rgba(60,35,30,0.22)');
    grd.addColorStop(1, 'rgba(60,35,30,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }

  setPixelRatioCap(cap: number) {
    this.pixelRatioCap = cap;
    this.resize(this.viewW, this.viewH);
  }

  /** Switch the background between a video, a still image (photo mode) and the studio backdrop. */
  setBackground(kind: BackgroundKind, el?: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, w?: number, h?: number) {
    this.kind = kind;
    this.bgTex?.dispose();
    this.bgTex = null;
    if (kind === 'studio') {
      this.bg.visible = false;
      this.studio.visible = true;
      this.shadow.visible = true;
    } else if (el) {
      // VideoTexture re-uploads every decoded camera frame; stills use a plain texture
      const t = el instanceof HTMLVideoElement ? new VideoTexture(el) : new Texture(el);
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.bgTex = t;
      this.bg.material.map = t;
      this.bg.material.needsUpdate = true;
      this.bg.visible = true;
      this.studio.visible = false;
      this.shadow.visible = false;
    }
    if (w && h) this.setFrameSize(w, h);
  }

  /** Make sure the camera frame that was just tracked is the one drawn. */
  updateVideoFrame() {
    if (this.bgTex && !(this.bgTex as VideoTexture).isVideoTexture) this.bgTex.needsUpdate = true;
  }

  setFrameSize(w: number, h: number) {
    this.frameW = w;
    this.frameH = h;
    this.bg.scale.set(w, h, 1);
    this.bg.position.set(0, 0, -15000);
    this.studio.scale.set(w * 1.6, h * 1.6, 1);
    this.studio.position.set(0, 0, -15000);
    (this.studio.material.uniforms.aspect.value as number) = w / h;
    this.studio.material.uniforms.floorY.value = 0.5 - (0.455 * h) / (h * 1.6);
    this.updateCamera();
  }

  resize(vw: number, vh: number) {
    this.viewW = Math.max(1, vw);
    this.viewH = Math.max(1, vh);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
    this.renderer.setSize(this.viewW, this.viewH, false);
    this.updateCamera();
  }

  setMirror(m: boolean) {
    this.mirror = m;
    this.root.scale.x = m ? -1 : 1;
    this.root.updateMatrixWorld(true);
  }

  private updateCamera() {
    const { viewW, viewH, frameW, frameH } = this;
    const s = this.fit === 'cover' ? Math.max(viewW / frameW, viewH / frameH) : Math.min(viewW / frameW, viewH / frameH);
    const hw = viewW / s / 2;
    const hh = viewH / s / 2;
    this.camera.left = -hw;
    this.camera.right = hw;
    this.camera.top = hh;
    this.camera.bottom = -hh;
    this.camera.updateProjectionMatrix();
  }

  /** Converts a scene point to CSS pixel coordinates inside the view. */
  toView(p: Vector3, out: { x: number; y: number }) {
    const x = this.mirror ? -p.x : p.x;
    out.x = ((x - this.camera.left) / (this.camera.right - this.camera.left)) * this.viewW;
    out.y = ((this.camera.top - p.y) / (this.camera.top - this.camera.bottom)) * this.viewH;
    return out;
  }

  /** Place the soft contact shadow under the mannequin's feet. */
  placeShadow(rig: BodyRig) {
    const a = rig.p[27];
    const b = rig.p[28];
    this.shadow.position.set((a.x + b.x) / 2, Math.min(a.y, b.y) - rig.sw * 0.12, -14000);
    this.shadow.scale.set(rig.sw * 2.6, rig.sw * 0.42, 1);
  }

  /** Studio lighting for mannequin / thumbnails. */
  studioLights() {
    this.hemi.color.set('#fffaf3');
    this.hemi.groundColor.set('#6d5a50');
    this.hemi.intensity = 1.05;
    this.key.color.set('#fff1df');
    this.key.intensity = 2.0;
    this.key.position.set(-0.55, 0.75, 1).multiplyScalar(10000);
    this.fill.intensity = 0.6;
    this.fill.position.set(0.8, 0.2, 0.9).multiplyScalar(10000);
    this.rim.intensity = 1.0;
    this.rim.position.set(0.6, 0.8, -0.8).multiplyScalar(10000);
    this.scene.environmentIntensity = 0.6;
    this.renderer.toneMappingExposure = 1.0;
  }

  /**
   * Estimates ambient colour, brightness and dominant light direction from
   * the camera image so garments are lit like the room they appear in.
   */
  estimateLighting(src: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, rig: BodyRig | null, dt: number) {
    this.lightT += dt;
    if (this.lightT >= 0.25 && this.probe) {
      this.lightT = 0;
      const g = this.probe;
      const N = 48;
      try {
        g.drawImage(src, 0, 0, N, N);
        const d = g.getImageData(0, 0, N, N).data;
        let r = 0;
        let gg = 0;
        let b = 0;
        let L = 0;
        let left = 0;
        let right = 0;
        let topL = 0;
        let botL = 0;
        let nl = 0;
        let nr = 0;
        let nt = 0;
        let nb = 0;
        // person box in probe pixels
        let x0 = 0.3 * N;
        let x1 = 0.7 * N;
        let y0 = 0.15 * N;
        let y1 = 0.8 * N;
        if (rig?.hasPose) {
          const box = rig.bounds({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
          if (Number.isFinite(box.minX)) {
            x0 = clamp(((box.minX + this.frameW / 2) / this.frameW) * N, 0, N - 2);
            x1 = clamp(((box.maxX + this.frameW / 2) / this.frameW) * N, x0 + 2, N);
            y0 = clamp(((this.frameH / 2 - box.maxY) / this.frameH) * N, 0, N - 2);
            y1 = clamp(((this.frameH / 2 - box.minY) / this.frameH) * N, y0 + 2, N);
          }
        }
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const k = (y * N + x) * 4;
            const R = d[k] / 255;
            const G = d[k + 1] / 255;
            const B = d[k + 2] / 255;
            const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
            r += R;
            gg += G;
            b += B;
            L += l;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
              if (x < cx) {
                left += l;
                nl++;
              } else {
                right += l;
                nr++;
              }
              if (y < cy) {
                topL += l;
                nt++;
              } else {
                botL += l;
                nb++;
              }
            }
          }
        }
        const n = N * N;
        const lum = L / n;
        this.lum = lerp(this.lum, lum, 0.35);
        const m = Math.max(r, gg, b) || 1;
        const tint = new Color(r / m, gg / m, b / m);
        this.tint.lerp(new Color(1, 1, 1).lerp(tint, 0.45), 0.3);
        const lr = nl && nr ? right / nr - left / nl : 0;
        const tb = nt && nb ? topL / nt - botL / nb : 0.05;
        const dir = new Vector3(clamp(lr * 6, -1.2, 1.2), clamp(0.5 + tb * 4, 0.1, 1.2), 1).normalize();
        this.keyDir.lerp(dir, 0.3).normalize();
      } catch {
        // cross-origin or not ready - keep previous estimate
      }
    }
    const exposure = lerp(0.62, 1.08, smoothstep(0.06, 0.55, this.lum));
    this.renderer.toneMappingExposure += (exposure - this.renderer.toneMappingExposure) * damp(3, dt);
    this.hemi.color.copy(this.tint);
    this.hemi.groundColor.copy(this.tint).multiplyScalar(0.45);
    this.hemi.intensity = 1.15;
    this.key.color.copy(this.tint).lerp(new Color(1, 1, 1), 0.5);
    this.key.intensity = 1.5;
    this.key.position.copy(this.keyDir).multiplyScalar(10000);
    this.fill.intensity = 0.45;
    this.fill.position.set(-this.keyDir.x, 0.2, 1).normalize().multiplyScalar(10000);
    this.rim.intensity = 0.35;
    this.scene.environmentIntensity = 0.42;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Render and grab the frame (WYSIWYG) with a small watermark caption. */
  capture(caption: string, type = 'image/jpeg'): Promise<Blob> {
    this.render();
    const src = this.renderer.domElement;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const g = out.getContext('2d')!;
    g.drawImage(src, 0, 0);
    const s = Math.max(1, out.width / 900);
    const pad = 18 * s;
    g.save();
    const grd = g.createLinearGradient(0, out.height - 90 * s, 0, out.height);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grd;
    g.fillRect(0, out.height - 90 * s, out.width, 90 * s);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.font = `600 ${20 * s}px "Fraunces", Georgia, serif`;
    g.textBaseline = 'alphabetic';
    g.fillText('Vastra AR', pad, out.height - pad - 22 * s);
    g.font = `400 ${14 * s}px system-ui, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(caption, pad, out.height - pad);
    g.restore();
    return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('capture failed'))), type, 0.92));
  }

  dispose() {
    this.bgTex?.dispose();
    this.renderer.dispose();
  }
}
