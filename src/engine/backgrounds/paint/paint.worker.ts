/// <reference lib="webworker" />
/**
 * Paints backgrounds off the main thread so the live camera stays smooth.
 * Needs OffscreenCanvas with 2D and WebGL 2. It reports readiness from cheap
 * feature checks (creating a GPU context can stall while the page is busy);
 * if WebGL 2 then fails on the first job, the job is handed back with
 * `noGpu` and the app paints on the main thread instead.
 */
import { getPainter, renderJob, type PaintJob } from './render';

declare const self: DedicatedWorkerGlobalScope;

let ok = false;
try {
  ok = typeof OffscreenCanvas !== 'undefined' && typeof WebGL2RenderingContext !== 'undefined' && !!new OffscreenCanvas(2, 2).getContext('2d');
} catch {
  ok = false;
}
self.postMessage({ type: 'ready', gpu: ok });

self.onmessage = (e: MessageEvent<{ id: number; job: PaintJob }>) => {
  const { id, job } = e.data;
  if (!getPainter()) {
    // no WebGL 2 here after all: give the job (and its picture) back
    const image = 'image' in job ? job.image : null;
    self.postMessage({ type: 'done', id, ok: false, noGpu: true, image }, image ? [image] : []);
    return;
  }
  try {
    const r = renderJob(job);
    const bmp = (r.canvas as OffscreenCanvas).transferToImageBitmap();
    const transfer: Transferable[] = [bmp];
    if (r.sky) transfer.push(r.sky.data.buffer);
    self.postMessage({ type: 'done', id, ok: true, result: { image: bmp, w: r.w, h: r.h, sky: r.sky, skyRects: r.skyRects, mean: r.mean } }, transfer);
  } catch (err) {
    self.postMessage({ type: 'done', id, ok: false, error: err instanceof Error ? err.message : String(err) });
  } finally {
    if ('image' in job && job.image) job.image.close();
  }
};
