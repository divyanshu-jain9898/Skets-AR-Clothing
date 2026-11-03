/**
 * Drawing helpers for the "Illuminated House" scene (some are shared with the
 * interior scene): painterly texture, light pools, Indian arch / roof / dome
 * profiles and a few scene props (trees, pots, tulsi vrindavan).
 *
 * Sizes are pixels; callers derive them from the canvas size. Every random
 * choice comes from the `rng` passed in, and loop counts never depend on the
 * pixel size so a thumbnail paints the same picture as the full image.
 */
import { type Ctx, type Rng, type Pt, type Bulb, TAU, rand, pick, lerp, mix, rgba, wash, ellipse, withState, withBlend, mulberry32, gauss, marigold } from '../kit';

/** Independent random stream (so size-dependent consumption elsewhere cannot shift it). */
export const fork = (rng: Rng): Rng => mulberry32(Math.floor(rng() * 4294967296));

export interface Flame {
  x: number;
  y: number;
  /** Diya width the flame belongs to. */
  s: number;
  /** Intensity multiplier. */
  i: number;
}

// ------------------------------------------------------------------ basics
export function lin(g: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of stops) gr.addColorStop(p, c);
  return gr;
}

export function rad(g: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
  const gr = g.createRadialGradient(x, y, r0, x, y, Math.max(r0 + 0.01, r1));
  for (const [p, c] of stops) gr.addColorStop(p, c);
  return gr;
}

export function box(g: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

export function polyPath(g: Ctx, pts: Pt[]) {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}

export function fillPoly(g: Ctx, pts: Pt[], fill: string | CanvasGradient) {
  g.beginPath();
  polyPath(g, pts);
  g.fillStyle = fill;
  g.fill();
}

export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, width: number) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

export function clipRect(g: Ctx, x: number, y: number, w: number, h: number, fn: () => void) {
  withState(g, () => {
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    fn();
  });
}

export function clipTo(g: Ctx, path: () => void, fn: () => void) {
  withState(g, () => {
    g.beginPath();
    path();
    g.clip();
    fn();
  });
}

// ------------------------------------------------------------------ light & texture
/** Soft additive elliptical light pool. */
export function pool(g: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  if (rx < 1 || ry < 1 || alpha <= 0) return;
  withBlend(g, 'lighter', () => {
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, rgba(color, alpha));
    gr.addColorStop(0.35, rgba(color, alpha * 0.55));
    gr.addColorStop(0.7, rgba(color, alpha * 0.16));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
  });
}

/** Soft darkening (normal blend) - ambient occlusion and cast shadows. */
export function shade(g: Ctx, x: number, y: number, rx: number, ry: number, alpha: number, color = '#0a0410') {
  if (rx < 1 || ry < 1) return;
  wash(g, x, y, rx, ry, color, alpha);
}

/**
 * Painterly daubs: short, soft-edged elongated dabs of colour that the oil
 * filter turns into visible brush work. `size` is the dab length.
 */
export function daubs(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, colors: readonly string[], size: number, alpha: number, angle = 0, spread = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const L = size * rand(rng, 0.5, 1.3);
    g.beginPath();
    g.ellipse(x, y, L, L * rand(rng, 0.18, 0.42), angle + gauss(rng) * spread, 0, TAU);
    g.fillStyle = rgba(pick(rng, colors), alpha * rand(rng, 0.35, 1));
    g.fill();
  }
}

/** Vertical gradient that fades a band (used for ambient occlusion under ledges). */
export function band(g: Ctx, x: number, y: number, w: number, h: number, color: string, a0: number, a1: number) {
  g.fillStyle = lin(g, 0, y, 0, y + h, [[0, rgba(color, a0)], [1, rgba(color, a1)]]);
  g.fillRect(x, y, w, h);
}

// ------------------------------------------------------------------ arches & roofs
/** Points along a two-centred pointed arch from the left springing to the right one. */
export function archPts(cx: number, ys: number, a: number, rise: number, n: number, point = 0.3): Pt[] {
  const c = point * a;
  const R = a + c;
  const nat = Math.sqrt(R * R - c * c);
  const sy = rise / nat;
  const phi = Math.acos(-c / R);
  const half = Math.max(2, Math.round(n / 2));
  const out: Pt[] = [];
  for (let i = 0; i <= half; i++) {
    const th = Math.PI + (phi - Math.PI) * (i / half);
    out.push({ x: cx + c + R * Math.cos(th), y: ys - R * Math.sin(th) * sy });
  }
  for (let i = half - 1; i >= 0; i--) out.push({ x: 2 * cx - out[i].x, y: out[i].y });
  return out;
}

