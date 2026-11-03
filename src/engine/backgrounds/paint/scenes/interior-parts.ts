/**
 * Props for the "Traditional Indian Interior" scene: silk drapes, brocade
 * bolsters and cushions, a brass thali and urli, pierced brass lanterns,
 * painted wall motifs and a perspective rug.
 */
import { type Ctx, type Rng, type Pt, TAU, rand, pick, lerp, mix, rgba, wash, ellipse, withState, marigold, diya, lotus } from '../kit';
import { type Flame, lin, rad, box, fillPoly, line } from './house-parts';

/** Silk curtain hanging from (x, top), drawn back to the `side` (+1 right / -1 left) and tied at tieY. */
export function drape(g: Ctx, rng: Rng, x: number, top: number, bottom: number, width: number, tieY: number, side: 1 | -1, color: string, border = '#e8b448') {
  const W = width * side;
  const tie = { x: x + W * 0.72, y: tieY };
  const outer = x + W;
  const path = () => {
    g.moveTo(x, top);
    g.lineTo(outer, top);
    g.lineTo(outer + W * 0.05, bottom);
    g.quadraticCurveTo(outer - W * 0.25, bottom - (bottom - tieY) * 0.08, tie.x - W * 0.12, bottom);
    g.quadraticCurveTo(tie.x - W * 0.05, lerp(tieY, bottom, 0.5), tie.x, tieY);
    g.quadraticCurveTo(x + W * 0.1, lerp(top, tieY, 0.55), x, top);
    g.closePath();
  };
  // body with vertical folds
  g.beginPath();
  path();
  const gr = g.createLinearGradient(x, 0, outer, 0);
  const dark = mix(color, '#12020a', 0.6);
  const lite = mix(color, '#ffd0d8', 0.22);
  const folds = 7;
  for (let i = 0; i <= folds; i++) gr.addColorStop(i / folds, i % 2 ? lite : i === 0 ? mix(color, '#12020a', 0.3) : dark);
  g.fillStyle = gr;
  g.fill();
  withState(g, () => {
    g.beginPath();
    path();
    g.clip();
    // sheen and shadow toward the tie
    wash(g, tie.x, tieY, width * 0.5, (bottom - top) * 0.12, '#000000', 0.35);
    g.strokeStyle = rgba('#000000', 0.2);
    g.lineWidth = Math.max(1, width * 0.025);
    for (let i = 0; i < 6; i++) {
      const fx = lerp(x, outer, (i + 0.5) / 6);
      g.beginPath();
      g.moveTo(fx, top);
      g.quadraticCurveTo(lerp(fx, tie.x, 0.8), tieY - (tieY - top) * 0.1, tie.x + rand(rng, -0.08, 0.08) * W, tieY);
      g.quadraticCurveTo(lerp(tie.x, fx, 0.6), lerp(tieY, bottom, 0.6), lerp(fx, tie.x, 0.2), bottom);
      g.stroke();
    }
    // gold border on the leading edge
    g.strokeStyle = border;
    g.lineWidth = Math.max(1.5, width * 0.06);
    g.beginPath();
    g.moveTo(x, top);
    g.quadraticCurveTo(x + W * 0.1, lerp(top, tieY, 0.55), tie.x, tieY);
    g.quadraticCurveTo(tie.x - W * 0.05, lerp(tieY, bottom, 0.5), tie.x - W * 0.12, bottom);
    g.stroke();
  });
  // tieback rope and tassel
  g.strokeStyle = '#e0a838';
  g.lineWidth = Math.max(1.5, width * 0.05);
  g.beginPath();
  g.moveTo(tie.x - W * 0.08, tieY - width * 0.02);
  g.quadraticCurveTo(tie.x + W * 0.15, tieY + width * 0.06, outer + W * 0.08, tieY - width * 0.03);
  g.stroke();
  tassel(g, outer + W * 0.06, tieY, width * 0.22, '#e0a838');
  return tie;
}

export function tassel(g: Ctx, x: number, y: number, s: number, color: string) {
  ellipse(g, x, y + s * 0.15, s * 0.16, s * 0.16, color);
  g.beginPath();
  g.moveTo(x - s * 0.1, y + s * 0.25);
  g.lineTo(x - s * 0.22, y + s);
  g.lineTo(x + s * 0.22, y + s);
  g.lineTo(x + s * 0.1, y + s * 0.25);
  g.closePath();
  g.fillStyle = lin(g, x - s * 0.2, 0, x + s * 0.2, 0, [[0, mix(color, '#3a1a00', 0.5)], [0.5, mix(color, '#fff0b0', 0.3)], [1, mix(color, '#3a1a00', 0.5)]]);
  g.fill();
}

