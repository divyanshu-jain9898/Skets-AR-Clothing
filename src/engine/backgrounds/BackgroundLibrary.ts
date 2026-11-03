import type { BackdropImage } from '../render/Backdrop';
import { BACKGROUND_MAP, OFFICE_PHOTO_URL, type BackgroundDef } from './catalog';
import type { PaintJob, SkyMask } from './paint/render';
import type { NRect } from './paint/scene';
import { deletePicture, getPicture, listPictures, putPicture, type StoredPicture } from './store';

interface PaintOut {
  image: CanvasImageSource & { width: number; height: number };
  w: number;
  h: number;
  sky: SkyMask | null;
  skyRects: NRect[];
  mean: [number, number, number];
}

type Pending = { job: PaintJob; priority: number; resolve: (r: PaintOut) => void; reject: (e: unknown) => void; transfer: Transferable[] };

/**
 * Paints jobs in a worker when it can (OffscreenCanvas + WebGL 2), otherwise
 * on the main thread. One job at a time, highest priority first, so the
 * background the user just tapped jumps ahead of thumbnails.
 */
class PaintService {
  private worker: Worker | null = null;
  private ready: Promise<void>;
  private queue: Pending[] = [];
  private busy = false;
  private seq = 1;
  private inflight = new Map<number, Pending>();

  constructor() {
    this.ready = new Promise((resolve) => {
      let w: Worker;
      try {
        w = new Worker(new URL('./paint/paint.worker.ts', import.meta.url), { type: 'module' });
      } catch {
        resolve();
        return;
      }
      // Don't hold painting back if the page is busy at start-up: paint on the
      // main thread meanwhile, and switch to the worker as soon as it answers.
      const timer = setTimeout(resolve, 8000);
      w.onmessage = (e) => {
        if (e.data?.type !== 'ready') return;
        clearTimeout(timer);
        if (e.data.gpu) {
          this.worker = w;
          w.onmessage = (ev) => this.onDone(ev.data);
          w.onerror = () => this.failWorker();
          void this.pump();
        } else {
          w.terminate();
        }
        resolve();
      };
      w.onerror = () => {
        clearTimeout(timer);
        w.terminate();
        resolve();
      };
    });
  }

  /** Where painting happens (for diagnostics). */
  get where(): Promise<'worker' | 'main'> {
    return this.ready.then(() => (this.worker ? 'worker' : 'main'));
  }

  paint(job: PaintJob, priority: number, transfer: Transferable[] = []): Promise<PaintOut> {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, priority, resolve, reject, transfer });
      void this.pump();
    });
  }

  private async pump() {
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    this.queue.sort((a, b) => b.priority - a.priority);
    const p = this.queue.shift()!;
    await this.ready;
    if (this.worker) {
      const id = this.seq++;
      this.inflight.set(id, p);
      this.worker.postMessage({ id, job: p.job }, p.transfer);
      return; // onDone continues the pump
    }
    try {
      // yield so the UI can show the "painting" state first
      await new Promise((r) => setTimeout(r, 16));
      const { renderJob } = await import('./paint/render');
      const r = renderJob(p.job);
      if ('image' in p.job && p.job.image) p.job.image.close();
      p.resolve({ image: r.canvas as PaintOut['image'], w: r.w, h: r.h, sky: r.sky, skyRects: r.skyRects, mean: r.mean });
    } catch (err) {
      p.reject(err);
    } finally {
      this.busy = false;
      void this.pump();
    }
  }

  private onDone(d: { type: string; id: number; ok: boolean; result?: PaintOut; error?: string; noGpu?: boolean; image?: ImageBitmap | null }) {
    if (d?.type !== 'done') return;
    const p = this.inflight.get(d.id);
    this.inflight.delete(d.id);
    if (d.noGpu) {
      // the worker can't paint on the GPU: retire it and paint here instead
      this.worker?.terminate();
      this.worker = null;
      if (p) {
        if ('image' in p.job && d.image) p.job = { ...p.job, image: d.image } as PaintJob;
        this.queue.push(p);
      }
      this.busy = false;
      void this.pump();
      return;
    }
    if (p) {
      if (d.ok && d.result) p.resolve(d.result);
      else p.reject(new Error(d.error ?? 'painting failed'));
    }
    this.busy = false;
    void this.pump();
  }

  private failWorker() {
    this.worker?.terminate();
    this.worker = null;
    for (const p of this.inflight.values()) p.reject(new Error('The painting worker stopped'));
    this.inflight.clear();
    this.busy = false;
    void this.pump();
  }
}