/**
 * Mughal / Rajput arch opening: straight jambs from `base` to the springing
 * line `ys`, then a pointed arch rising `rise` px. `lobes` > 0 makes it a
 * cusped (multifoil) arch. Adds to the current path (call beginPath first).
 */
export function archPath(g: Ctx, cx: number, base: number, a: number, ys: number, rise: number, lobes = 0, depth = 0.38, point = 0.3) {
  const dense = archPts(cx, ys, a, rise, 40, point);
  g.moveTo(cx - a, base);
  g.lineTo(cx - a, ys);
  if (lobes <= 0) {
    for (let i = 1; i < dense.length; i++) g.lineTo(dense[i].x, dense[i].y);
  } else {
    const acc: number[] = [0];
    for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
    const total = acc[acc.length - 1];
    const pts: Pt[] = [];
    let k = 1;
    for (let j = 0; j <= lobes; j++) {
      const target = (total * j) / lobes;
      while (k < dense.length - 1 && acc[k] < target) k++;
      const t = (target - acc[k - 1]) / Math.max(1e-6, acc[k] - acc[k - 1]);
      pts.push({ x: lerp(dense[k - 1].x, dense[k].x, Math.min(1, Math.max(0, t))), y: lerp(dense[k - 1].y, dense[k].y, Math.min(1, Math.max(0, t))) });
    }
    const C = { x: cx, y: ys + a * 0.25 };
    for (let j = 1; j < pts.length; j++) {
      const p = pts[j - 1];
      const q = pts[j];
      const mx = (p.x + q.x) / 2;
      const my = (p.y + q.y) / 2;
      let nx = q.y - p.y;
      let ny = -(q.x - p.x);
      if (nx * (mx - C.x) + ny * (my - C.y) < 0) {
        nx = -nx;
        ny = -ny;
      }
      const L = Math.hypot(nx, ny) || 1;
      const seg = Math.hypot(q.x - p.x, q.y - p.y);
      g.quadraticCurveTo(mx + (nx / L) * seg * depth, my + (ny / L) * seg * depth, q.x, q.y);
    }
  }
  g.lineTo(cx + a, base);
  g.closePath();
}

/** Bangaldar (curved Bengal) roof over a jharokha: eaves droop at the ends. */
export function banglaPath(g: Ctx, cx: number, yb: number, a: number, hr: number) {
  g.moveTo(cx - a, yb + hr * 0.18);
  g.bezierCurveTo(cx - a * 0.92, yb - hr * 0.75, cx - a * 0.4, yb - hr, cx, yb - hr);
  g.bezierCurveTo(cx + a * 0.4, yb - hr, cx + a * 0.92, yb - hr * 0.75, cx + a, yb + hr * 0.18);
  g.quadraticCurveTo(cx, yb - hr * 0.32, cx - a, yb + hr * 0.18);
  g.closePath();
}

/** Onion-ish dome sitting on (cx, yb) with half-width a and height hr. */
export function domePath(g: Ctx, cx: number, yb: number, a: number, hr: number) {
  g.moveTo(cx - a, yb);
  g.bezierCurveTo(cx - a * 1.12, yb - hr * 0.5, cx - a * 0.3, yb - hr * 0.72, cx, yb - hr);
  g.bezierCurveTo(cx + a * 0.3, yb - hr * 0.72, cx + a * 1.12, yb - hr * 0.5, cx + a, yb);
  g.closePath();
}

