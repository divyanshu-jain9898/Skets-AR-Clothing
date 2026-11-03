/**
 * Detailed lamp, brass and flower primitives shared by the 'diyas' and
 * 'festive' scenes. Everything consumes a fixed amount of randomness per call
 * (independent of pixel size) so thumbnails match the full-size painting.
 */
import { TAU, ellipse, glow, lerp, mix, mulberry32, rand, resample, rgba, wash, withBlend, withState, type Ctx, type Pt, type Rng } from '../kit';

/** Independent random stream derived from `rng` (one draw from the parent). */
export const fork = (rng: Rng): Rng => mulberry32(Math.floor(rng() * 4294967296));

export interface Flame {
  x: number;
  y: number;
  /** Flame height in px. */
  h: number;
  /** Halo strength (1 = normal). */
  halo: number;
}

// ------------------------------------------------------------------ flames
/** Oil-lamp flame with its halo, drawn additively (lights pass). */
export function flame(g: Ctx, rng: Rng, f: Flame) {
  const { x, y, h, halo } = f;
  const lean = rand(rng, -0.12, 0.12) * h;
  const fat = rand(rng, 0.85, 1.1);
  const flick = rand(rng, 0.85, 1.15);
  if (halo > 0) {
    glow(g, x, y - h * 0.35, h * 4.5, '#ff7414', 0.11 * halo * flick);
    glow(g, x, y - h * 0.45, h * 1.7, '#ffb347', 0.3 * halo * flick);
  }
  const w = h * 0.29 * fat;
  const body = (k: number) => {
    const tx = x + lean * k;
    const ty = y - h * k;
    const by = y + w * 0.55 * k;
    g.beginPath();
    g.moveTo(x, by);
    g.bezierCurveTo(x - w * 1.1 * k, by - w * 0.1 * k, x - w * 0.75 * k + lean * 0.25 * k, y - h * 0.42 * k, tx, ty);
    g.bezierCurveTo(x + w * 0.75 * k + lean * 0.25 * k, y - h * 0.42 * k, x + w * 1.1 * k, by - w * 0.1 * k, x, by);
    g.closePath();
  };
  withBlend(g, 'lighter', () => {
    body(1);
    const fg = g.createLinearGradient(x, y + w * 0.5, x + lean, y - h);
    fg.addColorStop(0, 'rgba(255,96,10,0.75)');
    fg.addColorStop(0.3, 'rgba(255,170,60,0.95)');
    fg.addColorStop(0.75, 'rgba(255,120,20,0.6)');
    fg.addColorStop(1, 'rgba(255,70,0,0)');
    g.fillStyle = fg;
    g.fill();
    body(0.62);
    const cg = g.createLinearGradient(x, y + w * 0.3, x + lean * 0.6, y - h * 0.62);
    cg.addColorStop(0, 'rgba(255,255,245,1)');
    cg.addColorStop(0.55, 'rgba(255,240,180,0.95)');
    cg.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = cg;
    g.fill();
  });
  // blue root
  ellipse(g, x, y + w * 0.3, w * 0.42, w * 0.22, 'rgba(110,150,255,0.35)');
}

// ------------------------------------------------------------------ clay diya
export interface ClayDiyaOpts {
  clay?: string;
  /** Painted band under the rim. */
  band?: string;
  /** Dot row colour. */
  dots?: string;
  /** Painted rim line. */
  rim?: string;
  /** Spout direction. */
  dir?: 1 | -1;
  /** Rim ellipse ry / rx (view angle). */
  tilt?: number;
  /** Contact-shadow strength. */
  shadow?: number;
}

/**
 * Earthen diya at (x, y) = centre of the rim, `s` = bowl width.
 * Returns the flame root (spout tip).
 */
