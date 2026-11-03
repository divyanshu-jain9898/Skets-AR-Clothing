import {
  bokeh,
  ctx2d,
  diya,
  diyaFlame,
  drawBulbs,
  drawWindows,
  firework,
  glow,
  gradientSky,
  lantern,
  lanternGlow,
  lerp,
  makeCanvas,
  marigoldGarland,
  marigoldStrand,
  rand,
  rangoli,
  rgba,
  sagPath,
  skyline,
  stars,
  stringLights,
  vignette,
  wash,
  withBlend,
  type AnyCanvas,
  type Bulb,
  type Ctx,
  type Pt,
  type Rng,
} from './kit';
import type { Painterly } from './painterly';
import type { NRect } from './scene';
import type { SkyMask } from './render';
import { drawOfficeBase } from './officeBase';

const SKY_RES = 160;

export interface OfficePainting {
  canvas: AnyCanvas;
  sky: SkyMask | null;
  skyRects: NRect[];
}

/**
 * "My Office - Diwali Edition": converts a photo of an office into a festive
 * canvas painting while keeping its architecture and furniture recognisable.
 *
 *  1. Crop to the frame's orientation, so decorations land in view.
 *  2. Find windows (large, bright, low-saturation regions in the upper part)
 *     and turn them into a Diwali night sky with fireworks and city lights.
 *  3. Evening grade: warmer and dimmer, so festive lights carry the scene.
 *  4. Decorations: marigold garlands, fairy lights, akash kandils, diyas
 *     along the floor, a rangoli at the centre.
 *  5. Oil-on-canvas pass, then the light sources and glows on top.
 *
 * Without a photo it paints a modern office from scratch and runs it through
 * exactly the same conversion.
 */
export function paintOffice(image: ImageBitmap | null, w: number, h: number, painter: Painterly | null, rng: Rng, opts: { windows?: boolean } = {}): OfficePainting {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  if (image) drawCover(g, image, w, h);
  else drawOfficeBase(g, w, h, rng);

  const win = opts.windows === false ? null : detectWindows(c, w, h);
  eveningGrade(g, w, h);
  const skyRects: NRect[] = [];
  if (win) {
    paintNightWindows(g, rng, w, h, win);
    for (const r of win.rects) skyRects.push([r[0], r[1], r[2], lerp(r[1], r[3], 0.7)]);
  }
  const deco = decorate(g, rng, w, h);

  let out: AnyCanvas = c;
  if (painter) {
    try {
      out = painter.apply(c as TexImageSource, w, h, {
        radius: Math.max(2, Math.min(8, Math.max(w, h) / 255)),
        strokes: 0.95,
        weave: 0.9,
        saturation: 1.12,
        warmth: 0.35,
        contrast: 1.05,
      });
    } catch (err) {
      console.warn('[office] painterly pass failed', err);
    }
  }
  const og = ctx2d(out);
  deco.lights(og);
  vignette(og, w, h, 0.35, '#1a0a04');

  let sky: SkyMask | null = null;
  if (win) {
    const s = SKY_RES / Math.max(w, h);
    const mw = Math.max(8, Math.round(w * s));
    const mh = Math.max(8, Math.round(h * s));
    const mc = makeCanvas(mw, mh);
    const mg = ctx2d(mc);
    mg.drawImage(win.canvas as CanvasImageSource, 0, 0, mw, mh);
    const d = mg.getImageData(0, 0, mw, mh).data;
    const data = new Uint8Array(mw * mh);
    for (let i = 0; i < data.length; i++) data[i] = d[i * 4 + 3];
    sky = { data, w: mw, h: mh };
  }
  return { canvas: out, sky, skyRects };
}

/** Draws the image cropped to cover w x h (centred, slightly favouring the top). */
function drawCover(g: Ctx, img: ImageBitmap, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) * 0.45;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

interface Windows {
  /** Soft window mask at small resolution (alpha). */
  canvas: AnyCanvas;
  rects: NRect[];
}

