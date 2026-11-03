import {
  anar,
  bokeh,
  chakri,
  ctx2d,
  diya,
  diyaFlame,
  drawBulbs,
  fork,
  firework,
  glow,
  gradientSky,
  lerp,
  makeCanvas,
  mix,
  rand,
  rangoli,
  rgba,
  smoke,
  vignette,
  wash,
  withBlend,
  type AnyCanvas,
  type Bulb,
  type BurstKind,
  type Ctx,
  type Pt,
  type Rng,
} from './kit';
import type { Painterly } from './painterly';
import type { NRect } from './scene';
import type { SkyMask } from './render';

const SKY_RES = 160;

/** Open sky found in an outdoor photo (small resolution, 0..1). */
export interface PhotoSky {
  mask: Float32Array;
  w: number;
  h: number;
}

/**
 * Finds the open sky in an outdoor photo: a smooth, bright, bluish (or
 * white-overcast) region grown from the top edge. Neighbouring pixels join
 * only if their colour is close, so a white facade next to the sky stays out.
 * Returns null for indoor photos.
 */
export function detectPhotoSky(img: ImageBitmap): PhotoSky | null {
  const S = 200 / Math.max(img.width, img.height);
  const sw = Math.max(16, Math.round(img.width * S));
  const sh = Math.max(16, Math.round(img.height * S));
  const c = makeCanvas(sw, sh);
  const g = ctx2d(c);
  g.drawImage(img, 0, 0, sw, sh);
  const d = g.getImageData(0, 0, sw, sh).data;
  const N = sw * sh;
  const R = new Float32Array(N);
  const G = new Float32Array(N);
  const B = new Float32Array(N);
  const cand = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = d[i * 4] / 255;
    const gg = d[i * 4 + 1] / 255;
    const b = d[i * 4 + 2] / 255;
    R[i] = r;
    G[i] = gg;
    B[i] = b;
    const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const mx = Math.max(r, gg, b);
    const sat = mx > 0 ? (mx - Math.min(r, gg, b)) / mx : 0;
    if ((b > 0.5 && b - r > 0.025 && L > 0.45) || (L > 0.88 && b >= r - 0.01 && sat < 0.12)) cand[i] = 1;
  }
  const sky = new Uint8Array(N);
  const stack: number[] = [];
  let topCover = 0;
  for (let x = 0; x < sw; x++)
    if (cand[x]) {
      sky[x] = 1;
      stack.push(x);
      topCover++;
    }
  if (topCover < sw * 0.3) return null;
  let area = topCover;
  while (stack.length) {
    const k = stack.pop()!;
    const x = k % sw;
    const nb = [k - 1, k + 1, k - sw, k + sw];
    for (let j = 0; j < 4; j++) {
      const q = nb[j];
      if (q < 0 || q >= N || sky[q] || !cand[q]) continue;
      if ((j === 0 && x === 0) || (j === 1 && x === sw - 1)) continue;
      const dr = R[q] - R[k];
      const dg = G[q] - G[k];
      const db = B[q] - B[k];
      if (dr * dr + dg * dg + db * db > 0.0049) continue; // colour must change smoothly
      sky[q] = 1;
      area++;
      stack.push(q);
    }
  }
  if (area < N * 0.1) return null;
  const mask = new Float32Array(N);
  // light blur so the edge is soft
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      let a = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= sw || yy >= sh) continue;
          a += sky[yy * sw + xx];
          n++;
        }
      mask[y * sw + x] = a / n;
    }
  return { mask, w: sw, h: sh };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Outdoor photo (a building or campus) as a Diwali night canvas painting:
 * the sky turns into a night sky full of fireworks and sky lanterns, the
 * rooflines are outlined with lights, light strings cascade down the
 * facades, and diyas, a rangoli and firecrackers line the ground. On wide
 * screens the photo stays whole and festive neighbouring houses are painted
 * at the sides.
 */