export function clayDiya(g: Ctx, x: number, y: number, s: number, o: ClayDiyaOpts = {}): Pt {
  const D = o.dir ?? 1;
  const clay = o.clay ?? '#b4532a';
  const tilt = o.tilt ?? 0.34;
  const rx = s * 0.5;
  const ry = rx * tilt;
  const depth = s * 0.34;
  const tipX = x + D * s * 0.7;
  const tipY = y - ry * 0.35;
  if ((o.shadow ?? 0.55) > 0) wash(g, x + D * s * 0.08, y + depth * 0.95, s * 0.7, s * 0.11, '#000000', o.shadow ?? 0.55);
  // body with the spout underside
  g.beginPath();
  g.moveTo(x - D * rx, y);
  g.bezierCurveTo(x - D * rx * 0.98, y + depth * 0.8, x - D * rx * 0.4, y + depth, x + D * rx * 0.1, y + depth);
  g.bezierCurveTo(x + D * rx * 0.62, y + depth, x + D * rx * 0.88, y + depth * 0.6, x + D * rx * 1.04, y + depth * 0.3);
  g.quadraticCurveTo(x + D * s * 0.62, y + depth * 0.06, tipX, tipY);
  g.lineTo(x + D * rx * 0.4, y - ry);
  g.lineTo(x - D * rx * 0.4, y - ry);
  g.closePath();
  const bg = g.createLinearGradient(0, y - ry, 0, y + depth);
  bg.addColorStop(0, mix(clay, '#ffcf9a', 0.3));
  bg.addColorStop(0.4, clay);
  bg.addColorStop(1, mix(clay, '#120302', 0.72));
  g.fillStyle = bg;
  g.fill();
  const sg = g.createLinearGradient(x - D * rx, 0, x + D * rx * 1.2, 0);
  sg.addColorStop(0, 'rgba(12,2,0,0.5)');
  sg.addColorStop(0.55, 'rgba(12,2,0,0)');
  sg.addColorStop(1, 'rgba(255,170,90,0.18)');
  g.fillStyle = sg;
  g.fill();
  if (o.band || o.dots) {
    withState(g, () => {
      g.clip();
      if (o.band) {
        g.strokeStyle = o.band;
        g.lineWidth = Math.max(1, s * 0.075);
        g.beginPath();
        g.ellipse(x, y + depth * 0.2, rx * 1.02, ry + depth * 0.05, 0, 0.02 * Math.PI, 0.98 * Math.PI);
        g.stroke();
      }
      if (o.dots) {
        g.fillStyle = o.dots;
        for (let i = 0; i < 7; i++) {
          const a = (0.14 + (0.72 * i) / 6) * Math.PI;
          g.beginPath();
          g.arc(x + Math.cos(a) * rx * 0.86, y + depth * 0.5 + Math.sin(a) * ry * 0.9, Math.max(0.6, s * 0.034), 0, TAU);
          g.fill();
        }
      }
    });
  }
  // rim: ellipse + spout lip
  const lip = g.createLinearGradient(x - D * rx, 0, tipX, 0);
  lip.addColorStop(0, mix(clay, '#2a0a02', 0.25));
  lip.addColorStop(0.6, mix(clay, '#ffc890', 0.32));
  lip.addColorStop(1, mix(clay, '#ffe0b0', 0.5));
  g.fillStyle = lip;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x + D * rx * 0.45, y - ry * 0.95);
  g.quadraticCurveTo(x + D * rx * 1.08, y - ry * 0.85, tipX, tipY);
  g.quadraticCurveTo(x + D * rx * 1.08, y + ry * 1.05, x + D * rx * 0.45, y + ry * 0.95);
  g.closePath();
  g.fill();
  if (o.rim) {
    g.strokeStyle = o.rim;
    g.lineWidth = Math.max(0.8, s * 0.04);
    g.beginPath();
    g.ellipse(x, y, rx * 0.97, ry * 0.92, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    g.stroke();
  }
  // inside the bowl, lit by its own flame
  const ig = g.createRadialGradient(x + D * rx * 0.55, y - ry * 0.2, 0, x + D * rx * 0.3, y, rx * 1.25);
  ig.addColorStop(0, '#f0a060');
  ig.addColorStop(0.35, '#9a4318');
  ig.addColorStop(1, '#2a0c04');
  ellipse(g, x - D * rx * 0.03, y + ry * 0.04, rx * 0.84, ry * 0.72, ig);
  // spout channel
  g.beginPath();
  g.moveTo(x + D * rx * 0.62, y - ry * 0.3);
  g.quadraticCurveTo(x + D * rx * 1.0, y - ry * 0.32, tipX - D * s * 0.05, tipY + ry * 0.06);
  g.quadraticCurveTo(x + D * rx * 1.0, y + ry * 0.42, x + D * rx * 0.62, y + ry * 0.3);
  g.closePath();
  g.fillStyle = '#3a1406';
  g.fill();
  // oil with a reflection of the flame
  const og = g.createLinearGradient(0, y - ry * 0.3, 0, y + ry * 0.7);
  og.addColorStop(0, '#5a2a08');
  og.addColorStop(1, '#1e0a02');
  ellipse(g, x - D * rx * 0.08, y + ry * 0.18, rx * 0.64, ry * 0.46, og);
  ellipse(g, x + D * rx * 0.22, y + ry * 0.12, rx * 0.2, ry * 0.12, 'rgba(255,205,130,0.6)');
  // cotton wick
  g.strokeStyle = '#e9d8b4';
  g.lineCap = 'round';
  g.lineWidth = Math.max(0.8, s * 0.045);
  g.beginPath();
  g.moveTo(x + D * rx * 0.5, y + ry * 0.12);
  g.quadraticCurveTo(x + D * rx * 0.95, y + ry * 0.05, tipX - D * s * 0.04, tipY - ry * 0.12);
  g.stroke();
  return { x: tipX - D * s * 0.04, y: tipY - ry * 0.18 };
}

// ------------------------------------------------------------------ brass
let brassTone = 0;

/** Draws `fn` with all brass darkened and rim-lit (a backlit foreground object). */
export function backlit(t: number, fn: () => void) {
  const prev = brassTone;
  brassTone = t;
  try {
    fn();
  } finally {
    brassTone = prev;
  }
}

/** Horizontal brass gradient for turned (round) objects; `hl` = highlight position 0..1. */
export function brassH(g: Ctx, x0: number, x1: number, hl = 0.42, dark = 0): CanvasGradient {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  const k = Math.max(dark, brassTone);
  const d = (c: string) => (k > 0 ? mix(c, '#140800', k) : c);
  gr.addColorStop(0, brassTone > 0 ? '#c88a3a' : d('#2a1503'));
  if (brassTone > 0) gr.addColorStop(0.04, d('#2a1503'));
  gr.addColorStop(Math.max(0.05, hl - 0.26), d('#7a4a10'));
  gr.addColorStop(Math.max(0.06, hl - 0.1), d('#d29a3a'));
  gr.addColorStop(hl, d('#ffeeb0'));
  gr.addColorStop(Math.min(0.94, hl + 0.1), d('#d09432'));
  gr.addColorStop(Math.min(0.95, hl + 0.32), d('#6a400c'));
  if (brassTone > 0) gr.addColorStop(0.96, d('#1e0e02'));
  gr.addColorStop(1, brassTone > 0 ? '#e8a850' : d('#1e0e02'));
  return gr;
}

/**
 * Lathe-turned silhouette (lamp stems, pots). `prof` lists [height above
 * base, radius] pairs from bottom to top, in px. The outline is smoothed and
 * the bottom closes with the front arc of an ellipse (`tilt` = ry/rx).
 */