/** Points along a dome outline (for bulbs). */
export function domePts(cx: number, yb: number, a: number, hr: number, n: number): Pt[] {
  const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const s = 1 - t;
    return s * s * s * p0 + 3 * s * s * t * p1 + 3 * s * t * t * p2 + t * t * t * p3;
  };
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t2 = (i / n) * 2;
    if (t2 <= 1) out.push({ x: bez(cx - a, cx - a * 1.12, cx - a * 0.3, cx, t2), y: bez(yb, yb - hr * 0.5, yb - hr * 0.72, yb - hr, t2) });
    else {
      const t = t2 - 1;
      out.push({ x: bez(cx, cx + a * 0.3, cx + a * 1.12, cx + a, t), y: bez(yb - hr, yb - hr * 0.72, yb - hr * 0.5, yb, t) });
    }
  }
  return out;
}

/** Brass / gold metal gradient across x0..x1. */
export function brass(g: Ctx, x0: number, x1: number, dark = '#4a2c08') {
  return lin(g, x0, 0, x1, 0, [[0, dark], [0.3, '#c8902e'], [0.5, '#ffe9a8'], [0.68, '#d9a440'], [1, dark]]);
}

/** Kalash finial: stacked pots and a spike. (cx, yb) is its base. */
export function kalash(g: Ctx, cx: number, yb: number, s: number, fill: string | CanvasGradient) {
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(cx, yb - s * 0.12, s * 0.28, s * 0.12, 0, 0, TAU);
  g.ellipse(cx, yb - s * 0.38, s * 0.2, s * 0.17, 0, 0, TAU);
  g.ellipse(cx, yb - s * 0.62, s * 0.12, s * 0.1, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(cx - s * 0.05, yb - s * 0.66);
  g.lineTo(cx, yb - s);
  g.lineTo(cx + s * 0.05, yb - s * 0.66);
  g.closePath();
  g.fill();
}

/** Points along a polyline every `step` px (counts scale with the path, not the canvas). */
export function along(path: Pt[], n: number): Pt[] {
  const acc: number[] = [0];
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const total = acc[acc.length - 1];
  const out: Pt[] = [];
  let k = 1;
  for (let j = 0; j < n; j++) {
    const target = (total * (j + 0.5)) / n;
    while (k < path.length - 1 && acc[k] < target) k++;
    const t = Math.min(1, Math.max(0, (target - acc[k - 1]) / Math.max(1e-6, acc[k] - acc[k - 1])));
    out.push({ x: lerp(path[k - 1].x, path[k].x, t), y: lerp(path[k - 1].y, path[k].y, t) });
  }
  return out;
}

/** Bulbs at `n` points along a path. */
export function bulbsOn(rng: Rng, pts: Pt[], colors: readonly string[], r: number, out: Bulb[]) {
  pts.forEach((p, i) => out.push({ x: p.x, y: p.y, color: colors[i % colors.length], r: r * rand(rng, 0.85, 1.15) }));
}

/** Draws a sagging wire through scallops between consecutive anchors and returns bulb points. */
export function scallops(g: Ctx, anchors: Pt[], sag: number, perSwag: number, wire: string, width: number): Pt[] {
  const out: Pt[] = [];
  g.strokeStyle = wire;
  g.lineWidth = width;
  g.beginPath();
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1];
    const b = anchors[i];
    if (i === 1) g.moveTo(a.x, a.y);
    g.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag * 2, b.x, b.y);
    for (let k = 0; k < perSwag; k++) {
      const t = (k + 0.5) / perSwag;
      out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) + sag * 4 * t * (1 - t) });
    }
  }
  g.stroke();
  return out;
}

