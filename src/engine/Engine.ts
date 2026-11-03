import { ARRenderer } from './render/ARRenderer';
import { Mannequin, Occluders, Skeleton } from './render/BodyVisuals';
import { PoseTracker } from './tracking/PoseTracker';
import { SyntheticPose, type MannequinPose } from './tracking/SyntheticPose';
import { CameraSource, type Facing } from './camera/CameraSource';
import { BodyRig } from './body/BodyRig';
import { BodyShape } from './body/BodyShape';
import { FabricLibrary } from './materials/FabricLibrary';
import { Wardrobe } from './Wardrobe';
import type { OutfitSelection } from './catalog/types';
import { QUALITY_PRESETS, type EngineStats, type PoseInput, type QualityLevel, type QualitySettings, type SourceMode, type TrackingStatus } from './core/types';
import { clamp } from './core/math';

export interface EngineCallbacks {
  onStatus?: (status: TrackingStatus, message?: string, progress?: number) => void;
  onStats?: (s: EngineStats) => void;
  onHint?: (hint: string | null) => void;
  onMode?: (mode: SourceMode) => void;
  onQuality?: (level: QualityLevel, reason: string) => void;
}

type VFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: unknown) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Orchestrates camera / photo / mannequin sources, pose tracking, the body
 * model, garment simulation and rendering.
 */
export class Engine {
  readonly renderer: ARRenderer;
  readonly tracker = new PoseTracker();
  readonly camera = new CameraSource();
  readonly rig = new BodyRig();
  readonly shape = new BodyShape();
  readonly synth = new SyntheticPose();
  readonly lib = new FabricLibrary();
  readonly wardrobe: Wardrobe;
  readonly occluders = new Occluders();
  readonly mannequin: Mannequin;
  readonly skeleton = new Skeleton();
  mode: SourceMode = 'mannequin';
  quality: QualitySettings;
  selection: OutfitSelection | null = null;
  showSkeleton = false;
  occlusion = true;
  autoLighting = true;
  private photoCanvas: HTMLCanvasElement | null = null;
  private photoPose: PoseInput | null = null;
  private raf = 0;
  private vfc = 0;
  private lastT = 0;
  private frames = 0;
  private fpsT = 0;
  private procMs = 0;
  private slowFor = 0;
  private hint: string | null = null;
  private trackerLoading: Promise<void> | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private destroyed = false;
  private mirrorPref = true;
  private stats: EngineStats = { fps: 0, inferMs: 0, renderMs: 0, delegate: '-' };

  constructor(
    canvas: HTMLCanvasElement,
    level: QualityLevel,
    private cb: EngineCallbacks = {},
  ) {
    this.quality = { ...QUALITY_PRESETS[level] };
    this.renderer = new ARRenderer(canvas, this.quality.antialias);
    this.renderer.setPixelRatioCap(this.quality.pixelRatioCap);
    this.lib.maxAnisotropy = Math.min(8, this.renderer.renderer.capabilities.getMaxAnisotropy());
    this.wardrobe = new Wardrobe(
      { lib: this.lib, detail: this.quality.meshDetail, gender: 'women', clothIterations: this.quality.clothIterations },
      this.renderer.garments,
    );
    this.mannequin = new Mannequin(this.lib.mannequin());
    this.renderer.root.add(this.mannequin.group, this.occluders.group);
    this.renderer.overlay.add(this.skeleton.lines);
    this.skeleton.lines.visible = false;
    this.occluders.group.visible = false;
    this.renderer.studioLights();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // ------------------------------------------------------------------ setup
  start() {
    this.lastT = performance.now() / 1000;
    const loop = () => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      if (this.mode !== 'camera') this.tick();
    };
    this.raf = requestAnimationFrame(loop);
  }

  resize(w: number, h: number) {
    this.renderer.resize(w, h);
    if (this.mode === 'mannequin') this.updateMannequinFrame();
  }

  private updateMannequinFrame() {
    const { viewW, viewH } = this.renderer;
    const H = 1000;
    const W = Math.round((H * viewW) / Math.max(1, viewH));
    this.renderer.setFrameSize(W, H);
  }

