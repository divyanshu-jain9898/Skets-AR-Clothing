import { FilesetResolver, PoseLandmarker, type PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import type { PoseInput } from '../core/types';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;
export type ModelVariant = 'lite' | 'full';

const CDN_MODEL = (v: ModelVariant) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;

const assetUrl = (path: string) => new URL(path, document.baseURI).href;

/**
 * MediaPipe Tasks 1.x posts anonymous usage statistics to Google every
 * minute. Vastra keeps everything on-device, so that single endpoint is
 * answered locally. Set VITE_ALLOW_MEDIAPIPE_TELEMETRY=true to allow it.
 */
let telemetryBlocked = false;
function blockTelemetry() {
  if (telemetryBlocked || import.meta.env.VITE_ALLOW_MEDIAPIPE_TELEMETRY === 'true') return;
  telemetryBlocked = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('odml.pa.googleapis.com')) return Promise.resolve(new Response(null, { status: 204 }));
    return original(input, init);
  };
}

/**
 * Thin wrapper around MediaPipe's PoseLandmarker:
 *  - self-hosted wasm + model with download progress (CDN fallback)
 *  - GPU delegate with automatic CPU fallback
 *  - VIDEO mode for the camera, IMAGE mode for uploaded photos
 */
export class PoseTracker {
  private landmarker: PoseLandmarker | null = null;
  private fileset: WasmFileset | null = null;
  private modelCache = new Map<ModelVariant, Uint8Array>();
  private runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO';
  private lastTs = 0;
  private scratch: HTMLCanvasElement | null = null;
  variant: ModelVariant = 'lite';
  delegate: 'GPU' | 'CPU' = 'GPU';
  lastInferMs = 0;

  get ready() {
    return this.landmarker !== null;
  }

  async init(variant: ModelVariant, onProgress?: (p: number, label: string) => void) {
    blockTelemetry();
    onProgress?.(0.02, 'Loading body-tracking runtime');
    if (!this.fileset) {
      this.fileset = await FilesetResolver.forVisionTasks(assetUrl('mediapipe/wasm'));
    }
    const model = await this.loadModel(variant, (p) => onProgress?.(0.05 + p * 0.85, 'Downloading pose model'));
    onProgress?.(0.92, 'Starting tracker');
    this.landmarker?.close();
    this.landmarker = null;
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(this.fileset!, {
        baseOptions: { modelAssetBuffer: model.slice(), delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
    try {
      this.landmarker = await make('GPU');
      this.delegate = 'GPU';
    } catch (err) {
      console.warn('[tracker] GPU delegate unavailable, using CPU', err);
      this.landmarker = await make('CPU');
      this.delegate = 'CPU';
    }
    this.runningMode = 'VIDEO';
    this.variant = variant;
    onProgress?.(1, 'Ready');
  }

  private async loadModel(variant: ModelVariant, onProgress: (p: number) => void): Promise<Uint8Array> {
    const cached = this.modelCache.get(variant);
    if (cached) return cached;
    // Renamed copies are accepted too, for static hosts that refuse unknown
    // extensions (the bytes are identical; only the file name differs).
    const name = `models/pose_landmarker_${variant}`;
    const urls = [assetUrl(`${name}.task`), assetUrl(`${name}.bin`), assetUrl(`${name}.model.wasm`), CDN_MODEL(variant)];
    let lastErr: unknown;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get('content-length')) || (variant === 'full' ? 9_400_000 : 5_800_000);
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          onProgress(Math.min(1, received / total));
        }
        const buf = new Uint8Array(received);
        let off = 0;
        for (const c of chunks) {
          buf.set(c, off);
          off += c.length;
        }
        // A missing file on some static hosts returns index.html with 200 - guard against it.
        if (buf.length < 1_000_000) throw new Error('model file too small');
        this.modelCache.set(variant, buf);
        return buf;
      } catch (err) {
        lastErr = err;
      }
    }
    throw new Error(`Could not load pose model: ${String(lastErr)}`);
  }

  private async setMode(mode: 'VIDEO' | 'IMAGE') {
    if (!this.landmarker || this.runningMode === mode) return;
    await this.landmarker.setOptions({ runningMode: mode });
    this.runningMode = mode;
  }

  /** MediaPipe's CPU path can abort on frames whose width is not a multiple of 8 - normalise. */
  private normalise(src: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement, w: number, h: number) {
    if (this.delegate === 'GPU' && w % 8 === 0 && h % 8 === 0) return src;
    const W = Math.max(8, Math.floor(w / 8) * 8);
    const H = Math.max(8, Math.floor(h / 8) * 8);
    if (src instanceof HTMLCanvasElement && w === W && h === H) return src;
    this.scratch ??= document.createElement('canvas');
    if (this.scratch.width !== W || this.scratch.height !== H) {
      this.scratch.width = W;
      this.scratch.height = H;
    }
    this.scratch.getContext('2d')!.drawImage(src, 0, 0, W, H);
    return this.scratch;
  }

  detectVideo(video: HTMLVideoElement, nowMs: number): PoseInput | null {
    if (!this.landmarker || this.runningMode !== 'VIDEO') return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const ts = Math.max(nowMs, this.lastTs + 1);
    this.lastTs = ts;
    const t0 = performance.now();
    const res = this.landmarker.detectForVideo(this.normalise(video, w, h), ts);
    this.lastInferMs = performance.now() - t0;
    return PoseTracker.toInput(res, w, h);
  }

  async detectImage(img: HTMLCanvasElement | HTMLImageElement, w: number, h: number): Promise<PoseInput | null> {
    if (!this.landmarker) return null;
    await this.setMode('IMAGE');
    try {
      const res = this.landmarker.detect(this.normalise(img, w, h));
      return PoseTracker.toInput(res, w, h);
    } finally {
      await this.setMode('VIDEO');
      this.lastTs = performance.now();
    }
  }

  private static toInput(res: PoseLandmarkerResult, width: number, height: number): PoseInput | null {
    if (!res.landmarks?.length || !res.worldLandmarks?.length) return null;
    return { landmarks: res.landmarks[0], world: res.worldLandmarks[0], width, height };
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