// ------------------------------------------------------------------ props
/** Coconut palm silhouette with a warm rim light on the `rimSide` (+1 right, -1 left). */
export function palmTree(g: Ctx, rng: Rng, x: number, base: number, h: number, lean: number, dark: string, rim: string, rimSide: 1 | -1) {
  const top = { x: x + lean * h, y: base - h };
  const ctrl = { x: x + lean * h * 0.15, y: base - h * 0.5 };
  const N = 18;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const s = 1 - t;
    const px = s * s * x + 2 * s * t * ctrl.x + t * t * top.x;
    const py = s * s * base + 2 * s * t * ctrl.y + t * t * top.y;
    const wd = h * lerp(0.032, 0.018, t) * (i === 0 ? 1.4 : 1);
    left.push({ x: px - wd, y: py });
    right.push({ x: px + wd, y: py });
  }
  g.beginPath();
  polyPath(g, [...left, ...right.reverse()]);
  g.fillStyle = lin(g, x - h * 0.04, 0, x + h * 0.04, 0, rimSide > 0 ? [[0, dark], [0.6, dark], [1, rim]] : [[0, rim], [0.4, dark], [1, dark]]);
  g.fill();
  // trunk rings
  right.reverse();
  for (let i = 1; i < N; i += 1) {
    const a = left[i];
    const b = right[i];
    line(g, a.x, a.y, b.x, b.y + h * 0.006, rgba('#000000', 0.35), Math.max(0.6, h * 0.005));
  }
  // fronds: feathery drooping leaves, the ones pointing up drawn first (behind)
  const fronds = 15;
  const order: { a: number; L: number }[] = [];
  for (let i = 0; i < fronds; i++) order.push({ a: -Math.PI / 2 + (i / (fronds - 1) - 0.5) * Math.PI * 2.1 + rand(rng, -0.1, 0.1), L: h * rand(rng, 0.27, 0.38) });
  order.sort((p, q) => Math.abs(Math.cos(p.a)) - Math.abs(Math.cos(q.a)));
  for (const { a, L } of order) {
    const droop = 0.25 + 0.55 * Math.abs(Math.cos(a));
    const ex = top.x + Math.cos(a) * L * 0.95;
    const ey = top.y + Math.sin(a) * L * 0.45 + L * droop;
    const cx2 = top.x + Math.cos(a) * L * 0.62;
    const cy2 = top.y + Math.sin(a) * L * 0.45 - L * 0.18;
    const lit = Math.cos(a) * rimSide;
    const col = mix(dark, rim, 0.12 + Math.max(0, lit) * 0.35 + Math.max(0, Math.sin(a)) * 0.25);
    const K = 16;
    const sides: Pt[][] = [[], []];
    for (let k = 1; k < K; k++) {
      const t = k / K;
      const s = 1 - t;
      const px = s * s * top.x + 2 * s * t * cx2 + t * t * ex;
      const py = s * s * top.y + 2 * s * t * cy2 + t * t * ey;
      const dx = 2 * s * (cx2 - top.x) + 2 * t * (ex - cx2);
      const dy = 2 * s * (cy2 - top.y) + 2 * t * (ey - cy2);
      const dl = Math.hypot(dx, dy) || 1;
      const ll = L * 0.26 * Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.95)) * (k % 2 ? 1 : 0.4);
      ;[-1, 1].forEach((side, j) => {
        let qx = (-dy / dl) * side * 0.75 + (dx / dl) * 0.55;
        let qy = (dx / dl) * side * 0.75 + (dy / dl) * 0.55 + 0.85;
        const ql = Math.hypot(qx, qy) || 1;
        qx /= ql;
        qy /= ql;
        sides[j].push({ x: px + qx * ll, y: py + qy * ll });
      });
    }
    g.beginPath();
    g.moveTo(top.x, top.y);
    for (const p of sides[0]) g.lineTo(p.x, p.y);
    g.lineTo(ex, ey);
    for (let k = sides[1].length - 1; k >= 0; k--) g.lineTo(sides[1][k].x, sides[1][k].y);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    g.strokeStyle = mix(col, rim, 0.25);
    g.lineWidth = Math.max(1, h * 0.004);
    g.beginPath();
    g.moveTo(top.x, top.y);
    g.quadraticCurveTo(cx2, cy2, ex, ey);
    g.stroke();
  }
  // coconuts
  for (let i = 0; i < 4; i++) ellipse(g, top.x + rand(rng, -1, 1) * h * 0.03, top.y + h * rand(rng, 0.015, 0.04), h * 0.017, h * 0.017, mix(dark, rim, 0.2));
  return top;
}

export interface Clump {
  x: number;
  y: number;
  r: number;
}