export function lathe(g: Ctx, x: number, base: number, prof: [number, number][], fill: string | CanvasGradient, tilt = 0.22) {
  const n = prof.length;
  const P = (i: number, side: number): Pt => ({ x: x + side * prof[i][1], y: base - prof[i][0] });
  g.beginPath();
  const a0 = P(0, -1);
  g.moveTo(a0.x, a0.y);
  for (let i = 1; i < n - 1; i++) {
    const p = P(i, -1);
    const q = P(i + 1, -1);
    g.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  const top = P(n - 1, -1);
  g.lineTo(top.x, top.y);
  g.ellipse(x, base - prof[n - 1][0], prof[n - 1][1], prof[n - 1][1] * tilt, 0, Math.PI, TAU);
  for (let i = n - 2; i > 0; i--) {
    const p = P(i, 1);
    const q = P(i - 1, 1);
    g.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
  }
  const b = P(0, 1);
  g.lineTo(b.x, b.y);
  g.ellipse(x, base - prof[0][0], prof[0][1], prof[0][1] * tilt, 0, 0, Math.PI);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

/** Thin elliptical ring highlight around a turned object at height y. */
function ringLine(g: Ctx, x: number, y: number, r: number, tilt: number, color: string, width: number) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.beginPath();
  g.ellipse(x, y, r, r * tilt, 0, 0.08 * Math.PI, 0.92 * Math.PI);
  g.stroke();
}

/**
 * South-Indian kuthu vilakku (tall brass lamp) standing at (x, base), height H.
 * Returns flame roots of its wicks.
 */
export function kuthuVilakku(g: Ctx, x: number, base: number, H: number): Pt[] {
  const k = H;
  glow(g, x, base - k * 0.66, k * 0.32, '#ff9a3a', 0.2);
  wash(g, x, base + k * 0.005, k * 0.34, k * 0.05, '#000000', 0.6);
  const T = 0.24;
  // foot and lower stem
  const lower: [number, number][] = [
    [0, 0.17], [0.012, 0.18], [0.026, 0.17], [0.04, 0.145], [0.06, 0.105], [0.08, 0.065], [0.095, 0.048], [0.105, 0.04],
    [0.12, 0.034], [0.14, 0.05], [0.165, 0.058], [0.19, 0.04], [0.21, 0.026], [0.3, 0.021], [0.325, 0.042], [0.345, 0.046],
    [0.365, 0.028], [0.38, 0.02], [0.47, 0.017], [0.485, 0.034], [0.5, 0.02], [0.55, 0.019], [0.57, 0.035], [0.585, 0.05],
  ].map(([a, b]) => [a * k, b * k] as [number, number]);
  lathe(g, x, base, lower, brassH(g, x - k * 0.18, x + k * 0.18, 0.38), T);
  for (const [hh, rr] of [[0.012, 0.18], [0.165, 0.058], [0.345, 0.046], [0.485, 0.034]] as const)
    ringLine(g, x, base - hh * k, rr * k * 0.98, T, 'rgba(255,236,170,0.55)', Math.max(0.8, k * 0.004));
  // oil bowl with five spouts
  const by = base - k * 0.655;
  const br = k * 0.145;
  const bowl: [number, number][] = [[0.575, 0.04], [0.592, 0.085], [0.612, 0.12], [0.635, 0.138], [0.655, 0.145]].map(([a, b]) => [a * k, b * k] as [number, number]);
  lathe(g, x, base, bowl, brassH(g, x - br, x + br, 0.36), T);
  const flames: Pt[] = [];
  const spouts = [Math.PI * 1.0, Math.PI * 0.78, Math.PI * 0.5, Math.PI * 0.22, 0];
  // back rim / oil
  ellipse(g, x, by, br, br * T, brassH(g, x - br, x + br, 0.62, 0.15));
  ellipse(g, x, by + br * T * 0.12, br * 0.86, br * T * 0.7, '#2a1203');
  ellipse(g, x - br * 0.1, by + br * T * 0.15, br * 0.5, br * T * 0.32, 'rgba(255,190,90,0.35)');
  for (const a of spouts) {
    const cx = x + Math.cos(a) * br * 0.98;
    const cy = by + Math.sin(a) * br * T * 0.98;
    const tx = x + Math.cos(a) * br * 1.34;
    const ty = by + Math.sin(a) * br * T * 1.34 - k * 0.008;
    const nx = -Math.sin(a);
    const ny = Math.cos(a) * T;
    const sw = br * 0.2;
    g.beginPath();
    g.moveTo(cx + nx * sw, cy + ny * sw);
    g.quadraticCurveTo(lerp(cx, tx, 0.7) + nx * sw * 0.6, lerp(cy, ty, 0.7) + ny * sw * 0.6, tx, ty);
    g.quadraticCurveTo(lerp(cx, tx, 0.7) - nx * sw * 0.6, lerp(cy, ty, 0.7) - ny * sw * 0.6, cx - nx * sw, cy - ny * sw);
    g.closePath();
    g.fillStyle = brassH(g, cx - sw * 2, cx + sw * 2, 0.4);
    g.fill();
    flames.push({ x: lerp(cx, tx, 0.85), y: lerp(cy, ty, 0.85) - k * 0.004 });
  }
  // front lip highlight
  ringLine(g, x, by, br * 0.99, T, 'rgba(255,240,190,0.7)', Math.max(0.8, k * 0.005));
  // upper shaft and a turned lotus-bud finial
  const upper: [number, number][] = [
    [0.655, 0.02], [0.7, 0.014], [0.72, 0.028], [0.74, 0.014], [0.8, 0.013], [0.815, 0.03], [0.83, 0.018], [0.845, 0.03], [0.875, 0.042], [0.905, 0.034], [0.935, 0.016], [0.965, 0.004],
  ].map(([a, b]) => [a * k, b * k] as [number, number]);
  lathe(g, x, base, upper, brassH(g, x - k * 0.042, x + k * 0.042, 0.4), T);
  ringLine(g, x, base - k * 0.815, k * 0.029, T, 'rgba(255,236,170,0.55)', Math.max(0.8, k * 0.003));
  return flames;
}

/** Chain hanging straight down from (x, y0) to y1, link size `l`. */
export function chain(g: Ctx, x: number, y0: number, y1: number, l: number) {
  const n = Math.max(2, Math.round((y1 - y0) / (l * 0.85)));
  const step = (y1 - y0) / n;
  g.lineWidth = Math.max(0.7, l * 0.18);
  for (let i = 0; i < n; i++) {
    const cy = y0 + step * (i + 0.5);
    g.strokeStyle = i % 2 ? '#b07a26' : '#e2b35a';
    g.beginPath();
    if (i % 2) g.ellipse(x, cy, l * 0.12, step * 0.62, 0, 0, TAU);
    else g.ellipse(x, cy, l * 0.32, step * 0.6, 0, 0, TAU);
    g.stroke();
  }
}

/**
 * Hanging brass lamp (thooku vilakku): chain from the top, a domed canopy,
 * three thin chains carrying a five-wick bowl and a bell. Returns flames.
 */
export function hangingLamp(g: Ctx, x: number, top: number, bowlY: number, s: number): Pt[] {
  const canopyY = bowlY - s * 0.75;
  chain(g, x, top, canopyY - s * 0.12, s * 0.09);
  // canopy dome
  const dome: [number, number][] = [[0, 0.05], [0.025, 0.15], [0.06, 0.23], [0.1, 0.25], [0.14, 0.2], [0.18, 0.12], [0.22, 0.075], [0.26, 0.06], [0.29, 0.03], [0.33, 0.012]].map(([a, b]) => [a * s, b * s] as [number, number]);
  lathe(g, x, canopyY + s * 0.12, dome, brassH(g, x - s * 0.25, x + s * 0.25, 0.4), 0.25);
  // three chains to the bowl
  g.strokeStyle = 'rgba(200,150,60,0.85)';
  g.lineWidth = Math.max(0.7, s * 0.014);
  for (const dx of [-0.42, 0, 0.42]) {
    g.beginPath();
    g.moveTo(x + dx * s * 0.35, canopyY + s * 0.1);
    g.lineTo(x + dx * s, bowlY - (dx === 0 ? s * 0.08 : 0));
    g.stroke();
  }
  // bowl
  const br = s * 0.5;
  const T = 0.26;
  const bowl: [number, number][] = [[-0.3, 0.04], [-0.25, 0.14], [-0.17, 0.3], [-0.08, 0.44], [0, 0.5]].map(([a, b]) => [a * s, b * s] as [number, number]);
  // bell under the bowl
  const bellTop = bowlY + s * 0.32;
  g.strokeStyle = '#b8862e';
  g.beginPath();
  g.moveTo(x, bowlY + s * 0.28);
  g.lineTo(x, bellTop + s * 0.1);
  g.stroke();
  const bell: [number, number][] = [[-0.38, 0.17], [-0.34, 0.15], [-0.26, 0.11], [-0.16, 0.08], [-0.08, 0.04]].map(([a, b]) => [a * s, b * s] as [number, number]);
  lathe(g, x, bellTop, bell, brassH(g, x - s * 0.17, x + s * 0.17, 0.4), 0.3);
  ellipse(g, x, bellTop + s * 0.4, s * 0.04, s * 0.04, '#8a5a14');
  lathe(g, x, bowlY, bowl, brassH(g, x - br, x + br, 0.38), T);
  ellipse(g, x, bowlY, br, br * T, brassH(g, x - br, x + br, 0.6, 0.15));
  ellipse(g, x, bowlY + br * T * 0.1, br * 0.84, br * T * 0.68, '#2a1203');
  const flames: Pt[] = [];
  for (const a of [Math.PI, Math.PI * 0.72, Math.PI * 0.28, 0, Math.PI * 0.5]) {
    const cx = x + Math.cos(a) * br * 0.98;
    const cy = bowlY + Math.sin(a) * br * T * 0.98;
    const tx = x + Math.cos(a) * br * 1.3;
    const ty = bowlY + Math.sin(a) * br * T * 1.3 - s * 0.01;
    const nx = -Math.sin(a);
    const ny = Math.cos(a) * T;
    const sw = br * 0.16;
    g.beginPath();
    g.moveTo(cx + nx * sw, cy + ny * sw);
    g.quadraticCurveTo(lerp(cx, tx, 0.7) + nx * sw * 0.5, lerp(cy, ty, 0.7) + ny * sw * 0.5, tx, ty);
    g.quadraticCurveTo(lerp(cx, tx, 0.7) - nx * sw * 0.5, lerp(cy, ty, 0.7) - ny * sw * 0.5, cx - nx * sw, cy - ny * sw);
    g.closePath();
    g.fillStyle = brassH(g, cx - sw * 2, cx + sw * 2, 0.4);
    g.fill();
    flames.push({ x: lerp(cx, tx, 0.85), y: lerp(cy, ty, 0.85) - s * 0.006 });
  }
  ringLine(g, x, bowlY, br * 0.99, T, 'rgba(255,240,190,0.7)', Math.max(0.8, s * 0.02));
  return flames;
}

// ------------------------------------------------------------------ flowers
/** Marigold (genda) head; fixed randomness per call. */
export function genda(g: Ctx, rng: Rng, x: number, y: number, r: number, color: string, squash = 1) {
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.35 * squash, r * 0.1, x, y, r);
  grd.addColorStop(0, mix(color, '#fff3a0', 0.5));
  grd.addColorStop(0.6, color);
  grd.addColorStop(1, mix(color, '#4a1200', 0.55));
  ellipse(g, x, y, r, r * squash, grd);
  const lw = Math.max(0.6, r * 0.12);
  g.lineWidth = lw;
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU;
    const d = r * Math.sqrt(rng()) * 0.75;
    const pr = r * (0.22 + rng() * 0.16);
    const dark = rng() < 0.5;
    g.strokeStyle = dark ? rgba(mix(color, '#5a1500', 0.55), 0.6) : rgba(mix(color, '#fff2a0', 0.5), 0.6);
    g.beginPath();
    g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * squash, pr, pr * squash, 0, a, a + Math.PI * 0.9);
    g.stroke();
  }
}