  setSelection(sel: OutfitSelection) {
    this.selection = sel;
    this.wardrobe.ctx.gender = sel.gender;
    this.synth.gender = sel.gender;
    this.wardrobe.apply(sel);
  }

  setQuality(level: QualityLevel) {
    const prevModel = this.quality.model;
    this.quality = { ...QUALITY_PRESETS[level] };
    this.renderer.setPixelRatioCap(this.quality.pixelRatioCap);
    this.wardrobe.ctx.detail = this.quality.meshDetail;
    this.wardrobe.ctx.clothIterations = this.quality.clothIterations;
    this.wardrobe.rebuild(this.selection);
    if (this.tracker.ready && prevModel !== this.quality.model) {
      this.trackerLoading = null;
      void this.ensureTracker(true);
    }
  }

  setMirror(m: boolean) {
    this.mirrorPref = m;
    if (this.mode === 'camera') this.renderer.setMirror(m);
  }

  setFit(fit: 'cover' | 'contain') {
    this.renderer.fit = fit;
    this.renderer.resize(this.renderer.viewW, this.renderer.viewH);
  }

  setShowSkeleton(v: boolean) {
    this.showSkeleton = v;
  }

  setMannequinPose(p: MannequinPose) {
    this.synth.pose = p;
  }

  setMannequinYaw(yaw: number, auto: boolean) {
    this.synth.userYaw = yaw;
    this.synth.autoRotate = auto;
  }

  // ------------------------------------------------------------- tracking
  ensureTracker(force = false): Promise<void> {
    if (this.trackerLoading && !force) return this.trackerLoading;
    this.cb.onStatus?.('loading', 'Loading body tracking…', 0);
    this.trackerLoading = this.tracker
      .init(this.quality.model, (p, label) => this.cb.onStatus?.('loading', label, p))
      .then(() => {
        this.stats.delegate = this.tracker.delegate;
        this.cb.onStatus?.(this.mode === 'camera' ? 'searching' : 'idle', undefined, 1);
      })
      .catch((err) => {
        this.trackerLoading = null;
        this.cb.onStatus?.('error', `Body tracking failed to load: ${String(err?.message ?? err)}`);
        throw err;
      });
    return this.trackerLoading;
  }

  // -------------------------------------------------------------- sources
  async startCamera(facing: Facing = this.camera.facing) {
    this.stopSources();
    await this.camera.start(facing);
    const v = this.camera.video;
    this.mode = 'camera';
    this.cb.onMode?.('camera');
    this.rig.reset();
    this.renderer.setBackground('video', v, v.videoWidth || 1280, v.videoHeight || 720);
    this.mirrorPref = facing === 'user' ? this.mirrorPref : false;
    this.renderer.setMirror(facing === 'user' ? this.mirrorPref : false);
    this.mannequin.group.visible = false;
    this.occluders.group.visible = this.occlusion;
    this.wardrobe.resetPhysics();
    this.cb.onStatus?.(this.tracker.ready ? 'searching' : 'loading', this.tracker.ready ? 'Looking for you…' : 'Loading body tracking…');
    void this.ensureTracker().catch(() => undefined);
    this.lastT = performance.now() / 1000;
    this.scheduleVideo();
  }

  async flipCamera() {
    if (this.mode !== 'camera') return;
    await this.startCamera(this.camera.facing === 'user' ? 'environment' : 'user');
  }

  private scheduleVideo() {
    const v = this.camera.video as VFCVideo;
    if (v.requestVideoFrameCallback) {
      const onFrame = (now: number) => {
        if (this.mode !== 'camera' || this.destroyed) return;
        this.vfc = v.requestVideoFrameCallback!(onFrame);
        this.processCamera(now);
      };
      this.vfc = v.requestVideoFrameCallback(onFrame);
    } else {
      let lastTime = -1;
      const poll = () => {
        if (this.mode !== 'camera' || this.destroyed) return;
        this.vfc = requestAnimationFrame(poll);
        if (v.currentTime !== lastTime) {
          lastTime = v.currentTime;
          this.processCamera(performance.now());
        }
      };
      this.vfc = requestAnimationFrame(poll);
    }
  }

