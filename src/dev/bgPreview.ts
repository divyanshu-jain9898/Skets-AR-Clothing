/**
 * Dev-only preview for the painted backgrounds (not part of the app bundle).
 * Open /dev/backgrounds.html?scene=crackers&w=1600&h=900[&stage=base|sky][&seed=1]
 * scene=office renders the built-in office; add &photo=<url> to convert a photo.
 */
import { renderJob, rasterMask } from '../engine/backgrounds/paint/render';
import { SCENES } from '../engine/backgrounds/paint/scenes';
import { ctx2d, makeCanvas, mulberry32 } from '../engine/backgrounds/paint/kit';

declare global {
  interface Window {
    __done?: boolean;
    __error?: string;
    __ms?: number;
  }
}

async function main() {
  const q = new URLSearchParams(location.search);
  const scene = q.get('scene') ?? 'crackers';
  const w = Number(q.get('w') ?? 1600);
  const h = Number(q.get('h') ?? 900);
  const seed = q.has('seed') ? Number(q.get('seed')) : undefined;
  const stage = q.get('stage') ?? 'final';
  const info = document.getElementById('info')!;
  const out = document.getElementById('out')!;
  const t0 = performance.now();
  let canvas: HTMLCanvasElement | OffscreenCanvas;
  if (scene === 'office') {
    const photo = q.get('photo');
    const image = photo ? await createImageBitmap(await (await fetch(photo)).blob()) : null;
    const r = renderJob({ kind: 'office', image, w, h, seed });
    canvas = stage === 'sky' && r.sky ? maskCanvas(r.sky.data, r.sky.w, r.sky.h) : r.canvas;
    info.textContent = `office ${r.w}x${r.h} skyRects=${JSON.stringify(r.skyRects)} mean=${r.mean.map((v) => v.toFixed(2))}`;
  } else if (stage === 'base' || stage === 'sky') {
    const plan = SCENES[scene].compose(w, h, mulberry32(seed ?? 1));
    if (stage === 'base') {
      canvas = makeCanvas(w, h);
      plan.base(ctx2d(canvas));
    } else {
      const m = rasterMask(w, h, (g) => plan.sky?.(g));
      canvas = maskCanvas(m.data, m.w, m.h);
    }
    info.textContent = `${scene} ${stage}`;
  } else {
    const r = renderJob({ kind: 'scene', scene, w, h, seed });
    canvas = r.canvas;
    info.textContent = `${scene} ${w}x${h} skyRects=${JSON.stringify(r.skyRects)} mean=${r.mean.map((v) => v.toFixed(2))}`;
  }
  window.__ms = performance.now() - t0;
  const show = document.createElement('canvas');
  show.id = 'result';
  show.width = canvas.width;
  show.height = canvas.height;
  show.getContext('2d')!.drawImage(canvas as CanvasImageSource, 0, 0);
  out.appendChild(show);
  info.textContent += ` in ${window.__ms.toFixed(0)} ms`;
  window.__done = true;
}

function maskCanvas(data: Uint8Array, w: number, h: number) {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const id = g.createImageData(w, h);
  for (let i = 0; i < data.length; i++) id.data.set([data[i], data[i], data[i], 255], i * 4);
  g.putImageData(id, 0, 0);
  return c;
}

main().catch((err) => {
  window.__error = String(err?.stack ?? err);
  document.getElementById('info')!.textContent = window.__error;
  window.__done = true;
});