/**
 * Windows in a daytime office photo are the brightest large, near-white or
 * sky-blue regions in the upper part of the frame. Small ceiling lamps,
 * huge white walls and anything ragged are rejected.
 */
function detectWindows(src: AnyCanvas, w: number, h: number): Windows | null {
  const s = 160 / Math.max(w, h);
  const sw = Math.max(16, Math.round(w * s));
  const sh = Math.max(16, Math.round(h * s));
  const small = makeCanvas(sw, sh);
  const sg = ctx2d(small);
  sg.drawImage(src as CanvasImageSource, 0, 0, sw, sh);
  const d = sg.getImageData(0, 0, sw, sh).data;
  const N = sw * sh;
  const L = new Float32Array(N);
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const r = d[i * 4] / 255;
    const gg = d[i * 4 + 1] / 255;
    const b = d[i * 4 + 2] / 255;
    L[i] = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    sum += L[i];
  }
  if (sum / N < 0.22) return null; // a night photo: windows are already dark
  const sorted = Float32Array.from(L).sort();
  const p97 = sorted[Math.floor(N * 0.97)];
  const thr = Math.max(0.78, p97 - 0.08);
  const cand = new Uint8Array(N);
  for (let y = 0; y < sh * 0.82; y++)
    for (let x = 0; x < sw; x++) {
      const i = y * sw + x;
      const r = d[i * 4] / 255;
      const gg = d[i * 4 + 1] / 255;
      const b = d[i * 4 + 2] / 255;
      const mx = Math.max(r, gg, b);
      const sat = mx > 0 ? (mx - Math.min(r, gg, b)) / mx : 0;
      if (L[i] > thr && (sat < 0.3 || b > r + 0.05)) cand[i] = 1;
    }
  // connected components
  const label = new Int32Array(N).fill(-1);
  const comps: { area: number; x0: number; y0: number; x1: number; y1: number; lum: number; id: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!cand[i] || label[i] >= 0) continue;
    const id = comps.length;
    const c = { area: 0, x0: sw, y0: sh, x1: 0, y1: 0, lum: 0, id };
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % sw;
      const y = (k / sw) | 0;
      c.area++;
      c.lum += L[k];
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      const nb = [k - 1, k + 1, k - sw, k + sw];
      for (let j = 0; j < 4; j++) {
        const q = nb[j];
        if (q < 0 || q >= N) continue;
        if ((j === 0 && x === 0) || (j === 1 && x === sw - 1)) continue;
        if (cand[q] && label[q] < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    comps.push(c);
  }
  const candidates = comps
    .filter((c) => {
      const bw = c.x1 - c.x0 + 1;
      const bh = c.y1 - c.y0 + 1;
      const fill = c.area / (bw * bh);
      // windows are fairly compact, reach into the upper half and are clearly bright
      return c.area >= N * 0.006 && c.area <= N * 0.4 && fill >= 0.4 && bh >= sh * 0.05 && bw >= sw * 0.035 && bw <= bh * 5 && c.y0 < sh * 0.55 && c.lum / c.area > 0.84;
    })
    .sort((a, b) => b.area - a.area);
  // never turn more than ~40 % of the picture into sky
  let total = 0;
  const keep = [];
  for (const c of candidates) {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    if (total + bw * bh > N * 0.4) continue;
    total += bw * bh;
    keep.push(c);
    if (keep.length === 4) break;
  }
  if (!keep.length) return null;
  // A window is a rectangle: inside each accepted region's bounds, everything
  // that isn't dark frame (buildings, trees, the haze below the sky) is view.
  const m = new Float32Array(N);
  for (const c of keep)
    for (let y = c.y0; y <= c.y1; y++)
      for (let x = c.x0; x <= c.x1; x++) {
        const i = y * sw + x;
        if (label[i] === c.id || L[i] > 0.55) m[i] = 1;
      }
  const blur = (src: Float32Array) => {
    const dst = new Float32Array(N);
    for (let y = 0; y < sh; y++)
      for (let x = 0; x < sw; x++) {
        let a = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
            const wgt = dx === 0 && dy === 0 ? 2 : 1;
            a += src[yy * sw + xx] * wgt;
            n += wgt;
          }
        dst[y * sw + x] = a / n;
      }
    return dst;
  };
  const soft = blur(blur(m));
  const mc = makeCanvas(sw, sh);
  const mg = ctx2d(mc);
  const id = mg.createImageData(sw, sh);
  for (let i = 0; i < N; i++) id.data.set([255, 255, 255, Math.round(Math.min(1, soft[i] * 1.3) * 255)], i * 4);
  mg.putImageData(id, 0, 0);
  return { canvas: mc, rects: keep.map((c) => [c.x0 / sw, c.y0 / sh, (c.x1 + 1) / sw, (c.y1 + 1) / sh] as NRect) };
}