  private processCamera(nowMs: number) {
    if (document.hidden) return;
    const v = this.camera.video;
    if (!v.videoWidth) return;
    if (v.videoWidth !== this.renderer.frameW || v.videoHeight !== this.renderer.frameH) this.renderer.setFrameSize(v.videoWidth, v.videoHeight);
    let pose: PoseInput | null = null;
    if (this.tracker.ready) {
      try {
        pose = this.tracker.detectVideo(v, nowMs);
      } catch (err) {
        console.warn('[engine] detection error', err);
      }
    }
    this.renderer.updateVideoFrame();
    const t = nowMs / 1000;
    this.process(pose, t, false, v);
  }

  async loadPhoto(file: Blob) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => createImageBitmap(file));
    const maxDim = 1600;
    const s = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const W = Math.max(64, Math.floor((bmp.width * s) / 8) * 8);
    const H = Math.max(64, Math.floor((bmp.height * s) / 8) * 8);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.getContext('2d')!.drawImage(bmp, 0, 0, W, H);
    bmp.close?.();
    await this.ensureTracker();
    const pose = await this.tracker.detectImage(c, W, H);
    if (!pose) throw new Error('No person was found in that photo. Try a clear, front-facing photo showing at least your head, shoulders and hips.');
    this.stopSources();
    this.photoCanvas = c;
    this.photoPose = pose;
    this.mode = 'photo';
    this.cb.onMode?.('photo');
    this.rig.reset();
    this.renderer.setBackground('image', c, W, H);
    this.renderer.setMirror(false);
    this.mannequin.group.visible = false;
    this.occluders.group.visible = this.occlusion;
    this.wardrobe.resetPhysics();
    this.cb.onStatus?.('tracking', 'Photo try-on');
    this.lastT = performance.now() / 1000;
  }

  showMannequin() {
    this.stopSources();
    this.mode = 'mannequin';
    this.cb.onMode?.('mannequin');
    this.rig.reset();
    this.renderer.setBackground('studio');
    this.updateMannequinFrame();
    this.renderer.setMirror(false);
    this.renderer.studioLights();
    this.mannequin.group.visible = true;
    this.occluders.group.visible = false;
    this.wardrobe.resetPhysics();
    this.cb.onStatus?.('idle');
    this.setHint(null);
    this.lastT = performance.now() / 1000;
  }

  private stopSources() {
    const v = this.camera.video as VFCVideo;
    if (this.vfc) {
      v.cancelVideoFrameCallback?.(this.vfc);
      cancelAnimationFrame(this.vfc);
      this.vfc = 0;
    }
    if (this.mode === 'camera') this.camera.stop();
    this.photoPose = null;
  }

  // ------------------------------------------------------------ main loop
  /** rAF-driven tick for mannequin and photo modes. */
  private tick() {
    const now = performance.now() / 1000;
    if (this.mode === 'mannequin') {
      const dt = clamp(now - this.lastT, 1 / 240, 0.1);
      const pose = this.synth.generate(now, dt, this.renderer.frameW, this.renderer.frameH);
      this.process(pose, now, false, null);
    } else if (this.mode === 'photo' && this.photoPose && this.photoCanvas) {
      this.process(this.photoPose, now, true, this.photoCanvas);
    }
  }

  private process(pose: PoseInput | null, t: number, snap: boolean, lightSrc: HTMLVideoElement | HTMLCanvasElement | null) {
    const t0 = performance.now();
    const dt = clamp(t - this.lastT, 1 / 240, 0.1);
    this.lastT = t;
    const rig = this.rig;
    rig.update(pose, t, snap);
    const show = rig.hasPose && rig.presence > 0.5;
    if (rig.hasPose) {
      this.shape.bust = this.selection?.gender === 'women' ? 1 : 0;
      this.shape.update(rig);
      this.wardrobe.update(rig, this.shape, dt);
      if (this.mode === 'mannequin') {
        this.mannequin.update(rig, this.shape);
        this.renderer.placeShadow(rig);
      } else if (this.occlusion) {
        this.occluders.update(rig, this.shape);
      }
      if (this.showSkeleton) this.skeleton.update(rig);
    }
    this.renderer.garments.visible = show;
    this.occluders.group.visible = show && this.occlusion && this.mode !== 'mannequin';
    this.skeleton.lines.visible = this.showSkeleton && rig.hasPose && this.mode !== 'mannequin';
    if (lightSrc && this.autoLighting) this.renderer.estimateLighting(lightSrc, rig, dt);
    else if (lightSrc) this.renderer.studioLights();
    const t1 = performance.now();
    this.renderer.render();
    const t2 = performance.now();

    // stats + guidance
    this.frames++;
    this.procMs = this.procMs * 0.9 + (t2 - t0 + (this.mode === 'camera' ? this.tracker.lastInferMs : 0)) * 0.1;
    this.stats.inferMs = this.stats.inferMs * 0.9 + this.tracker.lastInferMs * 0.1;
    this.stats.renderMs = this.stats.renderMs * 0.9 + (t2 - t1 + (t1 - t0)) * 0.1;
    if (t - this.fpsT >= 1) {
      this.stats.fps = this.frames / (t - this.fpsT);
      this.frames = 0;
      this.fpsT = t;
      this.cb.onStats?.({ ...this.stats });
      if (this.mode === 'camera') this.adapt();
    }
    if (this.mode === 'camera') this.updateGuidance(pose);
  }

  /** Step quality down if frames take too long on this device. */
  private adapt() {
    if (this.procMs > 55) this.slowFor++;
    else this.slowFor = Math.max(0, this.slowFor - 1);
    if (this.slowFor >= 4) {
      this.slowFor = 0;
      const next: QualityLevel | null = this.quality.level === 'quality' ? 'balanced' : this.quality.level === 'balanced' ? 'performance' : null;
      if (next) {
        this.setQuality(next);
        this.cb.onQuality?.(next, 'Switched to a lighter quality preset to keep tracking smooth.');
      }
    }
  }

  private setHint(h: string | null) {
    if (h === this.hint) return;
    this.hint = h;
    this.cb.onHint?.(h);
  }

  private updateGuidance(pose: PoseInput | null) {
    const rig = this.rig;
    if (!this.tracker.ready) return;
    if (!pose || !rig.hasPose) {
      this.cb.onStatus?.('searching', 'Looking for you…');
      this.setHint('Step into the frame so your head and shoulders are visible');
      return;
    }
    this.cb.onStatus?.('tracking');
    const v = rig.vis;
    const swFrac = rig.sw / rig.frameW;
    if (swFrac > 0.62) this.setHint('You are very close - step back a little');
    else if (Math.min(v[23], v[24]) < 0.4) this.setHint('Step back so your waist is in view for the best fit');
    else if (Math.min(v[27], v[28]) < 0.35 && this.wantsFullBody()) this.setHint('Step back to see the full length of this outfit');
    else this.setHint(null);
  }

  private wantsFullBody() {
    const b = this.selection?.slots.bottom;
    return !!b;
  }

  // -------------------------------------------------------------- capture
  capture(caption: string) {
    return this.renderer.capture(caption);
  }

  get recording() {
    return !!this.recorder && this.recorder.state === 'recording';
  }

  startRecording() {
    const canvas = this.renderer.renderer.domElement as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream };
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') throw new Error('Video recording is not supported in this browser.');
    const stream = canvas.captureStream(30);
    const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(250);
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const r = this.recorder;
      if (!r) return reject(new Error('not recording'));
      r.onstop = () => {
        const blob = new Blob(this.chunks, { type: r.mimeType || 'video/webm' });
        this.recorder = null;
        resolve(blob);
      };
      r.stop();
    });
  }

  // -------------------------------------------------------------- lifecycle
  private onVisibility = () => {
    if (!document.hidden) this.lastT = performance.now() / 1000;
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.stopSources();
    this.camera.stop();
    this.wardrobe.clear();
    this.tracker.close();
    this.renderer.dispose();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