/** Rose head seen from above (floating in an urli or scattered). */
export function rose(g: Ctx, rng: Rng, x: number, y: number, r: number, color: string, squash = 0.7) {
  const grd = g.createRadialGradient(x, y - r * 0.2 * squash, r * 0.05, x, y, r);
  grd.addColorStop(0, mix(color, '#2a0006', 0.5));
  grd.addColorStop(0.5, color);
  grd.addColorStop(1, mix(color, '#ffd0d8', 0.25));
  ellipse(g, x, y, r, r * squash, grd);
  g.lineWidth = Math.max(0.6, r * 0.1);
  const rot = rng() * TAU;
  for (let i = 0; i < 6; i++) {
    const a = rot + i * 2.1;
    const rr = r * (0.85 - i * 0.12);
    g.strokeStyle = rgba(i % 2 ? mix(color, '#ffc0c8', 0.4) : mix(color, '#300008', 0.5), 0.7);
    g.beginPath();
    g.ellipse(x, y, rr, rr * squash, 0, a, a + Math.PI * 0.8);
    g.stroke();
  }
}

/** Floating lotus seen from above (perspective `squash`). */
export function lotusTop(g: Ctx, x: number, y: number, r: number, color: string, squash = 0.4, rot = 0) {
  withState(g, () => {
    g.translate(x, y);
    g.scale(1, squash);
    const petal = (a: number, len: number, wid: number, c0: string, c1: string) => {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(ca * len * 0.5 - sa * wid, sa * len * 0.5 + ca * wid, ca * len, sa * len);
      g.quadraticCurveTo(ca * len * 0.5 + sa * wid, sa * len * 0.5 - ca * wid, 0, 0);
      const grd = g.createLinearGradient(0, 0, ca * len, sa * len);
      grd.addColorStop(0, c0);
      grd.addColorStop(1, c1);
      g.fillStyle = grd;
      g.fill();
    };
    const deep = mix(color, '#5a0a30', 0.25);
    for (let i = 0; i < 8; i++) petal(rot + (i / 8) * TAU, r, r * 0.34, mix(color, '#fff0f4', 0.55), deep);
    for (let i = 0; i < 8; i++) petal(rot + ((i + 0.5) / 8) * TAU, r * 0.7, r * 0.26, '#fff6f8', color);
    ellipse(g, 0, 0, r * 0.2, r * 0.2, '#ffd23a');
    ellipse(g, 0, 0, r * 0.1, r * 0.1, '#c88a10');
  });
}

