import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import type { PoseInput } from '../core/types';

const MODEL = 'selfie_segmenter.tflite';
const CDN_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';

const assetUrl = (path: string) => new URL(path, document.baseURI).href;

/** Bones used for the body prior: [from, to, radius as a fraction of shoulder width]. */
const BONES: [number, number, number][] = [
  [11, 13, 0.13], [13, 15, 0.11], [15, 19, 0.1], [15, 17, 0.1],
  [12, 14, 0.13], [14, 16, 0.11], [16, 20, 0.1], [16, 18, 0.1],
  [23, 25, 0.19], [25, 27, 0.14], [27, 31, 0.09], [27, 29, 0.09],
  [24, 26, 0.19], [26, 28, 0.14], [28, 32, 0.09], [28, 30, 0.09],
  [11, 12, 0.22], [23, 24, 0.24], [11, 23, 0.26], [12, 24, 0.26],
];

/**
 * Separates the person from the room so the background can be replaced.
 *
 * Runs MediaPipe's selfie segmenter (250 KB, GPU with CPU fallback) on a
 * small copy of each camera frame, then:
 *  - uses the tracked skeleton as a prior: fills holes along the limbs and
 *    removes false positives far from the body (another person, a poster);
 *  - smooths over time so edges don't shimmer, while following fast moves.
 * The result is a 0-255 mask, top row first, in camera-frame orientation.
 * Edge refinement against the full-resolution image happens on the GPU.
 */
export class PersonSegmenter {
  private seg: ImageSegmenter | null = null;
  private loading: Promise<void> | null = null;
  private runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private input: HTMLCanvasElement | null = null;
  private inputCtx: CanvasRenderingContext2D | null = null;
  private lastTs = 0;
  private smooth: Float32Array | null = null;
  private prior: Float32Array | null = null;
  private dist: Float32Array | null = null;
  private core: Uint8Array | null = null;
  mask: Uint8Array | null = null;
  maskW = 0;
  maskH = 0;
  /** Bumps every time `mask` changes. */
  version = 0;
  delegate: 'GPU' | 'CPU' = 'GPU';
  lastMs = 0;

  get ready() {
    return this.seg !== null;
  }

  ensure(): Promise<void> {
    if (this.seg) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = this.init().catch((err) => {
      this.loading = null;
      throw err;
    });
    return this.loading;
  }