/** Round bolster (masnad) lying along x, centre (x, y), length L, radius r. */
export function bolster(g: Ctx, x: number, y: number, L: number, r: number, color: string, band = '#e8b448') {
  const x0 = x - L / 2;
  const x1 = x + L / 2;
  wash(g, x, y + r * 0.9, L * 0.55, r * 0.35, '#000000', 0.45);
  g.beginPath();
  g.moveTo(x0, y - r);
  g.lineTo(x1, y - r);
  g.ellipse(x1, y, r * 0.35, r, 0, -Math.PI / 2, Math.PI / 2);
  g.lineTo(x0, y + r);
  g.ellipse(x0, y, r * 0.35, r, 0, Math.PI / 2, Math.PI * 1.5);
  g.closePath();
  g.fillStyle = lin(g, 0, y - r, 0, y + r, [[0, mix(color, '#ffe0c0', 0.35)], [0.35, color], [1, mix(color, '#100208', 0.65)]]);
  g.fill();
  // gold bands and brocade dots
  for (const f of [0.1, 0.9]) box(g, lerp(x0, x1, f) - r * 0.12, y - r * 0.98, r * 0.24, r * 1.96, lin(g, 0, y - r, 0, y + r, [[0, '#fff0b0'], [0.4, band], [1, mix(band, '#2a1000', 0.6)]]));
  g.fillStyle = rgba('#ffd27a', 0.55);
  for (let i = 0; i < 9; i++) {
    for (let j = -1; j <= 1; j++) {
      g.beginPath();
      g.arc(lerp(x0, x1, 0.18 + (i / 8) * 0.64), y + j * r * 0.55, r * 0.07, 0, TAU);
      g.fill();
    }
  }
  // end caps
  ellipse(g, x1, y, r * 0.33, r * 0.95, rad(g, x1, y, 0, r, [[0, mix(color, '#ffd27a', 0.5)], [1, mix(color, '#100208', 0.4)]]));
  ellipse(g, x1, y, r * 0.08, r * 0.2, band);
}

/** Square brocade cushion, centre (x, y), size s, slightly tilted. */
export function cushion(g: Ctx, x: number, y: number, s: number, color: string, rot = 0, accent = '#e8b448') {
  withState(g, () => {
    g.translate(x, y);
    g.rotate(rot);
    const k = s / 2;
    wash(g, 0, k * 0.9, k * 1.1, k * 0.25, '#000000', 0.45);
    g.beginPath();
    g.moveTo(-k, -k);
    g.quadraticCurveTo(0, -k * 0.82, k, -k);
    g.quadraticCurveTo(k * 0.84, 0, k, k);
    g.quadraticCurveTo(0, k * 0.86, -k, k);
    g.quadraticCurveTo(-k * 0.84, 0, -k, -k);
    g.closePath();
    g.fillStyle = rad(g, -k * 0.3, -k * 0.35, k * 0.1, k * 1.5, [[0, mix(color, '#ffe8d0', 0.35)], [0.6, color], [1, mix(color, '#100208', 0.6)]]);
    g.fill();
    // border and medallion
    g.strokeStyle = accent;
    g.lineWidth = Math.max(1, s * 0.05);
    g.beginPath();
    g.moveTo(-k * 0.78, -k * 0.74);
    g.quadraticCurveTo(0, -k * 0.6, k * 0.78, -k * 0.74);
    g.quadraticCurveTo(k * 0.64, 0, k * 0.78, k * 0.74);
    g.quadraticCurveTo(0, k * 0.64, -k * 0.78, k * 0.74);
    g.quadraticCurveTo(-k * 0.64, 0, -k * 0.78, -k * 0.74);
    g.stroke();
    g.beginPath();
    g.moveTo(0, -k * 0.42);
    g.lineTo(k * 0.42, 0);
    g.lineTo(0, k * 0.42);
    g.lineTo(-k * 0.42, 0);
    g.closePath();
    g.fillStyle = rgba(accent, 0.85);
    g.fill();
    ellipse(g, 0, 0, k * 0.16, k * 0.16, mix(color, '#100208', 0.3));
    for (const [cx, cy] of [
      [-k, -k],
      [k, -k],
      [k, k],
      [-k, k],
    ] as const)
      ellipse(g, cx, cy, s * 0.05, s * 0.05, accent);
  });
}