/** Lotus bud / bloom side view with stem-less base (for arrangements). */
export function lotusSide(g: Ctx, x: number, y: number, s: number, color: string, open = 1) {
  const petal = (ang: number, len: number, wid: number, c: string) => {
    withState(g, () => {
      g.translate(x, y);
      g.rotate(ang);
      g.beginPath();
      g.moveTo(0, 0);
      g.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.75, 0, -len);
      g.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.25, 0, 0);
      const grd = g.createLinearGradient(0, 0, 0, -len);
      grd.addColorStop(0, mix(c, '#fff8f0', 0.75));
      grd.addColorStop(0.5, mix(c, '#ffe4ee', 0.25));
      grd.addColorStop(1, mix(c, '#8a0a40', 0.15));
      g.fillStyle = grd;
      g.fill();
      g.strokeStyle = rgba(mix(c, '#5a0a30', 0.5), 0.45);
      g.lineWidth = Math.max(0.6, s * 0.014);
      g.stroke();
      g.strokeStyle = rgba(mix(c, '#5a0a30', 0.4), 0.35);
      g.lineWidth = Math.max(0.5, s * 0.012);
      g.beginPath();
      g.moveTo(0, -len * 0.08);
      g.lineTo(0, -len * 0.85);
      g.stroke();
    });
  };
  const deep = mix(color, '#7a1040', 0.25);
  for (const a of [-1.25, 1.25]) petal(a * open, s * 0.62, s * 0.2, deep);
  for (const a of [-0.85, 0.85]) petal(a * open, s * 0.8, s * 0.24, color);
  for (const a of [-0.42, 0.42]) petal(a * open, s * 0.92, s * 0.25, mix(color, '#ffd0e0', 0.2));
  petal(0, s, s * 0.26, mix(color, '#ffe0ea', 0.3));
}

/** Lotus leaf (pad) seen in perspective. */
export function lotusPad(g: Ctx, x: number, y: number, r: number, squash: number, rot: number) {
  withState(g, () => {
    g.translate(x, y);
    g.scale(1, squash);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, rot + 0.18, rot + TAU - 0.18);
    g.closePath();
    const grd = g.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r);
    grd.addColorStop(0, '#5f9a3a');
    grd.addColorStop(0.7, '#2f6a28');
    grd.addColorStop(1, '#173a14');
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = 'rgba(190,230,140,0.3)';
    g.lineWidth = Math.max(0.5, r * 0.03);
    for (let i = 0; i < 7; i++) {
      const a = rot + 0.4 + (i / 7) * (TAU - 0.8);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      g.stroke();
    }
  });
}

/** Marigold garland along a path (genda heads + odd leaf). */
export function garland(g: Ctx, rng: Rng, path: Pt[], r: number, colors: readonly string[] = ['#ff8a00', '#ffb000', '#ff7a00', '#ffc83d']) {
  const pts = resample(path, r * 1.5);
  // mango leaves tucked under the flowers
  pts.forEach((p, i) => {
    const a = 1.2 + (rng() - 0.5) * 1.2;
    if (i % 6 === 3) leafSimple(g, p.x, p.y + r * 0.4, r * 1.5, a);
  });
  pts.forEach((p, i) => genda(g, rng, p.x + (rng() - 0.5) * r * 0.2, p.y + (rng() - 0.5) * r * 0.2, r * (0.92 + rng() * 0.16), i % 9 === 4 ? '#d8241e' : colors[i % colors.length]));
}

/** Simple mango leaf (cheaper than kit.leaf). */
export function leafSimple(g: Ctx, x: number, y: number, len: number, ang: number, color = '#2f6f2a') {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const ex = x + ca * len;
  const ey = y + sa * len;
  const nx = -sa * len * 0.26;
  const ny = ca * len * 0.26;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + ca * len * 0.5 + nx, y + sa * len * 0.5 + ny, ex, ey);
  g.quadraticCurveTo(x + ca * len * 0.5 - nx, y + sa * len * 0.5 - ny, x, y);
  const grd = g.createLinearGradient(x + nx, y + ny, x - nx, y - ny);
  grd.addColorStop(0, mix(color, '#0a2008', 0.4));
  grd.addColorStop(1, mix(color, '#a8d870', 0.3));
  g.fillStyle = grd;
  g.fill();
}