  private async init() {
    const fileset = await FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'));
    const model = await PersonSegmenter.loadModel();
    const make = (delegate: 'GPU' | 'CPU') =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetBuffer: model.slice(), delegate },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    try {
      this.seg = await make('GPU');
      this.delegate = 'GPU';
    } catch (err) {
      console.warn('[segmenter] GPU delegate unavailable, using CPU', err);
      this.seg = await make('CPU');
      this.delegate = 'CPU';
    }
    this.runningMode = 'VIDEO';
  }

  private static async loadModel(): Promise<Uint8Array> {
    let lastErr: unknown;
    for (const url of [assetUrl(`models/${MODEL}`), assetUrl('models/selfie_segmenter.bin'), CDN_MODEL]) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        // TFLite flatbuffers carry "TFL3" at byte 4; static hosts may answer a missing file with index.html
        if (buf.length < 50_000 || String.fromCharCode(buf[4], buf[5], buf[6], buf[7]) !== 'TFL3') throw new Error('not a model file');
        return buf;
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(`Could not load the segmentation model: ${String(lastErr)}`);
  }

  private async setMode(mode: 'VIDEO' | 'IMAGE') {
    if (!this.seg || this.runningMode === mode) return;
    await this.seg.setOptions({ runningMode: mode });
    this.runningMode = mode;
  }

  /** Downscales the source so the long side is `long` px (multiple of 8). */
  private prepare(src: CanvasImageSource, w: number, h: number, long: number) {
    const s = long / Math.max(w, h);
    const W = Math.max(16, Math.round((w * s) / 8) * 8);
    const H = Math.max(16, Math.round((h * s) / 8) * 8);
    if (!this.input) {
      this.input = document.createElement('canvas');
      this.inputCtx = this.input.getContext('2d', { willReadFrequently: this.delegate === 'CPU' });
    }
    if (this.input.width !== W || this.input.height !== H) {
      this.input.width = W;
      this.input.height = H;
    }
    this.inputCtx!.drawImage(src, 0, 0, W, H);
    return this.input;
  }

  /** Segments one camera frame. Returns true when `mask` was updated. */
  segmentVideo(video: HTMLVideoElement, nowMs: number, pose: PoseInput | null): boolean {
    if (!this.seg || this.runningMode !== 'VIDEO') return false;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return false;
    const t0 = performance.now();
    const input = this.prepare(video, w, h, 256);
    const ts = Math.max(nowMs, this.lastTs + 1);
    this.lastTs = ts;
    let ok = false;
    this.seg.segmentForVideo(input, ts, (res) => {
      const m = res.confidenceMasks?.[0];
      if (m) ok = this.ingest(m.getAsFloat32Array(), m.width, m.height, pose, false);
    });
    this.lastMs = performance.now() - t0;
    return ok;
  }

  private imageLock: Promise<unknown> = Promise.resolve();

  /** Segments a still photo (no temporal smoothing). Calls are serialised. */
  segmentImage(img: HTMLCanvasElement, pose: PoseInput | null): Promise<boolean> {
    const run = this.imageLock.then(() => this.segmentImageNow(img, pose));
    this.imageLock = run.catch(() => undefined);
    return run;
  }

  private async segmentImageNow(img: HTMLCanvasElement, pose: PoseInput | null): Promise<boolean> {
    await this.ensure();
    if (!this.seg) return false;
    await this.setMode('IMAGE');
    try {
      const input = this.prepare(img, img.width, img.height, 512);
      let ok = false;
      this.seg.segment(input, (res) => {
        const m = res.confidenceMasks?.[0];
        if (m) ok = this.ingest(m.getAsFloat32Array(), m.width, m.height, pose, true);
      });
      return ok;
    } finally {
      await this.setMode('VIDEO');
      this.lastTs = performance.now();
    }
  }

  /** Forget temporal history (new source or camera flip). */
  reset() {
    this.smooth = null;
  }

  private ingest(raw: Float32Array, w: number, h: number, pose: PoseInput | null, still: boolean): boolean {
    const n = w * h;
    if (n === 0 || raw.length < n) return false;
    if (!this.smooth || this.maskW !== w || this.maskH !== h) {
      this.smooth = new Float32Array(n);
      this.smooth.set(raw.subarray(0, n));
      this.prior = new Float32Array(n);
      this.mask = new Uint8Array(n);
      this.maskW = w;
      this.maskH = h;
    }
    const cur = this.applyPrior(raw, w, h, pose);
    const sm = this.smooth;
    const out = this.mask!;
    for (let i = 0; i < n; i++) {
      const c = cur[i];
      let v: number;
      if (still) v = c;
      else {
        // follow big changes immediately (motion), damp small ones (noise)
        const d = c - sm[i];
        const k = 0.5 + Math.min(0.5, Math.abs(d) * 1.4);
        v = sm[i] + d * k;
      }
      sm[i] = v;
      out[i] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0;
    }
    this.version++;
    return true;
  }

  /**
   * Skeleton prior. Inside a thin core around confident bones the person is
   * certain (fills gaps, e.g. legs far from the camera); far outside a
   * generous envelope around the body nothing can be the person.
   */
  private applyPrior(raw: Float32Array, w: number, h: number, pose: PoseInput | null): Float32Array {
    if (!pose || pose.landmarks.length < 33) return raw;
    const L = pose.landmarks;
    const vis = (i: number) => L[i].visibility ?? 1;
    if (vis(11) < 0.5 || vis(12) < 0.5) return raw;
    // mask pixels keep the camera aspect, so distances are isotropic
    const sw = Math.hypot((L[11].x - L[12].x) * w, (L[11].y - L[12].y) * h);
    if (sw < 2) return raw;
    const n = w * h;
    if (!this.dist || this.dist.length !== n) {
      this.dist = new Float32Array(n);
      this.core = new Uint8Array(n);
    }
    const dist = this.dist;
    const core = this.core!;
    dist.fill(Infinity);
    core.fill(0);
    const env = sw * 0.42;
    // splat each confident bone's distance field over its bounding box
    for (const [a, b, rf] of BONES) {
      const va = vis(a);
      const vb = vis(b);
      if (va < 0.35 || vb < 0.35) continue;
      const x0 = L[a].x * w;
      const y0 = L[a].y * h;
      const x1 = L[b].x * w;
      const y1 = L[b].y * h;
      const r = rf * sw;
      const coreR = va > 0.6 && vb > 0.6 ? r * 0.45 : -1;
      const pad = r + env * 2;
      const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - pad));
      const bx1 = Math.min(w - 1, Math.ceil(Math.max(x0, x1) + pad));
      const by0 = Math.max(0, Math.floor(Math.min(y0, y1) - pad));
      const by1 = Math.min(h - 1, Math.ceil(Math.max(y0, y1) + pad));
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len2 = dx * dx + dy * dy || 1;
      for (let y = by0; y <= by1; y++) {
        const py = y + 0.5;
        for (let x = bx0; x <= bx1; x++) {
          const px = x + 0.5;
          let t = ((px - x0) * dx + (py - y0) * dy) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = px - (x0 + dx * t);
          const ey = py - (y0 + dy * t);
          const d = Math.sqrt(ex * ex + ey * ey);
          const i = y * w + x;
          if (d - r < dist[i]) dist[i] = d - r;
          if (d < coreR) core[i] = 1;
        }
      }
    }
    // head: an ellipse around the nose, generous for hair
    const hx = L[0].x * w;
    const hy = L[0].y * h;
    const headR = Math.max(sw * 0.36, Math.hypot((L[7].x - L[8].x) * w, (L[7].y - L[8].y) * h) * 0.65);
    const hp = headR * 1.3 + env * 2;
    for (let y = Math.max(0, Math.floor(hy - hp)); y <= Math.min(h - 1, Math.ceil(hy + hp)); y++)
      for (let x = Math.max(0, Math.floor(hx - hp)); x <= Math.min(w - 1, Math.ceil(hx + hp)); x++) {
        const d = Math.hypot(x + 0.5 - hx, (y + 0.5 - hy) * 0.85) - headR;
        const i = y * w + x;
        if (d < dist[i]) dist[i] = d;
        if (d < -headR * 0.55) core[i] = 1;
      }
    const out = this.prior!;
    for (let i = 0; i < n; i++) {
      let v = raw[i];
      if (core[i] && v < 0.92) v = 0.92;
      const best = dist[i];
      if (best > 0) {
        // fade out beyond the envelope around the body
        const f = 2 - best / env;
        if (f < 1) v *= f < 0 ? 0 : f;
      }
      out[i] = v;
    }
    return out;
  }

  close() {
    this.seg?.close();
    this.seg = null;
    this.loading = null;
  }
}