/** Broad neem / mango canopy made of leafy clumps. Returns the clumps (for masks and light strings). */
export function leafyTree(g: Ctx, rng: Rng, x: number, base: number, h: number, spread: number, dark: string, mid: string, rim: string, rimSide: 1 | -1): Clump[] {
  // trunk and main limbs
  const trunkTop = base - h * 0.45;
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(x - h * 0.04, base);
  g.quadraticCurveTo(x - h * 0.02, base - h * 0.25, x - h * 0.012, trunkTop);
  g.lineTo(x + h * 0.016, trunkTop);
  g.quadraticCurveTo(x + h * 0.02, base - h * 0.25, x + h * 0.045, base);
  g.closePath();
  g.fill();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42 + rand(rng, -0.1, 0.1);
    const L = h * rand(rng, 0.22, 0.32);
    g.strokeStyle = dark;
    g.lineWidth = h * 0.016;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, trunkTop + h * 0.03);
    g.quadraticCurveTo(x + Math.cos(a) * L * 0.4, trunkTop - L * 0.5, x + Math.cos(a) * L * spread, trunkTop + Math.sin(a) * L);
    g.stroke();
  }
  // canopy clumps
  const clumps: Clump[] = [];
  const cy = base - h * 0.72;
  for (let i = 0; i < 46; i++) {
    const a = rand(rng, 0, TAU);
    const d = Math.sqrt(rng());
    const r = h * rand(rng, 0.07, 0.13) * (1 - d * 0.35);
    clumps.push({ x: x + Math.cos(a) * d * h * 0.3 * spread, y: cy + Math.sin(a) * d * h * 0.22, r });
  }
  clumps.sort((p, q) => p.y - q.y);
  const olive = mix(rim, '#4a5a2a', 0.55);
  for (const c of clumps) {
    // lit from below and from the house side, cool and dark on top
    const lx = c.x + rimSide * c.r * 0.45;
    const ly = c.y + c.r * 0.55;
    g.fillStyle = rad(g, lx, ly, c.r * 0.05, c.r * 1.25, [[0, rgba(olive, 1)], [0.45, mid], [1, dark]]);
    g.beginPath();
    g.arc(c.x, c.y, c.r, 0, TAU);
    g.fill();
  }
  // leaf daubs: texture inside the canopy and a ragged leafy edge
  for (let i = 0; i < 320; i++) {
    const c = clumps[Math.floor(rng() * clumps.length)];
    const a = rand(rng, 0, TAU);
    const d = rand(rng, 0.35, 1.08);
    const px = c.x + Math.cos(a) * c.r * d;
    const py = c.y + Math.sin(a) * c.r * d;
    const lit = Math.cos(a) * rimSide > 0 && Math.sin(a) > -0.2;
    g.fillStyle = lit ? rgba(rng() < 0.5 ? olive : mix(olive, '#ffb060', 0.25), rand(rng, 0.35, 0.75)) : rgba(rng() < 0.5 ? mid : dark, 0.85);
    g.beginPath();
    g.ellipse(px, py, h * 0.013, h * 0.0055, a + rand(rng, -0.8, 0.8), 0, TAU);
    g.fill();
  }
  return clumps;
}