// ------------------------------------------------------------------ urli
export interface UrliOpts {
  tilt?: number;
  diyas?: number;
  marigolds?: number;
  roses?: number;
  lotuses?: number;
  petals?: number;
  /** Diya clay colours to cycle. */
  clays?: readonly string[];
}

/**
 * Brass urli (wide shallow bowl) of water with floating flowers and diyas.
 * (cx, rimY) = rim centre, W = rim width. Returns the flames.
 */
export function urli(g: Ctx, rng: Rng, cx: number, rimY: number, W: number, o: UrliOpts = {}): Flame[] {
  const r = fork(rng);
  const tilt = o.tilt ?? 0.3;
  const rx = W / 2;
  const ry = rx * tilt;
  const depth = W * 0.24;
  wash(g, cx, rimY + depth * 1.05, rx * 1.25, ry * 0.75, '#000000', 0.6);
  // foot ring
  ellipse(g, cx, rimY + depth * 1.0, rx * 0.38, ry * 0.32, brassH(g, cx - rx * 0.38, cx + rx * 0.38, 0.4, 0.3));
  // bowl
  g.beginPath();
  g.moveTo(cx - rx, rimY);
  g.bezierCurveTo(cx - rx, rimY + depth * 0.75, cx - rx * 0.55, rimY + depth, cx, rimY + depth);
  g.bezierCurveTo(cx + rx * 0.55, rimY + depth, cx + rx, rimY + depth * 0.75, cx + rx, rimY);
  g.closePath();
  g.fillStyle = brassH(g, cx - rx, cx + rx, 0.36);
  g.fill();
  const vg = g.createLinearGradient(0, rimY, 0, rimY + depth);
  vg.addColorStop(0, 'rgba(255,200,110,0.12)');
  vg.addColorStop(0.5, 'rgba(20,8,0,0.05)');
  vg.addColorStop(1, 'rgba(20,8,0,0.55)');
  g.fillStyle = vg;
  g.fill();
  withState(g, () => {
    g.clip();
    // engraved bands with a petal motif between
    g.strokeStyle = 'rgba(70,36,4,0.7)';
    g.lineWidth = Math.max(0.8, W * 0.006);
    for (const k of [0.2, 0.42]) {
      g.beginPath();
      g.ellipse(cx, rimY + depth * k, rx * 1.0, ry * 1.1, 0, 0, Math.PI);
      g.stroke();
    }
    g.fillStyle = 'rgba(80,40,6,0.5)';
    for (let i = 0; i < 13; i++) {
      const a = (0.08 + (0.84 * i) / 12) * Math.PI;
      const px = cx + Math.cos(a) * rx * 0.97;
      const py = rimY + depth * 0.31 + Math.sin(a) * ry * 1.1;
      ellipse(g, px, py, W * 0.012 * Math.sin(a) + 0.5, W * 0.022, 'rgba(80,40,6,0.5)');
    }
  });
  // rim lip
  ellipse(g, cx, rimY, rx * 1.03, ry * 1.08, brassH(g, cx - rx, cx + rx, 0.55));
  ellipse(g, cx, rimY + ry * 0.03, rx * 0.95, ry * 0.9, brassH(g, cx - rx, cx + rx, 0.7, 0.45));
  // water
  const wy = rimY + ry * 0.14;
  const wrx = rx * 0.9;
  const wry = ry * 0.74;
  const wg = g.createLinearGradient(0, wy - wry, 0, wy + wry);
  wg.addColorStop(0, '#3a1c10');
  wg.addColorStop(0.5, '#1c0c08');
  wg.addColorStop(1, '#2e140a');
  ellipse(g, cx, wy, wrx, wry, wg);
  // items, back to front
  type Item = { k: 'd' | 'm' | 'r' | 'l' | 'p'; x: number; y: number; c: number };
  const items: Item[] = [];
  // best-candidate sampling keeps the floating things from piling up
  const add = (k: Item['k'], n: number, rad: number) => {
    for (let i = 0; i < n; i++) {
      let best: Item | null = null;
      let bestD = -1;
      for (let t = 0; t < 8; t++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * rad;
        const c = { k, x: cx + Math.cos(a) * d * wrx, y: wy + Math.sin(a) * d * wry, c: 0 };
        let md = 1e9;
        for (const o2 of items) if (o2.k !== 'p') md = Math.min(md, Math.hypot(o2.x - c.x, (o2.y - c.y) / tilt));
        if (k === 'p') md = t;
        if (md > bestD) {
          bestD = md;
          best = c;
        }
      }
      best!.c = r();
      items.push(best!);
    }
  };
  add('l', o.lotuses ?? 1, 0.35);
  add('d', o.diyas ?? 3, 0.62);
  add('r', o.roses ?? 4, 0.72);
  add('m', o.marigolds ?? 6, 0.72);
  add('p', o.petals ?? 18, 0.85);
  items.sort((a, b) => (a.k === 'p' ? -1 : 0) - (b.k === 'p' ? -1 : 0) || a.y - b.y);
  const flames: Flame[] = [];
  const clays = o.clays ?? ['#b4532a', '#9a3a1c', '#c46a34'];
  let di = 0;
  for (const it of items) {
    if (it.k === 'p') ellipse(g, it.x, it.y, W * 0.022, W * 0.012, it.c < 0.4 ? '#c8102e' : it.c < 0.7 ? '#ff8a00' : '#ffc23d', it.c * TAU);
    else if (it.k === 'l') lotusTop(g, it.x, it.y, W * 0.15, '#f06292', tilt * 1.3, it.c);
    else if (it.k === 'm') genda(g, r, it.x, it.y, W * 0.062, it.c < 0.5 ? '#ff8a00' : '#ffb21e', 0.78);
    else if (it.k === 'r') rose(g, r, it.x, it.y, W * 0.055, it.c < 0.5 ? '#b0102a' : '#d6247b', 0.72);
    else {
      const s = W * 0.17;
      const p = clayDiya(g, it.x, it.y, s, { clay: clays[di++ % clays.length], band: '#ffcf4a', dots: '#fff4d0', dir: it.c < 0.5 ? -1 : 1, tilt: 0.36, shadow: 0.35 });
      flames.push({ x: p.x, y: p.y, h: s * 0.5, halo: 0.8 });
    }
  }
  // front lip highlight
  g.strokeStyle = 'rgba(255,236,170,0.7)';
  g.lineWidth = Math.max(0.8, W * 0.008);
  g.beginPath();
  g.ellipse(cx, rimY, rx * 1.02, ry * 1.06, 0, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  return flames;
}

// ------------------------------------------------------------------ thali
/**
 * Brass puja thali (plate) with diyas, a heap of marigolds, kumkum and
 * haldi bowls and petals. (cx, cy) = plate centre, W = plate width.
 */
export function thali(g: Ctx, rng: Rng, cx: number, cy: number, W: number, tilt = 0.36): Flame[] {
  const r = fork(rng);
  const rx = W / 2;
  const ry = rx * tilt;
  wash(g, cx, cy + ry * 0.35, rx * 1.2, ry * 1.1, '#000000', 0.55);
  // plate: edge thickness, rim and dished centre
  ellipse(g, cx, cy + W * 0.02, rx, ry, brassH(g, cx - rx, cx + rx, 0.4, 0.35));
  ellipse(g, cx, cy, rx, ry, brassH(g, cx - rx, cx + rx, 0.55));
  const pg = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.3, 0, cx, cy, rx * 0.9);
  pg.addColorStop(0, '#f6d27a');
  pg.addColorStop(0.5, '#b07a26');
  pg.addColorStop(1, '#5a3608');
  ellipse(g, cx, cy + ry * 0.03, rx * 0.86, ry * 0.84, pg);
  g.strokeStyle = 'rgba(90,50,8,0.6)';
  g.lineWidth = Math.max(0.8, W * 0.006);
  g.beginPath();
  g.ellipse(cx, cy + ry * 0.03, rx * 0.74, ry * 0.72, 0, 0, TAU);
  g.stroke();
  // petals on the plate
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.78;
    const c = ['#c8102e', '#ff8a00', '#ffc23d', '#d6247b'][Math.floor(r() * 4)];
    ellipse(g, cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, W * 0.022, W * 0.011, c, r() * Math.PI);
  }
  // kumkum and haldi bowls
  for (const [bx, col] of [[-0.42, '#c8102e'], [-0.22, '#ffb000']] as const) {
    const x = cx + bx * rx;
    const y = cy - ry * 0.38;
    ellipse(g, x, y + W * 0.012, W * 0.055, W * 0.03, brassH(g, x - W * 0.055, x + W * 0.055, 0.4, 0.2));
    ellipse(g, x, y, W * 0.05, W * 0.018, brassH(g, x - W * 0.05, x + W * 0.05, 0.6));
    ellipse(g, x, y - W * 0.004, W * 0.038, W * 0.013, col);
  }
  // heap of marigolds and a rose
  const heap: [number, number, string][] = [[0.2, -0.3, '#ff8a00'], [0.36, -0.22, '#ffc23d'], [0.12, -0.12, '#ffb21e'], [0.3, -0.05, '#ff7a00'], [0.22, -0.2, '#ffd23a']];
  for (const [hx, hy, c] of heap) genda(g, r, cx + hx * rx, cy + hy * ry * 2.2, W * 0.07, c, 0.85);
  rose(g, r, cx + 0.46 * rx, cy - 0.02 * ry, W * 0.055, '#b0102a', 0.75);
  // diyas
  const flames: Flame[] = [];
  const spots: [number, number, 1 | -1, string][] = [[-0.5, 0.15, -1, '#b4532a'], [-0.05, 0.45, 1, '#a3401f'], [0.52, 0.42, 1, '#c2652f']];
  for (const [dx, dy, dir, clay] of spots) {
    const s = W * 0.2;
    const p = clayDiya(g, cx + dx * rx, cy + dy * ry, s, { clay, band: '#ffcf4a', dots: '#fff4d0', dir, shadow: 0.35 });
    flames.push({ x: p.x, y: p.y, h: s * 0.55, halo: 0.9 });
  }
  return flames;
}