/** Brass plate (thali) seen at an angle with diyas, ladoos and flowers. Returns diya flames. */
export function thali(g: Ctx, rng: Rng, x: number, y: number, r: number, tilt: number): Flame[] {
  const ry = r * tilt;
  wash(g, x, y + ry * 0.4, r * 1.1, ry * 0.8, '#000000', 0.45);
  ellipse(g, x, y + ry * 0.08, r, ry, '#5a3408');
  ellipse(g, x, y, r, ry, lin(g, x - r, 0, x + r, 0, [[0, '#7a4c10'], [0.35, '#f0c050'], [0.5, '#fff0b0'], [0.7, '#d9a440'], [1, '#6a3c08']]));
  ellipse(g, x, y, r * 0.86, ry * 0.86, lin(g, x - r, y - ry, x + r, y + ry, [[0, '#c08a2a'], [0.5, '#f8d880'], [1, '#9a6a1a']]));
  g.strokeStyle = rgba('#7a4c10', 0.6);
  g.lineWidth = Math.max(1, r * 0.02);
  g.beginPath();
  g.ellipse(x, y, r * 0.7, ry * 0.7, 0, 0, TAU);
  g.stroke();
  // petals
  for (let i = 0; i < 18; i++) {
    const a = rand(rng, 0, TAU);
    const d = Math.sqrt(rng()) * 0.8;
    ellipse(g, x + Math.cos(a) * r * d, y + Math.sin(a) * ry * d, r * 0.05, r * 0.03, pick(rng, ['#e2412b', '#ff8a00', '#ffc23d', '#d6247b']), rand(rng, 0, Math.PI));
  }
  // kumkum and haldi bowls
  for (const [dx, c] of [
    [-0.35, '#d0202a'],
    [-0.12, '#ffb000'],
  ] as const) {
    ellipse(g, x + dx * r, y - ry * 0.35, r * 0.1, r * 0.1 * tilt * 1.6, '#e8b448');
    ellipse(g, x + dx * r, y - ry * 0.38, r * 0.075, r * 0.075 * tilt * 1.4, c);
  }
  // ladoos stacked
  const lx = x + r * 0.3;
  const ly = y - ry * 0.1;
  const lr = r * 0.085;
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, 0.25],
    [-0.5, -0.8],
    [0.5, -0.8],
    [0, -1.55],
  ] as const) {
    const px = lx + dx * lr * 1.05;
    const py = ly + dy * lr * 1.05;
    ellipse(g, px, py, lr, lr, rad(g, px - lr * 0.3, py - lr * 0.35, lr * 0.1, lr, [[0, '#ffd27a'], [0.6, '#f08a1a'], [1, '#a0480a']]));
  }
  // flowers
  marigold(g, rng, x - r * 0.55, y + ry * 0.25, r * 0.1, '#ff8a00');
  marigold(g, rng, x - r * 0.38, y + ry * 0.45, r * 0.09, '#ffc23d');
  lotus(g, x + r * 0.62, y + ry * 0.3, r * 0.22, '#f06292');
  // diyas
  const out: Flame[] = [];
  for (const [dx, dy] of [
    [-0.05, 0.35],
    [0.25, 0.55],
    [-0.62, -0.25],
  ] as const) {
    const s = r * 0.26;
    const f = diya(g, x + dx * r, y + dy * ry, s, { dir: dx > 0 ? -1 : 1 });
    out.push({ x: f.x, y: f.y, s, i: 1 });
  }
  return out;
}