/** Terracotta pot with a leafy plant. (x, y) = bottom centre of the pot, `s` = pot height. */
export function pottedPlant(g: Ctx, rng: Rng, x: number, y: number, s: number, kind: 'croton' | 'fern' | 'banana', lightSide: 1 | -1, lit = 1) {
  wash(g, x, y, s * 0.8, s * 0.14, '#000000', 0.5);
  const pw = s * 0.42;
  // plant first (behind the pot rim)
  const leaves = kind === 'banana' ? 7 : kind === 'fern' ? 22 : 16;
  for (let i = 0; i < leaves; i++) {
    const a = -Math.PI / 2 + gauss(rng) * (kind === 'banana' ? 0.55 : 0.75);
    const L = s * (kind === 'banana' ? rand(rng, 1.2, 1.9) : kind === 'fern' ? rand(rng, 0.7, 1.15) : rand(rng, 0.55, 0.95));
    const wd = kind === 'banana' ? 0.2 : kind === 'fern' ? 0.09 : 0.24;
    const bx = x + rand(rng, -0.25, 0.25) * pw;
    const by = y - s * 0.95;
    const ex = bx + Math.cos(a) * L;
    const ey = by + Math.sin(a) * L + (kind === 'fern' ? L * 0.3 : 0);
    const nx = -(ey - by) / L;
    const ny = (ex - bx) / L;
    const side = Math.cos(a) * lightSide;
    const base = kind === 'croton' ? pick(rng, ['#3d5a1e', '#6a4a12', '#5a2a1a', '#2d4a22']) : pick(rng, ['#1f4a24', '#2a5a28', '#1a3c20']);
    const col = mix(base, '#ffb060', Math.max(0, side) * 0.35 * lit);
    g.beginPath();
    g.moveTo(bx, by);
    g.quadraticCurveTo((bx + ex) / 2 + nx * L * wd, (by + ey) / 2 + ny * L * wd, ex, ey);
    g.quadraticCurveTo((bx + ex) / 2 - nx * L * wd, (by + ey) / 2 - ny * L * wd, bx, by);
    g.fillStyle = lin(g, bx, by, ex, ey, [[0, mix(col, '#000000', 0.5)], [0.6, col], [1, mix(col, '#ffe0a0', 0.15 * lit)]]);
    g.fill();
    line(g, bx, by, (bx + ex) / 2 + (ex - bx) * 0.4, (by + ey) / 2 + (ey - by) * 0.4, rgba(kind === 'croton' ? '#ffd040' : '#e8d090', kind === 'croton' ? 0.6 : 0.3), Math.max(0.6, s * 0.012));
    if (kind !== 'fern') {
      // lateral veins (and the ragged splits of a banana leaf)
      g.strokeStyle = rgba(kind === 'croton' ? '#ffcf40' : '#0a1a08', kind === 'croton' ? 0.35 : 0.3);
      g.lineWidth = Math.max(0.6, s * 0.008);
      g.beginPath();
      const nv = kind === 'banana' ? 9 : 5;
      for (let v = 1; v <= nv; v++) {
        const t = v / (nv + 1);
        const mx = lerp(bx, ex, t);
        const my = lerp(by, ey, t);
        const ww = L * wd * Math.sin(Math.PI * t) * 0.9;
        for (const sd of [-1, 1]) {
          g.moveTo(mx, my);
          g.lineTo(mx + nx * ww * sd + (ex - bx) * 0.06, my + ny * ww * sd + (ey - by) * 0.06);
        }
      }
      g.stroke();
    }
  }
  // pot
  g.beginPath();
  g.moveTo(x - pw, y - s * 0.95);
  g.bezierCurveTo(x - pw * 1.05, y - s * 0.55, x - pw * 0.8, y - s * 0.05, x - pw * 0.55, y);
  g.lineTo(x + pw * 0.55, y);
  g.bezierCurveTo(x + pw * 0.8, y - s * 0.05, x + pw * 1.05, y - s * 0.55, x + pw, y - s * 0.95);
  g.closePath();
  const hl = lightSide > 0 ? 0.72 : 0.28;
  g.fillStyle = lin(g, x - pw, 0, x + pw, 0, [[0, '#3a1408'], [Math.max(0, hl - 0.3), '#7a3214'], [hl, mix('#c2602c', '#ffb070', 0.3 * lit)], [Math.min(1, hl + 0.25), '#8a3a18'], [1, '#2a0e06']]);
  g.fill();
  // rim and painted band
  box(g, x - pw * 1.08, y - s * 1.02, pw * 2.16, s * 0.1, lin(g, x - pw, 0, x + pw, 0, [[0, '#4a1a0a'], [hl, '#d27a40'], [1, '#3a1208']]));
  box(g, x - pw * 0.96, y - s * 0.62, pw * 1.92, s * 0.06, rgba('#f2d08a', 0.55));
  for (let i = 0; i < 5; i++) ellipse(g, x - pw * 0.7 + (i * pw * 1.4) / 4, y - s * 0.45, s * 0.03, s * 0.03, rgba('#ffffff', 0.45));
}