// ------------------------------------------------------------------ petal rangoli
export interface PetalRangoliOpts {
  tilt?: number;
  /** Diyas around the outside. */
  diyas?: number;
  /** Colours: [outer scallops A, B, white field, star, star field, core, centre]. */
  palette?: readonly string[];
}

/**
 * Flower-petal rangoli (pookalam) in perspective. Returns diya flames.
 * Draws `diyas` clay diyas around it (back ones first).
 */
export function petalRangoli(g: Ctx, rng: Rng, cx: number, cy: number, R: number, o: PetalRangoliOpts = {}): Flame[] {
  const r = fork(rng);
  const tilt = o.tilt ?? 0.3;
  const pal = o.palette ?? ['#d6247b', '#ff7a00', '#fff4e0', '#ff8a00', '#ffc23d', '#b0102a', '#ffd23a'];
  wash(g, cx, cy, R * 1.25, R * 1.25 * tilt, '#000000', 0.35);
  withState(g, () => {
    g.translate(cx, cy);
    g.scale(1, tilt);
    // outer leaf ring
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      leafSimple(g, Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, R * 0.2, a + (r() - 0.5) * 0.15, i % 2 ? '#2f7a2c' : '#3f8a30');
    }
    // scalloped outer ring
    const N = 16;
    ellipse(g, 0, 0, R * 0.9, R * 0.9, pal[1]);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU;
      const a1 = ((i + 1) / N) * TAU;
      const am = (a0 + a1) / 2;
      g.beginPath();
      g.moveTo(Math.cos(a0) * R * 0.74, Math.sin(a0) * R * 0.74);
      g.quadraticCurveTo(Math.cos(am) * R * 1.08, Math.sin(am) * R * 1.08, Math.cos(a1) * R * 0.74, Math.sin(a1) * R * 0.74);
      g.closePath();
      g.fillStyle = i % 2 ? pal[0] : mix(pal[0], '#5a0a40', 0.3);
      g.fill();
    }
    // white jasmine field
    ellipse(g, 0, 0, R * 0.76, R * 0.76, pal[2]);
    ellipse(g, 0, 0, R * 0.62, R * 0.62, pal[4]);
    // marigold star
    const S = 12;
    g.beginPath();
    for (let i = 0; i < S * 2; i++) {
      const a = (i / (S * 2)) * TAU;
      const rr = i % 2 ? R * 0.44 : R * 0.74;
      if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = pal[3];
    g.fill();
    // rose core with white teardrops
    ellipse(g, 0, 0, R * 0.42, R * 0.42, pal[5]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      g.beginPath();
      g.moveTo(ca * R * 0.12, sa * R * 0.12);
      g.quadraticCurveTo(ca * R * 0.26 - sa * R * 0.09, sa * R * 0.26 + ca * R * 0.09, ca * R * 0.38, sa * R * 0.38);
      g.quadraticCurveTo(ca * R * 0.26 + sa * R * 0.09, sa * R * 0.26 - ca * R * 0.09, ca * R * 0.12, sa * R * 0.12);
      g.fillStyle = i % 2 ? '#fff4e0' : '#ffb21e';
      g.fill();
    }
    ellipse(g, 0, 0, R * 0.13, R * 0.13, pal[6]);
    // petal texture: small petals in shades of each ring's colour
    const tex = (r0: number, r1: number, n: number, colors: readonly string[], sz: number) => {
      for (let i = 0; i < n; i++) {
        const a = r() * TAU;
        const d = lerp(r0, r1, Math.sqrt(r()));
        const c = colors[Math.floor(r() * colors.length)];
        const rot = r() * Math.PI;
        const ss = sz * (0.6 + r() * 0.6);
        ellipse(g, Math.cos(a) * d * R, Math.sin(a) * d * R, ss * R, ss * R * 0.55, c, rot);
      }
    };
    tex(0.63, 0.75, 70, ['#ffffff', '#f4e6cc', '#fffaf0'], 0.03);
    tex(0.45, 0.72, 60, [mix(pal[3], '#ffe08a', 0.4), mix(pal[3], '#a03a00', 0.3)], 0.028);
    tex(0.14, 0.4, 40, [mix(pal[5], '#ff5a7a', 0.4), mix(pal[5], '#300008', 0.4)], 0.03);
    tex(0, 0.12, 12, ['#ffef9a', '#e89a10'], 0.03);
    // dotted white outline between rings
    g.fillStyle = 'rgba(255,250,235,0.9)';
    for (const [rr, n] of [[0.765, 48], [0.43, 30]] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        g.beginPath();
        g.arc(Math.cos(a) * R * rr, Math.sin(a) * R * rr, R * 0.011, 0, TAU);
        g.fill();
      }
    }
  });
  const flames: Flame[] = [];
  const nd = o.diyas ?? 0;
  const order: number[] = [];
  for (let i = 0; i < nd; i++) order.push(i);
  const ang = (i: number) => (i / nd) * TAU + Math.PI / nd;
  order.sort((a, b) => Math.sin(ang(a)) - Math.sin(ang(b)));
  const clays = ['#b4532a', '#a8401e', '#c0602e'];
  for (const i of order) {
    const a = ang(i);
    const dx = cx + Math.cos(a) * R * 1.16;
    const dy = cy + Math.sin(a) * R * 1.16 * tilt;
    const s = R * 0.17 * (1 + Math.sin(a) * 0.12);
    const p = clayDiya(g, dx, dy, s, { clay: clays[i % 3], band: i % 2 ? '#ffcf4a' : '#e8402a', dots: '#fff4d0', dir: Math.cos(a) > 0 ? 1 : -1, tilt: 0.36 });
    flames.push({ x: p.x, y: p.y, h: s * 0.52, halo: 1 });
  }
  return flames;
}