/** Wide brass urli with water, floating flowers and diyas. Returns diya flames. */
export function urli(g: Ctx, rng: Rng, x: number, y: number, r: number, tilt: number): Flame[] {
  const ry = r * tilt;
  const depth = r * 0.32;
  wash(g, x, y + depth, r * 1.15, ry * 0.7, '#000000', 0.5);
  // bowl body
  g.beginPath();
  g.moveTo(x - r, y);
  g.bezierCurveTo(x - r * 0.95, y + depth * 1.1, x - r * 0.4, y + depth * 1.35, x, y + depth * 1.35);
  g.bezierCurveTo(x + r * 0.4, y + depth * 1.35, x + r * 0.95, y + depth * 1.1, x + r, y);
  g.closePath();
  g.fillStyle = lin(g, x - r, 0, x + r, 0, [[0, '#4a2a06'], [0.3, '#c8902e'], [0.45, '#ffe9a8'], [0.62, '#d9a440'], [1, '#3a2004']]);
  g.fill();
  // rim
  ellipse(g, x, y, r * 1.02, ry * 1.02, lin(g, x - r, 0, x + r, 0, [[0, '#6a4410'], [0.4, '#ffe08a'], [1, '#5a3a08']]));
  // water
  ellipse(g, x, y + ry * 0.04, r * 0.92, ry * 0.88, lin(g, 0, y - ry, 0, y + ry, [[0, '#0d2a2e'], [0.6, '#1d4a48'], [1, '#2a5a50']]));
  // reflections
  wash(g, x - r * 0.2, y, r * 0.5, ry * 0.25, '#ffb060', 0.25);
  // floating flowers
  for (let i = 0; i < 16; i++) {
    const a = rand(rng, 0, TAU);
    const d = Math.sqrt(rng()) * 0.78;
    const px = x + Math.cos(a) * r * d;
    const py = y + Math.sin(a) * ry * d;
    if (i % 4 === 0) {
      // rose: layered red petals
      ellipse(g, px, py, r * 0.08, r * 0.08 * tilt * 1.6, '#9a0a24');
      ellipse(g, px, py - r * 0.01, r * 0.055, r * 0.055 * tilt * 1.6, '#d81f3a');
      ellipse(g, px, py - r * 0.015, r * 0.025, r * 0.025 * tilt * 1.6, '#ff6070');
    } else ellipse(g, px, py, r * 0.04, r * 0.022, pick(rng, ['#ff8a00', '#ffc23d', '#e2412b', '#f8f0e0', '#d6247b']), rand(rng, 0, Math.PI));
  }
  // lotus in the middle
  lotus(g, x + r * 0.1, y + ry * 0.1, r * 0.3, '#f06292');
  const out: Flame[] = [];
  for (const [dx, dy] of [
    [-0.5, -0.1],
    [0.55, -0.2],
    [-0.1, 0.5],
  ] as const) {
    const s = r * 0.2;
    const f = diya(g, x + dx * r, y + dy * ry, s, { dir: dx > 0 ? -1 : 1, clay: '#c4642e' });
    out.push({ x: f.x, y: f.y, s, i: 1 });
  }
  return out;
}

/** Pierced brass hanging lantern. Returns the centre of its light. */
export function brassLantern(g: Ctx, x: number, top: number, y: number, s: number): Pt {
  // chain
  g.strokeStyle = '#6a4410';
  g.lineWidth = Math.max(1, s * 0.03);
  g.setLineDash([s * 0.06, s * 0.04]);
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x, y - s * 0.62);
  g.stroke();
  g.setLineDash([]);
  const metal = lin(g, x - s * 0.4, 0, x + s * 0.4, 0, [[0, '#4a2c08'], [0.3, '#c8902e'], [0.5, '#ffe9a8'], [0.7, '#d9a440'], [1, '#3a2004']]);
  // dome cap
  g.beginPath();
  g.moveTo(x - s * 0.34, y - s * 0.3);
  g.bezierCurveTo(x - s * 0.34, y - s * 0.55, x - s * 0.1, y - s * 0.6, x, y - s * 0.66);
  g.bezierCurveTo(x + s * 0.1, y - s * 0.6, x + s * 0.34, y - s * 0.55, x + s * 0.34, y - s * 0.3);
  g.closePath();
  g.fillStyle = metal;
  g.fill();
  // glass body with panels
  fillPoly(g, [{ x: x - s * 0.34, y: y - s * 0.3 }, { x: x + s * 0.34, y: y - s * 0.3 }, { x: x + s * 0.26, y: y + s * 0.3 }, { x: x - s * 0.26, y: y + s * 0.3 }], lin(g, 0, y - s * 0.3, 0, y + s * 0.3, [[0, '#ffcf73'], [0.5, '#ff9a3a'], [1, '#c8501a']]));
  g.strokeStyle = metal;
  g.lineWidth = Math.max(1, s * 0.05);
  g.beginPath();
  for (const f of [-1, -0.33, 0.33, 1]) {
    g.moveTo(x + f * s * 0.34, y - s * 0.3);
    g.lineTo(x + f * s * 0.26, y + s * 0.3);
  }
  g.stroke();
  // pierced band and base
  box(g, x - s * 0.36, y - s * 0.34, s * 0.72, s * 0.08, metal);
  box(g, x - s * 0.3, y + s * 0.28, s * 0.6, s * 0.08, metal);
  g.beginPath();
  g.moveTo(x - s * 0.2, y + s * 0.36);
  g.quadraticCurveTo(x, y + s * 0.62, x + s * 0.2, y + s * 0.36);
  g.closePath();
  g.fillStyle = metal;
  g.fill();
  ellipse(g, x, y + s * 0.62, s * 0.05, s * 0.05, '#d9a440');
  return { x, y };
}