/** Warmer, dimmer evening light so the festive lights carry the room. */
function eveningGrade(g: Ctx, w: number, h: number) {
  withBlend(g, 'multiply', () => {
    g.fillStyle = '#d9bfac';
    g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#b9a0a8');
    v.addColorStop(0.45, '#ffffff');
    v.addColorStop(1, '#d9c2b0');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
  withBlend(g, 'soft-light', () => {
    g.fillStyle = 'rgba(255,140,40,0.18)';
    g.fillRect(0, 0, w, h);
  });
}

/** Replaces window regions with a Diwali night: sky, city lights and fireworks. */
function paintNightWindows(g: Ctx, rng: Rng, w: number, h: number, win: Windows) {
  const night = makeCanvas(w, h);
  const ng = ctx2d(night);
  gradientSky(ng, 0, 0, w, h, [
    [0, '#090b2e'],
    [0.35, '#1d1650'],
    [0.62, '#4a1f63'],
    [0.85, '#8a3a5c'],
    [1, '#c9643f'],
  ]);
  const u = Math.min(w, h);
  stars(ng, rng, 0, 0, w, h * 0.6, 160, u * 0.0022);
  const palette = ['#ff4fa3', '#ffd166', '#5ad1ff', '#ff7a3d', '#b78bff', '#7dffb0'];
  const lit: ReturnType<typeof skyline> = [];
  win.rects.forEach((r, i) => {
    const x0 = r[0] * w;
    const y0 = r[1] * h;
    const x1 = r[2] * w;
    const y1 = r[3] * h;
    const ww = x1 - x0;
    const wh = y1 - y0;
    // fireworks in the upper part of each window
    const bursts = ww > wh * 1.4 ? 3 : 2;
    for (let k = 0; k < bursts; k++) {
      const bx = x0 + ww * ((k + 0.5) / bursts + rand(rng, -0.08, 0.08));
      const by = y0 + wh * rand(rng, 0.22, 0.42);
      const br = Math.min(ww / bursts, wh) * rand(rng, 0.32, 0.45);
      firework(ng, rng, bx, by, br, palette[(i * 3 + k) % palette.length], (['peony', 'willow', 'chrysanthemum', 'ring'] as const)[(i + k) % 4]);
    }
    // distant skyline at the bottom of the window
    lit.push(...skyline(ng, rng, x0 - ww * 0.05, x1 + ww * 0.05, y1 + 1, wh * 0.32, '#140c24', { temples: ww > u * 0.3 ? 1 : 0 }));
    glow(ng, (x0 + x1) / 2, y1, ww * 0.6, '#ff8a3d', 0.18);
  });
  drawWindows(ng, lit);
  // keep only the window regions
  withBlend(ng, 'destination-in', () => {
    ng.imageSmoothingEnabled = true;
    ng.drawImage(win.canvas as CanvasImageSource, 0, 0, w, h);
  });
  g.drawImage(night as CanvasImageSource, 0, 0);
}

/** Lays out the decorations: bodies now (painted), light sources later. */
function decorate(g: Ctx, rng: Rng, w: number, h: number) {
  const u = Math.min(w, h);
  const portrait = h > w;
  const bulbs: Bulb[] = [];
  const flames: { p: Pt; s: number }[] = [];
  const lanterns: { x: number; y: number; s: number; c: string }[] = [];

  // fairy lights in swags just under the top edge
  const swags = portrait ? 2 : 3;
  for (let i = 0; i < swags; i++) {
    const a = { x: (w * i) / swags, y: h * 0.035 };
    const b = { x: (w * (i + 1)) / swags, y: h * 0.035 };
    bulbs.push(...stringLights(g, rng, a, b, h * (portrait ? 0.05 : 0.075), portrait ? 11 : 14, ['#ffd27a', '#ff9a3c', '#ffe9b0', '#ff6fa8'], u * 0.0055));
  }
  // marigold garland swags along the very top
  for (let i = 0; i < swags; i++) {
    const a = { x: (w * i) / swags, y: -u * 0.01 };
    const b = { x: (w * (i + 1)) / swags, y: -u * 0.01 };
    marigoldGarland(g, rng, sagPath(a, b, h * (portrait ? 0.035 : 0.05), 24), u * 0.016);
  }
  // hanging marigold strands at the far edges
  for (const x of [w * 0.015, w * 0.985]) marigoldStrand(g, rng, x, u * 0.02, h * (portrait ? 0.32 : 0.42), u * 0.014);
  // curtain lights down both sides
  for (const side of [0, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = side ? w * (0.955 - k * 0.018) : w * (0.045 + k * 0.018);
      for (let y = h * 0.08; y < h * (0.5 + k * 0.06); y += u * 0.035) bulbs.push({ x: x + rand(rng, -1, 1), y, color: k % 2 ? '#ffd27a' : '#ffb15c', r: u * 0.0045 });
    }
  }
  // akash kandils
  const lx = portrait ? [0.17, 0.83] : [0.13, 0.87];
  const ly = portrait ? [0.2, 0.23] : [0.27, 0.31];
  const lc = ['#e2412b', '#d6247b'];
  lx.forEach((fx, i) => {
    const s = u * (portrait ? 0.13 : 0.12);
    const x = w * fx;
    const y = h * ly[i];
    lantern(g, rng, x, 0, y, s, lc[i], i ? 'star' : 'kandil');
    lanterns.push({ x, y, s, c: i ? '#ff6fb0' : '#ff8a3d' });
  });
  // rangoli at the centre of the floor, with diyas
  const rr = u * (portrait ? 0.24 : 0.2);
  const rcy = h * 0.96;
  const rf = rangoli(g, rng, w * 0.5, rcy, rr, { tilt: 0.3, diyas: 10, petals: 12 });
  for (const p of rf) flames.push({ p, s: p.s });
  // rows of diyas along the floor at both sides
  const n = portrait ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const s = u * rand(rng, 0.05, 0.062);
    for (const side of [-1, 1]) {
      const t = i / Math.max(1, n - 1);
      const x = w * 0.5 + side * w * lerp(portrait ? 0.3 : 0.24, 0.45, t);
      const y = h * (0.93 + 0.035 * t);
      flames.push({ p: diya(g, x, y, s, { dir: side > 0 ? -1 : 1 }), s });
    }
  }
  return {
    lights(lg: Ctx) {
      // warm light pools around the lamps
      for (const f of flames) wash(lg, f.p.x, f.p.y + f.s * 0.3, f.s * 2.4, f.s * 0.9, '#ff9a3c', 0.12);
      withBlend(lg, 'screen', () => {
        const grd = lg.createRadialGradient(w / 2, h * 1.05, 0, w / 2, h * 1.05, h * 0.7);
        grd.addColorStop(0, rgba('#ffb35c', 0.28));
        grd.addColorStop(1, rgba('#ffb35c', 0));
        lg.fillStyle = grd;
        lg.fillRect(0, 0, w, h);
      });
      for (const l of lanterns) lanternGlow(lg, l.x, l.y, l.s, l.c);
      bokeh(lg, rng, 0, 0, w, h * 0.35, 18, ['#ffcf7a', '#ff9a5c', '#ffd9a0'], u * 0.012, u * 0.035, 0.18);
      drawBulbs(lg, bulbs);
      for (const f of flames) diyaFlame(lg, rng, f.p.x, f.p.y, f.s);
    },
  };
}