export function paintExterior(image: ImageBitmap, w: number, h: number, painter: Painterly | null, parent: Rng, sky: PhotoSky): { canvas: AnyCanvas; sky: SkyMask; skyRects: NRect[] } {
  const rng = fork(parent);
  const u = Math.min(w, h);
  const c = makeCanvas(w, h);
  const g = ctx2d(c);

  // ---- placement: whole photo with painted flanks, or a cover crop
  const ia = image.width / image.height;
  const ta = w / h;
  let rect: Rect;
  let src: Rect;
  if (ia < ta * 0.92) {
    const pw = h * ia;
    rect = { x: (w - pw) / 2, y: 0, w: pw, h };
    src = { x: 0, y: 0, w: image.width, h: image.height };
  } else {
    const s = Math.max(w / image.width, h / image.height);
    const cw = w / s;
    const ch = h / s;
    rect = { x: 0, y: 0, w, h };
    // centred horizontally; vertically keep the ground (the person stands on it)
    src = { x: (image.width - cw) / 2, y: (image.height - ch) * 0.7, w: cw, h: ch };
  }
  const flanked = rect.w < w - 1;
  const groundY = rect.y + rect.h * 0.93;

  // ---- flanking houses (night colours), drawn first so the photo overlaps them
  const flankBulbs: Bulb[] = [];
  const flankWindows: { x: number; y: number; w: number; h: number }[] = [];
  const flankRoofs: { x0: number; x1: number; y: number }[] = [];
  const feather = rect.w * 0.07;
  if (flanked) {
    gradientSky(g, 0, 0, w, h, [
      [0, '#0a0c2c'],
      [1, '#23203f'],
    ]);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : rect.x + rect.w - feather;
      const x1 = side < 0 ? rect.x + feather : w;
      let x = side < 0 ? x1 : x0;
      while (side < 0 ? x > x0 : x < x1) {
        const bw = (x1 - x0) * rand(rng, 0.32, 0.55);
        const bh = h * rand(rng, 0.2, 0.4);
        const bx = side < 0 ? x - bw : x;
        const by = groundY - bh;
        const fg = g.createLinearGradient(0, by, 0, groundY);
        fg.addColorStop(0, mix('#20243c', '#2a2236', rng()));
        fg.addColorStop(1, '#12131f');
        g.fillStyle = fg;
        g.fillRect(bx, by, bw + 1, bh + 2);
        // parapet
        g.fillStyle = '#121426';
        g.fillRect(bx - bw * 0.02, by - u * 0.01, bw * 1.04, u * 0.012);
        flankRoofs.push({ x0: bx, x1: bx + bw, y: by - u * 0.01 });
        // windows
        const cols = Math.max(2, Math.round(bw / (u * 0.07)));
        const rows = Math.max(2, Math.round(bh / (u * 0.09)));
        for (let r = 0; r < rows; r++)
          for (let k = 0; k < cols; k++) {
            if (rng() < 0.5) continue;
            const wx = bx + (bw * (k + 0.3)) / cols;
            const wy = by + (bh * (r + 0.25)) / rows;
            flankWindows.push({ x: wx, y: wy, w: (bw / cols) * 0.32, h: (bh / rows) * 0.34 });
          }
        // lights along the parapet and down the corners
        const n = Math.max(4, Math.round(bw / (u * 0.018)));
        for (let k = 0; k <= n; k++) flankBulbs.push({ x: bx + (bw * k) / n, y: by - u * 0.004, color: k % 3 === 0 ? '#ff9a5c' : '#ffd27a', r: u * 0.0036 });
        x += side < 0 ? -bw * rand(rng, 0.95, 1.1) : bw * rand(rng, 0.95, 1.1);
      }
    }
    for (const win of flankWindows) {
      g.fillStyle = mix('#b8702e', '#e0a050', rng());
      g.fillRect(win.x, win.y, win.w, win.h);
    }
    // street
    const sg = g.createLinearGradient(0, groundY, 0, h);
    sg.addColorStop(0, '#2a2a36');
    sg.addColorStop(1, '#1a1a22');
    g.fillStyle = sg;
    g.fillRect(0, groundY, w, h - groundY);
  }

  // ---- the photo, graded to night, sides feathered into the flanks
  const pc = makeCanvas(rect.w, rect.h);
  const pg = ctx2d(pc);
  pg.imageSmoothingQuality = 'high';
  pg.drawImage(image, src.x, src.y, src.w, src.h, 0, 0, rect.w, rect.h);
  nightGrade(pg, rect.w, rect.h);
  if (flanked) {
    withBlend(pg, 'destination-in', () => {
      const fgr = pg.createLinearGradient(0, 0, rect.w, 0);
      const f = feather / rect.w;
      fgr.addColorStop(0, 'rgba(0,0,0,0)');
      fgr.addColorStop(f, 'rgba(0,0,0,1)');
      fgr.addColorStop(1 - f, 'rgba(0,0,0,1)');
      fgr.addColorStop(1, 'rgba(0,0,0,0)');
      pg.fillStyle = fgr;
      pg.fillRect(0, 0, rect.w, rect.h);
    });
  }
  g.drawImage(pc as CanvasImageSource, rect.x, rect.y);

  // ---- sky mask for the whole canvas
  const sMask = makeCanvas(sky.w, sky.h);
  const smg = ctx2d(sMask);
  const sid = smg.createImageData(sky.w, sky.h);
  for (let i = 0; i < sky.mask.length; i++) sid.data.set([255, 255, 255, Math.round(sky.mask[i] * 255)], i * 4);
  smg.putImageData(sid, 0, 0);
  const full = makeCanvas(w, h);
  const fg2 = ctx2d(full);
  if (flanked) {
    // open sky above the painted neighbours
    fg2.fillStyle = '#fff';
    fg2.fillRect(0, 0, rect.x + feather, h);
    fg2.fillRect(rect.x + rect.w - feather, 0, w - (rect.x + rect.w - feather), h);
    withBlend(fg2, 'destination-out', () => {
      fg2.fillStyle = '#000';
      for (const r of flankRoofs) fg2.fillRect(r.x0 - 1, r.y, r.x1 - r.x0 + 2, h);
      fg2.fillRect(0, groundY, w, h);
    });
  }
  // the photo's own sky (crop mapped into the placed rect)
  fg2.save();
  fg2.beginPath();
  fg2.rect(rect.x + (flanked ? feather * 0.5 : 0), rect.y, rect.w - (flanked ? feather : 0), rect.h);
  fg2.clip();
  fg2.clearRect(rect.x, rect.y, rect.w, rect.h);
  const sx = sky.w / image.width;
  const sy = sky.h / image.height;
  fg2.imageSmoothingEnabled = true;
  fg2.drawImage(sMask as CanvasImageSource, src.x * sx, src.y * sy, src.w * sx, src.h * sy, rect.x, rect.y, rect.w, rect.h);
  fg2.restore();

  // roofline: first non-sky pixel below the sky in each column
  const md = smallAlpha(full, w, h);
  const roof = new Float32Array(md.w);
  let minRoof = 1;
  for (let x = 0; x < md.w; x++) {
    let y = 0;
    while (y < md.h && md.a[y * md.w + x] > 0.5) y++;
    roof[x] = y / md.h;
    if (y > 0 && y / md.h < minRoof) minRoof = y / md.h;
  }

  // ---- night sky with fireworks through the mask
  const night = makeCanvas(w, h);
  const ng = ctx2d(night);
  gradientSky(ng, 0, 0, w, h, [
    [0, '#060826'],
    [0.35, '#151549'],
    [0.62, '#3b1d5e'],
    [0.85, '#7a2f5a'],
    [1, '#b8563a'],
  ]);
  smoke(ng, rng, 0, h * 0.15, w, h * 0.55, 10, '#6a3a6e', 0.18);
  const skyBottom = Math.max(0.12, Math.min(0.55, minRoof));
  const palette = ['#ff4fa3', '#ffd166', '#5ad1ff', '#ff7a3d', '#b78bff', '#7dffb0', '#ffe3a3'];
  const kinds: BurstKind[] = ['chrysanthemum', 'willow', 'peony', 'ring', 'palm', 'crossette'];
  const bursts = 7;
  for (let i = 0; i < bursts; i++) {
    // spread across the width, larger ones toward the sides, away from the head
    const t = (i + 0.5) / bursts;
    const bx = w * lerp(0.06, 0.94, t) + rand(rng, -0.03, 0.03) * w;
    const centre = 1 - Math.abs(t - 0.5) * 2;
    const by = h * rand(rng, 0.06, skyBottom * 0.75);
    const br = u * (0.1 + 0.12 * (1 - centre)) * rand(rng, 0.8, 1.15);
    firework(ng, rng, bx, by, br, palette[i % palette.length], kinds[i % kinds.length], 0.9);
  }
  withBlend(ng, 'destination-in', () => ng.drawImage(full as CanvasImageSource, 0, 0));
  g.drawImage(night as CanvasImageSource, 0, 0);

  // ---- decorations (painted bodies)
  const bulbs: Bulb[] = [...flankBulbs];
  const flames: { p: Pt; s: number }[] = [];
  // rooflines outlined with lights
  const step = Math.max(1, Math.round(md.w / 90));
  for (let x = 0; x < md.w; x += step) {
    const ry = roof[x];
    if (ry < 0.04 || ry > 0.85) continue;
    const px = ((x + 0.5) / md.w) * w;
    if (flanked && (px < rect.x + feather * 0.5 || px > rect.x + rect.w - feather * 0.5)) continue;
    bulbs.push({ x: px, y: ry * h + u * 0.004, color: x % 3 === 0 ? '#ffb15c' : '#ffe2a0', r: u * 0.0045 });
  }
  // light strings cascading down the facades
  const strings = Math.round((flanked ? rect.w / w : 1) * 13);
  for (let k = 0; k <= strings; k++) {
    const px = flanked ? rect.x + feather + ((rect.w - 2 * feather) * k) / strings : (w * (k + 0.5)) / (strings + 1);
    const mx = Math.min(md.w - 1, Math.max(0, Math.floor((px / w) * md.w)));
    const top = roof[mx] * h;
    if (top < h * 0.04 || top > groundY - h * 0.15) continue;
    const colors = k % 2 ? ['#ffd27a', '#ff9a5c'] : ['#fff0c0', '#ffb347'];
    for (let y = top + u * 0.02; y < groundY - u * 0.02; y += u * 0.034) bulbs.push({ x: px + Math.sin(y * 0.05) * u * 0.002, y, color: colors[Math.floor(y / (u * 0.034)) % 2], r: u * 0.0032 });
  }
  // rangoli and diyas along the ground
  const rr = u * (h > w ? 0.24 : 0.17);
  for (const p of rangoli(g, rng, w / 2, h * 0.975, rr, { tilt: 0.3, diyas: 10, petals: 12 })) flames.push({ p, s: p.s });
  const nd = h > w ? 4 : 7;
  for (let i = 0; i < nd; i++) {
    for (const sd of [-1, 1]) {
      const t = i / Math.max(1, nd - 1);
      const x = w / 2 + sd * w * lerp(h > w ? 0.28 : 0.2, 0.47, t);
      const y = lerp(groundY + h * 0.012, h * 0.985, 0.35 + 0.65 * Math.abs(sd * t));
      const s = u * rand(rng, 0.045, 0.058);
      flames.push({ p: diya(g, x, y, s, { dir: sd > 0 ? -1 : 1 }), s });
    }
  }
  // leafy trees with fairy lights where the photo meets the painted neighbours
  if (flanked) {
    const tr = fork(rng);
    for (const tx of [rect.x + feather * 0.3, rect.x + rect.w - feather * 0.3]) {
      const th = h * 0.34;
      const base = groundY + h * 0.015;
      g.strokeStyle = '#1a1210';
      g.lineWidth = u * 0.012;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(tx, base);
      g.quadraticCurveTo(tx + u * 0.01, base - th * 0.5, tx, base - th * 0.62);
      g.stroke();
      const cy = base - th * 0.78;
      for (let i = 0; i < 22; i++) {
        const a = rand(tr, 0, Math.PI * 2);
        const d = Math.sqrt(tr()) * th * 0.3;
        const bxp = tx + Math.cos(a) * d;
        const byp = cy + Math.sin(a) * d * 0.75;
        g.beginPath();
        g.ellipse(bxp, byp, th * rand(tr, 0.08, 0.14), th * rand(tr, 0.06, 0.1), rand(tr, 0, Math.PI), 0, Math.PI * 2);
        g.fillStyle = mix('#0b160f', '#17291a', tr());
        g.fill();
        if (i % 2 === 0) bulbs.push({ x: bxp + rand(tr, -1, 1) * th * 0.05, y: byp + rand(tr, -1, 1) * th * 0.04, color: tr() < 0.5 ? '#ffe2a0' : '#ffb15c', r: u * 0.003 });
      }
    }
  }

  // warm uplight on the facades from the diyas and street
  withBlend(g, 'screen', () => {
    const up = g.createLinearGradient(0, groundY, 0, h * 0.35);
    up.addColorStop(0, rgba('#ff9a3c', 0.22));
    up.addColorStop(1, rgba('#ff9a3c', 0));
    g.fillStyle = up;
    g.fillRect(0, h * 0.35, w, groundY - h * 0.35);
  });

  // ---- oil paint
  let out: AnyCanvas = c;
  if (painter) {
    try {
      out = painter.apply(c as TexImageSource, w, h, { radius: Math.max(2, Math.min(8, Math.max(w, h) / 255)), strokes: 0.95, weave: 0.9, saturation: 1.15, warmth: 0.25, contrast: 1.06 });
    } catch (err) {
      console.warn('[exterior] painterly pass failed', err);
    }
  }

  // ---- light sources on top
  const lg = ctx2d(out);
  for (const win of flankWindows) glow(lg, win.x + win.w / 2, win.y + win.h / 2, win.w * 2.2, '#ffb85c', 0.16);
  // sky lanterns drifting up
  const lr = fork(rng);
  for (let i = 0; i < 9; i++) {
    const x = w * rand(lr, 0.05, 0.95);
    const y = h * rand(lr, 0.04, skyBottom * 0.85);
    const mx = Math.min(md.w - 1, Math.max(0, Math.floor((x / w) * md.w)));
    const my = Math.min(md.h - 1, Math.max(0, Math.floor((y / h) * md.h)));
    if (md.a[my * md.w + mx] < 0.6) continue;
    const s = u * rand(lr, 0.012, 0.022);
    glow(lg, x, y, s * 4, '#ff8a3c', 0.3);
    lg.beginPath();
    lg.moveTo(x - s * 0.55, y - s * 0.6);
    lg.lineTo(x + s * 0.55, y - s * 0.6);
    lg.lineTo(x + s * 0.42, y + s * 0.6);
    lg.lineTo(x - s * 0.42, y + s * 0.6);
    lg.closePath();
    lg.fillStyle = rgba('#ffc46b', 0.92);
    lg.fill();
    glow(lg, x, y + s * 0.3, s * 1.2, '#fff0c0', 0.6);
  }
  drawBulbs(lg, bulbs);
  // firecrackers on the street
  anar(lg, lr, w * (h > w ? 0.12 : 0.17), h * 0.965, h * 0.26, 140);
  anar(lg, lr, w * (h > w ? 0.88 : 0.83), h * 0.97, h * 0.3, 160);
  chakri(lg, lr, w * (h > w ? 0.7 : 0.64), h * 0.985, u * 0.03);
  for (const f of flames) {
    wash(lg, f.p.x, f.p.y + f.s * 0.3, f.s * 2.4, f.s * 0.9, '#ff9a3c', 0.12);
    diyaFlame(lg, lr, f.p.x, f.p.y, f.s);
  }
  bokeh(lg, lr, 0, groundY - h * 0.25, w, h, 14, ['#ffcf7a', '#ff9a5c'], u * 0.01, u * 0.03, 0.14);
  vignette(lg, w, h, 0.35, '#0a0614');

  // ---- outputs: sky mask and where live fireworks may burst
  const skyOut = smallAlpha(full, w, h, SKY_RES);
  const data = new Uint8Array(skyOut.w * skyOut.h);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(skyOut.a[i] * 255);
  const top = Math.max(0.08, skyBottom * 0.8);
  const skyRects: NRect[] = [
    [0.04, 0.03, 0.4, top],
    [0.6, 0.03, 0.96, top],
    [0.3, 0.03, 0.7, Math.max(0.06, top * 0.6)],
  ];
  return { canvas: out, sky: { data, w: skyOut.w, h: skyOut.h }, skyRects };
}

/** Night colours for a daytime building photo, with a little warmth kept in the lights. */
function nightGrade(g: Ctx, w: number, h: number) {
  withBlend(g, 'multiply', () => {
    g.fillStyle = '#7a82ad';
    g.fillRect(0, 0, w, h);
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#8e90b8');
    v.addColorStop(0.6, '#ffffff');
    v.addColorStop(1, '#c9b8b0');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  });
  withBlend(g, 'soft-light', () => {
    g.fillStyle = 'rgba(255,150,60,0.22)';
    g.fillRect(0, 0, w, h);
  });
}

/** Alpha channel of a canvas at small resolution. */
function smallAlpha(src: AnyCanvas, w: number, h: number, res = 240) {
  const s = res / Math.max(w, h);
  const mw = Math.max(8, Math.round(w * s));
  const mh = Math.max(8, Math.round(h * s));
  const c = makeCanvas(mw, mh);
  const g = ctx2d(c);
  g.drawImage(src as CanvasImageSource, 0, 0, mw, mh);
  const d = g.getImageData(0, 0, mw, mh).data;
  const a = new Float32Array(mw * mh);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  return { a, w: mw, h: mh };
}