/** Tulsi vrindavan: a painted plinth-planter with a holy basil bush and a diya niche. Returns the niche diya flame point. */
export function tulsi(g: Ctx, rng: Rng, x: number, y: number, s: number, lightSide: 1 | -1): Pt {
  wash(g, x, y, s * 0.75, s * 0.12, '#000000', 0.55);
  const w0 = s * 0.42;
  const hl = lightSide > 0 ? 0.7 : 0.3;
  const stone = (c: string) => lin(g, x - w0, 0, x + w0, 0, [[0, mix(c, '#2a0a10', 0.6)], [hl, mix(c, '#ffb070', 0.3)], [1, mix(c, '#2a0a10', 0.7)]]);
  // stepped base
  box(g, x - w0 * 1.15, y - s * 0.1, w0 * 2.3, s * 0.1, stone('#b0583a'));
  box(g, x - w0 * 1.02, y - s * 0.18, w0 * 2.04, s * 0.09, stone('#e0c49a'));
  // body
  box(g, x - w0 * 0.82, y - s * 0.72, w0 * 1.64, s * 0.55, stone('#e8d2b0'));
  // vermilion and turmeric bands
  box(g, x - w0 * 0.82, y - s * 0.3, w0 * 1.64, s * 0.04, '#c43a22');
  box(g, x - w0 * 0.82, y - s * 0.66, w0 * 1.64, s * 0.035, '#e0a020');
  // niche with diya
  g.beginPath();
  archPath(g, x, y - s * 0.34, w0 * 0.34, y - s * 0.48, s * 0.12, 0);
  g.fillStyle = lin(g, 0, y - s * 0.6, 0, y - s * 0.34, [[0, '#ffb048'], [1, '#7a2a10']]);
  g.fill();
  // painted lotus buds beside the niche
  for (const sx of [-1, 1]) {
    const lx = x + sx * w0 * 0.58;
    const ly = y - s * 0.5;
    for (const a of [-0.5, 0, 0.5]) ellipse(g, lx + Math.sin(a) * s * 0.03, ly - Math.cos(a) * s * 0.03, s * 0.022, s * 0.045, '#d0304a', a);
    ellipse(g, lx, ly + s * 0.02, s * 0.03, s * 0.012, '#2a7a3a');
  }
  // top with horns
  box(g, x - w0 * 0.98, y - s * 0.8, w0 * 1.96, s * 0.09, stone('#d8b890'));
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sx * w0 * 0.98, y - s * 0.8);
    g.quadraticCurveTo(x + sx * w0 * 1.1, y - s * 0.92, x + sx * w0 * 0.8, y - s * 0.97);
    g.lineTo(x + sx * w0 * 0.62, y - s * 0.8);
    g.closePath();
    g.fillStyle = stone('#d8b890');
    g.fill();
  }
  // soil
  ellipse(g, x, y - s * 0.81, w0 * 0.8, s * 0.035, '#2a160c');
  // tulsi bush: woody stems and leaf clusters (green with the purple of krishna tulsi), lit from below
  g.strokeStyle = '#3a2418';
  g.lineWidth = Math.max(1, s * 0.012);
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.28;
    g.moveTo(x, y - s * 0.82);
    g.lineTo(x + Math.cos(a) * s * 0.45, y - s * 0.82 + Math.sin(a) * s * 0.45);
  }
  g.stroke();
  for (let i = 0; i < 90; i++) {
    const a = -Math.PI / 2 + gauss(rng) * 0.6;
    const d = s * (0.12 + Math.pow(rng(), 0.8) * 0.5);
    const px = x + Math.cos(a) * d * 0.95;
    const py = y - s * 0.84 + Math.sin(a) * d;
    const lit = (px - x) * lightSide > 0 || py > y - s * 1.05;
    g.fillStyle = pick(rng, lit ? ['#5a9a34', '#7ab040', '#4a8030', '#9ab848', '#6a5a6a'] : ['#2a5220', '#36602a', '#4a3a50', '#2e5a26']);
    g.beginPath();
    g.ellipse(px, py, s * 0.05, s * 0.026, rand(rng, 0, Math.PI), 0, TAU);
    g.fill();
  }
  // manjari (flower spikes)
  for (let i = 0; i < 7; i++) {
    const px = x + rand(rng, -0.35, 0.35) * s;
    const py = y - s * rand(rng, 1.15, 1.4);
    line(g, px, py, px + rand(rng, -0.02, 0.02) * s, py - s * 0.09, '#8a4a7a', Math.max(1, s * 0.018));
  }
  // a few marigolds offered at the base
  for (let i = 0; i < 4; i++) marigold(g, rng, x - w0 * 0.9 + i * w0 * 0.6, y - s * 0.03, s * 0.04, i % 2 ? '#ff8a00' : '#ffc23d');
  return { x, y: y - s * 0.4 };
}