/** Small painted flower motif (buti). */
export function buti(g: Ctx, x: number, y: number, s: number, petal: string, centre: string, alpha = 1) {
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    ellipse(g, x + Math.cos(a) * s * 0.42, y + Math.sin(a) * s * 0.42, s * 0.3, s * 0.16, rgba(petal, alpha), a);
  }
  ellipse(g, x, y, s * 0.18, s * 0.18, rgba(centre, alpha));
}

/** Rug in perspective: corners [backLeft, backRight, frontRight, frontLeft]. */
export function rug(g: Ctx, rng: Rng, q: Pt[], field: string, border: string, accent: string) {
  const at = (u: number, v: number): Pt => {
    // bilinear inside the quad (u across, v back->front)
    const a = { x: lerp(q[0].x, q[1].x, u), y: lerp(q[0].y, q[1].y, u) };
    const b = { x: lerp(q[3].x, q[2].x, u), y: lerp(q[3].y, q[2].y, u) };
    return { x: lerp(a.x, b.x, v), y: lerp(a.y, b.y, v) };
  };
  // perspective-correct v: depth compresses toward the back
  const pv = (t: number) => (t * t * 0.35 + t * 0.65);
  const quad = (u0: number, v0: number, u1: number, v1: number) => [at(u0, pv(v0)), at(u1, pv(v0)), at(u1, pv(v1)), at(u0, pv(v1))];
  fillPoly(g, q, border);
  fillPoly(g, quad(0.04, 0.05, 0.96, 0.95), accent);
  fillPoly(g, quad(0.07, 0.09, 0.93, 0.91), mix(border, '#000000', 0.2));
  fillPoly(g, quad(0.1, 0.13, 0.9, 0.87), field);
  // border motifs
  for (let i = 0; i < 22; i++) {
    const t = (i + 0.5) / 22;
    for (const v of [0.07, 0.93]) {
      const p = at(t, pv(v));
      ellipse(g, p.x, p.y, (q[1].x - q[0].x) * 0.006 * (1 + v), (q[1].x - q[0].x) * 0.004 * (1 + v), accent);
    }
  }
  // field lattice of small lozenges
  for (let j = 1; j < 9; j++) {
    for (let i = 1; i < 12; i++) {
      if ((i + j) % 2) continue;
      const c = at(0.1 + 0.8 * (i / 12), pv(0.13 + 0.74 * (j / 9)));
      const s = Math.abs(at(0.1 + 0.8 * ((i + 0.5) / 12), pv(0.13 + 0.74 * (j / 9))).x - c.x);
      fillPoly(g, [{ x: c.x, y: c.y - s * 0.35 }, { x: c.x + s * 0.5, y: c.y }, { x: c.x, y: c.y + s * 0.35 }, { x: c.x - s * 0.5, y: c.y }], rgba(pick(rng, [accent, '#1f6a64', '#f2d8a0']), 0.75));
    }
  }
  // central medallion
  const m = at(0.5, pv(0.5));
  const mw = Math.abs(at(0.72, pv(0.5)).x - m.x);
  const mh = Math.abs(at(0.5, pv(0.72)).y - m.y);
  ellipse(g, m.x, m.y, mw, mh, accent);
  ellipse(g, m.x, m.y, mw * 0.82, mh * 0.82, mix(border, '#000000', 0.1));
  ellipse(g, m.x, m.y, mw * 0.5, mh * 0.5, '#1f6a64');
  ellipse(g, m.x, m.y, mw * 0.2, mh * 0.2, accent);
}

/** A strand of small brass bells. */
export function bellStrand(g: Ctx, x: number, y: number, L: number, s: number) {
  line(g, x, y, x, y + L, '#8a5a14', Math.max(1, s * 0.08));
  for (let i = 1; i <= 3; i++) {
    const by = y + (L * i) / 3;
    const k = s * (0.7 + i * 0.15);
    g.beginPath();
    g.moveTo(x, by - k * 0.6);
    g.bezierCurveTo(x + k * 0.55, by - k * 0.6, x + k * 0.5, by + k * 0.3, x + k * 0.72, by + k * 0.5);
    g.lineTo(x - k * 0.72, by + k * 0.5);
    g.bezierCurveTo(x - k * 0.5, by + k * 0.3, x - k * 0.55, by - k * 0.6, x, by - k * 0.6);
    g.fillStyle = lin(g, x - k, 0, x + k, 0, [[0, '#6a4410'], [0.45, '#ffe08a'], [1, '#7a5014']]);
    g.fill();
  }
}
