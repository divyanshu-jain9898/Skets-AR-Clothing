/// <reference lib="webworker" />
/**
 * Paints backgrounds off the main thread so the live camera stays smooth.
 * Needs OffscreenCanvas with 2D and WebGL 2; otherwise it reports `gpu:false`
 * and the app paints on the main thread instead.
 */
import { renderJob, type PaintJob } from './render';

declare const self: DedicatedWorkerGlobalScope;

// cheap capability check; the paint shaders compile on the first job
let ok = false;
try {
  ok = typeof OffscreenCanvas !== 'undefined' && !!new OffscreenCanvas(2, 2).getContext('2d') && !!new OffscreenCanvas(2, 2).getContext('webgl2');
} catch {
  ok = false;
}
self.postMessage({ type: 'ready', gpu: ok });

self.onmessage = (e: MessageEvent<{ id: number; job: PaintJob }>) => {
  const { id, job } = e.data;
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