export interface UploadInfo {
  id: string;
  name: string;
}

const UPLOAD_PREFIX = 'upload:';
const OFFICE_KEY = 'office:photo';
const MAX_UPLOAD = 2560;

const isCompact = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || Math.max(window.screen?.width ?? 0, window.screen?.height ?? 0) < 900);

/**
 * Paints, caches and stores backgrounds:
 *  - thumbnails for the picker (small, low priority)
 *  - full-size backdrops matching the camera frame's orientation
 *  - user uploads and the office photo in IndexedDB
 */
export class BackgroundLibrary {
  private service = new PaintService();
  private full = new Map<string, Promise<BackdropImage>>();
  private fullOrder: string[] = [];
  private thumbs = new Map<string, Promise<string>>();
  private officePhoto: Promise<Blob | null> | null = null;
  /** Bumps when the office photo changes, so cached paintings are refreshed. */
  private officeRev = 0;
  uploads: UploadInfo[] = [];
  officeCustom = false;
  /** Turn bright office windows into a fireworks night sky. */
  officeWindows = true;

  async init() {
    void this.service.where.then((m) => console.info(`[backgrounds] painting on the ${m === 'worker' ? 'worker thread' : 'main thread'}`));
    const list = await listPictures(UPLOAD_PREFIX);
    this.uploads = list.map((p) => ({ id: p.id, name: p.name }));
    this.officeCustom = !!(await getPicture(OFFICE_KEY));
  }

  def(id: string): BackgroundDef | undefined {
    if (id.startsWith(UPLOAD_PREFIX)) {
      const u = this.uploads.find((x) => x.id === id);
      return u ? { id, name: u.name, category: 'custom', kind: 'custom', blurb: 'Your picture' } : undefined;
    }
    return BACKGROUND_MAP.get(id);
  }

  private get officeKey() {
    return `${this.officeRev}${this.officeWindows ? 'w' : ''}`;
  }

  /** Size of a full painting for a frame orientation. */
  private size(portrait: boolean) {
    const long = isCompact() ? 1600 : 1920;
    const short = Math.round((long * 9) / 16);
    return portrait ? { w: short, h: long } : { w: long, h: short };
  }

  private async officeSource(): Promise<Blob | null> {
    this.officePhoto ??= (async () => {
      const stored = await getPicture(OFFICE_KEY);
      if (stored) return stored.blob;
      if (OFFICE_PHOTO_URL) {
        try {
          const res = await fetch(new URL(OFFICE_PHOTO_URL, document.baseURI).href);
          if (res.ok && (res.headers.get('content-type') ?? '').startsWith('image/')) return await res.blob();
        } catch {
          /* fall back to the built-in office */
        }
      }
      return null;
    })();
    return this.officePhoto;
  }

  private async job(def: BackgroundDef, w: number, h: number): Promise<{ job: PaintJob; transfer: Transferable[] }> {
    if (def.kind === 'scene') return { job: { kind: 'scene', scene: def.scene!, w, h }, transfer: [] };
    if (def.kind === 'office') {
      const blob = await this.officeSource();
      const image = blob ? await decode(blob) : null;
      return { job: { kind: 'office', image, w, h, windows: this.officeWindows }, transfer: image ? [image] : [] };
    }
    if (def.kind === 'custom') {
      const p = await getPicture(def.id);
      if (!p) throw new Error('That picture is no longer stored on this device.');
      const image = await decode(p.blob);
      return { job: { kind: 'photo', image, w, h }, transfer: [image] };
    }
    throw new Error(`"${def.name}" is not a picture background`);
  }

