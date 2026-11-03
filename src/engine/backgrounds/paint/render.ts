import { ctx2d, makeCanvas, mulberry32, type AnyCanvas } from './kit';
import { Painterly } from './painterly';
import type { NRect } from './scene';
import { SCENES } from './scenes';
import { paintOffice } from './office';

/** What to paint. Sizes are output pixels. */
export type PaintJob =
  | { kind: 'scene'; scene: string; w: number; h: number; seed?: number }
  /** Diwali canvas painting of an office photo; no image = the built-in painted office. */
  | { kind: 'office'; image: ImageBitmap | null; w: number; h: number; seed?: number; windows?: boolean }
  /** A user's own picture, fitted and lightly graded (not repainted). */
  | { kind: 'photo'; image: ImageBitmap; w: number; h: number };

export interface SkyMask {
  data: Uint8Array;
  w: number;
  h: number;
}

export interface PaintResult {
  canvas: AnyCanvas;
  w: number;
  h: number;
  /** Where live fireworks may show (white = open sky). */
  sky: SkyMask | null;
  skyRects: NRect[];
  /** Average colour 0..1, used to blend the person into the scene. */
  mean: [number, number, number];
}

let painter: Painterly | null | undefined;
/** Lazily created GPU painter (null when WebGL 2 is unavailable here). */
export function getPainter() {
  if (painter === undefined) painter = Painterly.create();
  return painter;
}


const SKY_RES = 160;

/** Kuwahara radius for an output size: ~5 px at 1920, never below 2. */
export const paintRadius = (w: number, h: number, scale = 1) => Math.max(2, Math.min(7, (Math.max(w, h) / 380) * scale));

export function renderJob(job: PaintJob): PaintResult {
  if (job.kind === 'photo') return finishPhoto(job.image, job.w, job.h);
  if (job.kind === 'office') {
    const r = paintOffice(job.image, job.w, job.h, getPainter(), mulberry32(job.seed ?? 108), { windows: job.windows });
    return { ...r, w: r.canvas.width, h: r.canvas.height, mean: meanColor(r.canvas) };
  }
  const spec = SCENES[job.scene];
  if (!spec) throw new Error(`Unknown scene "${job.scene}"`);
  const { w, h } = job;
  const rng = mulberry32(job.seed ?? hashString(job.scene));
  const plan = spec.compose(w, h, rng);
  const base = makeCanvas(w, h);
  plan.base(ctx2d(base));
  let out: AnyCanvas = base;
  const p = getPainter();
  if (p) {
    const { radiusScale = 1, ...rest } = plan.painterly ?? {};
    try {
      out = p.apply(base as TexImageSource, w, h, { radius: paintRadius(w, h, radiusScale), ...rest });
    } catch (err) {
      console.warn('[paint] painterly pass failed, using the unfiltered scene', err);
    }
  }
  plan.lights?.(ctx2d(out));
  let sky: SkyMask | null = null;
  if (plan.sky) sky = rasterMask(w, h, (g) => plan.sky!(g));
  return { canvas: out, w, h, sky, skyRects: plan.skyRects ?? [], mean: meanColor(out) };
}

/** Draws `fn` (in full-size coordinates) onto a small black canvas and keeps the red channel. */
export function rasterMask(w: number, h: number, fn: (g: ReturnType<typeof ctx2d>) => void): SkyMask {
  const s = SKY_RES / Math.max(w, h);
  const mw = Math.max(8, Math.round(w * s));
  const mh = Math.max(8, Math.round(h * s));
  const c = makeCanvas(mw, mh);
  const g = ctx2d(c);
  g.fillStyle = '#000';
  g.fillRect(0, 0, mw, mh);
  g.save();
  g.scale(mw / w, mh / h);
  fn(g);
  g.restore();
  const d = g.getImageData(0, 0, mw, mh).data;
  const data = new Uint8Array(mw * mh);
  for (let i = 0; i < data.length; i++) data[i] = d[i * 4];
  return { data, w: mw, h: mh };
}

export function meanColor(c: AnyCanvas): [number, number, number] {
  const s = makeCanvas(16, 16);
  const g = ctx2d(s);
  g.drawImage(c as CanvasImageSource, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  let r = 0;
  let gg = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    gg += d[i + 1];
    b += d[i + 2];
  }
  const n = (d.length / 4) * 255;
  return [r / n, gg / n, b / n];
}

/** Custom uploads: scale down to the target size (keeping aspect), no repainting. */
function finishPhoto(img: ImageBitmap, maxW: number, maxH: number): PaintResult {
  const s = Math.min(1, Math.max(maxW, maxH) / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  return { canvas: c, w, h, sky: null, skyRects: [], mean: meanColor(c) };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