// ------------------------------------------------------------------ texture
/** Mottled paint texture: soft blobs of the given colours. */
export function mottle(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, colors: readonly string[], alpha: number, rMin: number, rMax: number, flat = 0.6) {
  for (let i = 0; i < n; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const rr = rand(rng, rMin, rMax);
    const c = colors[Math.floor(rng() * colors.length)];
    wash(g, x, y, rr, rr * rand(rng, flat * 0.6, flat * 1.4), c, alpha * rand(rng, 0.4, 1));
  }
}

/** Loose scattered petals with a hint of shading. */
export function scatterPetals(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, size: number, colors: readonly string[], squash = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const s = size * rand(rng, 0.55, 1.2);
    const c = colors[Math.floor(rng() * colors.length)];
    const rot = rng() * Math.PI;
    ellipse(g, x + s * 0.15, y + s * 0.2, s, s * squash, 'rgba(0,0,0,0.25)', rot);
    ellipse(g, x, y, s, s * squash, c, rot);
  }
}

/** Soft warm light pool on a surface (additive, painted into the base). */
export function pool(g: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  withBlend(g, 'lighter', () => {
    withState(g, () => {
      g.translate(x, y);
      g.scale(1, ry / Math.max(1, rx));
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, rgba(color, alpha));
      grd.addColorStop(0.35, rgba(color, alpha * 0.45));
      grd.addColorStop(1, rgba(color, 0));
      g.fillStyle = grd;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
    });
  });
}

/**
 * Directional brushwork: short translucent curved strokes that the oil
 * filter turns into visible brush marks on large flat areas.
 */
export function brushwork(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, colors: readonly string[], alpha: number, len: number, width: number, angle: number, spread: number) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const a = angle + (rng() - 0.5) * spread;
    const L = len * rand(rng, 0.5, 1.3);
    const bend = (rng() - 0.5) * L * 0.4;
    const c = colors[Math.floor(rng() * colors.length)];
    const al = alpha * rand(rng, 0.4, 1);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    g.strokeStyle = rgba(c, al);
    g.lineWidth = width * rand(rng, 0.6, 1.4);
    g.beginPath();
    g.moveTo(x - ca * L * 0.5, y - sa * L * 0.5);
    g.quadraticCurveTo(x - sa * bend, y + ca * bend, x + ca * L * 0.5, y + sa * L * 0.5);
    g.stroke();
  }
}