  /** Full-size backdrop for the current frame orientation (cached, LRU of 3). */
  backdrop(id: string, portrait: boolean): Promise<BackdropImage> {
    const def = this.def(id);
    if (!def) return Promise.reject(new Error('Unknown background'));
    const key = `${id}|${portrait ? 'p' : 'l'}|${def.kind === 'office' ? this.officeKey : 0}`;
    let p = this.full.get(key);
    if (!p) {
      const { w, h } = this.size(portrait);
      p = this.job(def, w, h)
        .then(({ job, transfer }) => this.service.paint(job, 10, transfer))
        .then((r) => ({ kind: 'image' as const, id, image: toCanvas(r.image), sky: r.sky, skyRects: r.skyRects, mean: r.mean }));
      p.catch(() => this.full.delete(key));
      this.full.set(key, p);
    }
    this.fullOrder = [key, ...this.fullOrder.filter((k) => k !== key)];
    for (const old of this.fullOrder.slice(3)) this.full.delete(old);
    this.fullOrder = this.fullOrder.slice(0, 3);
    return p;
  }

  /** Small preview (object URL) for the picker cards. */
  thumbnail(id: string): Promise<string> {
    const def = this.def(id);
    if (!def) return Promise.reject(new Error('Unknown background'));
    const key = `${id}|${def.kind === 'office' ? this.officeKey : 0}`;
    let p = this.thumbs.get(key);
    if (!p) {
      p = this.job(def, 400, 300)
        .then(({ job, transfer }) => this.service.paint(job, def.kind === 'office' ? 2 : 1, transfer))
        .then((r) => toObjectUrl(r.image));
      p.catch(() => this.thumbs.delete(key));
      this.thumbs.set(key, p);
    }
    return p;
  }

  /** Stores a user picture (downscaled) and returns its id. */
  async addUpload(file: Blob, name: string): Promise<UploadInfo> {
    const blob = await shrink(file, MAX_UPLOAD);
    const id = `${UPLOAD_PREFIX}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
    const clean = name.replace(/\.[a-z0-9]+$/i, '').slice(0, 40) || 'My picture';
    const pic: StoredPicture = { id, name: clean, blob, createdAt: Date.now() };
    await putPicture(pic);
    const info = { id, name: clean };
    this.uploads = [...this.uploads, info];
    return info;
  }

  async removeUpload(id: string) {
    await deletePicture(id);
    this.uploads = this.uploads.filter((u) => u.id !== id);
    for (const k of [...this.full.keys()]) if (k.startsWith(`${id}|`)) this.full.delete(k);
    for (const k of [...this.thumbs.keys()]) if (k.startsWith(`${id}|`)) this.thumbs.delete(k);
  }

  /** Replaces the office photo; the Diwali painting is regenerated from it. */
  async setOfficePhoto(file: Blob | null) {
    if (file) await putPicture({ id: OFFICE_KEY, name: 'Office', blob: await shrink(file, MAX_UPLOAD), createdAt: Date.now() });
    else await deletePicture(OFFICE_KEY);
    this.officeCustom = !!file;
    this.officePhoto = null;
    this.officeRev++;
  }
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw new Error('This file could not be read as an image. Try a JPEG or PNG.');
    }
  }
}

/** Downscales big pictures to keep storage small (JPEG). */
async function shrink(file: Blob, max: number): Promise<Blob> {
  const bmp = await decode(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (s === 1 && file.size < 4_000_000 && /jpe?g|png|webp/.test(file.type)) {
    bmp.close();
    return file;
  }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not process the image'))), 'image/jpeg', 0.9));
}

function toCanvas(img: PaintOut['image']): HTMLCanvasElement {
  if (img instanceof HTMLCanvasElement) return img;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.drawImage(img, 0, 0);
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
  return c;
}

async function toObjectUrl(img: PaintOut['image']): Promise<string> {
  const c = toCanvas(img);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.86));
  const b = blob ?? (await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.88)));
  return b ? URL.createObjectURL(b) : c.toDataURL('image/jpeg', 0.88);
}
