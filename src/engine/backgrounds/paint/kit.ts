/**
 * Painting kit for the procedural Diwali backgrounds.
 *
 * Everything here draws with the plain Canvas 2D API so it runs on the main
 * thread and inside a worker (OffscreenCanvas). Sizes are passed in pixels;
 * scenes compute them from the canvas size so a composition scales to any
 * resolution and adapts to portrait or landscape frames.
 *
 * Avoid `ctx.filter` (missing in older Safari): glows use radial gradients.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Rng = () => number;
export type Pt = { x: number; y: number };

export const TAU = Math.PI * 2;

// ------------------------------------------------------------------ basics
export function makeCanvas(w: number, h: number): AnyCanvas {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function ctx2d(c: AnyCanvas): Ctx {
  const g = c.getContext('2d') as Ctx | null;
  if (!g) throw new Error('2D canvas is not available');
  return g;
}

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
/**
 * Independent random stream that consumes exactly one value of `rng`. Use it
 * for detail whose amount depends on pixel size, so a thumbnail and a full
 * painting still lay out identically.
 */
export const fork = (rng: Rng): Rng => mulberry32((rng() * 4294967296) >>> 0);
export const randInt = (rng: Rng, a: number, b: number) => Math.floor(rand(rng, a, b + 1));
export const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Gaussian-ish random (sum of uniforms), mean 0, sd ~1. */
export const gauss = (rng: Rng) => (rng() + rng() + rng() + rng() - 2) * 1.73;

// ------------------------------------------------------------------ colour
export const PALETTE = {
  night: '#070a24',
  indigo: '#151a52',
  violet: '#3a1f6b',
  plum: '#5b1f5e',
  maroon: '#5a1420',
  marigold: '#ff9a1f',
  saffron: '#ff7a00',
  turmeric: '#ffc23d',
  gold: '#ffd77a',
  flame: '#ffb347',
  vermilion: '#e2412b',
  rani: '#d6247b',
  peacock: '#0b7f86',
  leaf: '#2f7d32',
  clay: '#b4532a',
  clayDark: '#6a2810',
  cream: '#fff1d6',
} as const;

/** Parses #rgb / #rrggbb into [r,g,b] 0-255. */
export function hexRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgba()` string from a hex colour and alpha. */
export function rgba(hex: string, a: number) {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

/** Mixes two hex colours. */
export function mix(a: string, b: string, t: number) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ------------------------------------------------------------------ helpers
export function withState(g: Ctx, fn: () => void) {
  g.save();
  try {
    fn();
  } finally {
    g.restore();
  }
}

export function withBlend(g: Ctx, op: GlobalCompositeOperation, fn: () => void) {
  withState(g, () => {
    g.globalCompositeOperation = op;
    fn();
  });
}

/** Point on a hanging string between a and b that sags by `sag` px at mid-span. */
export function sagPoint(a: Pt, b: Pt, sag: number, t: number): Pt {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) + sag * 4 * t * (1 - t) };
}

/** Samples `n` points along a sagging string (including both ends). */
export function sagPath(a: Pt, b: Pt, sag: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) out.push(sagPoint(a, b, sag, n === 1 ? 0.5 : i / (n - 1)));
  return out;
}

/** Evenly spaced points along a polyline, every `step` px. */
export function resample(path: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  if (path.length === 0) return out;
  out.push({ ...path[0] });
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= seg) {
      const t = d / seg;
      out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
      d += step;
    }
    carry = seg - (d - step);
  }
  return out;
}

export function strokePath(g: Ctx, pts: Pt[], color: string, width: number) {
  if (pts.length < 2) return;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}

export function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  g.fillStyle = fill;
  g.fill();
}

// ------------------------------------------------------------------ light
/**
 * Soft additive glow. `falloff` < 1 gives a hotter core.
 * Uses 'lighter' so overlapping lights build up like real light.
 */
export function glow(g: Ctx, x: number, y: number, r: number, color: string, alpha = 1, falloff = 1) {
  if (r <= 0.5 || alpha <= 0) return;
  withBlend(g, 'lighter', () => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgba(color, alpha));
    grd.addColorStop(Math.min(0.95, 0.18 * falloff), rgba(color, alpha * 0.55));
    grd.addColorStop(Math.min(0.97, 0.45 * falloff), rgba(color, alpha * 0.16));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  });
}

/** Soft non-additive wash (normal blending), e.g. smoke or haze. */
export function wash(g: Ctx, x: number, y: number, rx: number, ry: number, color: string, alpha: number) {
  withState(g, () => {
    g.translate(x, y);
    g.scale(1, ry / Math.max(1, rx));
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grd.addColorStop(0, rgba(color, alpha));
    grd.addColorStop(0.6, rgba(color, alpha * 0.4));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
  });
}

/** Out-of-focus light discs (bokeh). */
export function bokeh(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, count: number, colors: readonly string[], rMin: number, rMax: number, alpha = 0.35) {
  withBlend(g, 'lighter', () => {
    for (let i = 0; i < count; i++) {
      const x = rand(rng, x0, x1);
      const y = rand(rng, y0, y1);
      const r = rand(rng, rMin, rMax);
      const c = pick(rng, colors);
      const a = alpha * rand(rng, 0.4, 1);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, rgba(c, a * 0.75));
      grd.addColorStop(0.72, rgba(c, a * 0.6));
      grd.addColorStop(0.9, rgba(c, a * 0.9));
      grd.addColorStop(1, rgba(c, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  });
}

/** Little four-point sparkle star. */
export function sparkle(g: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  withBlend(g, 'lighter', () => {
    g.fillStyle = rgba(color, alpha);
    g.beginPath();
    g.moveTo(x, y - r);
    g.quadraticCurveTo(x, y, x + r, y);
    g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y);
    g.quadraticCurveTo(x, y, x, y - r);
    g.fill();
  });
  glow(g, x, y, r * 1.6, color, alpha * 0.5);
}

// ------------------------------------------------------------------ sky
/** Vertical gradient from `stops` ([0..1 position, colour]). */
export function gradientSky(g: Ctx, x: number, y: number, w: number, h: number, stops: [number, string][]) {
  const grd = g.createLinearGradient(0, y, 0, y + h);
  for (const [p, c] of stops) grd.addColorStop(p, c);
  g.fillStyle = grd;
  g.fillRect(x, y, w, h);
}

export function stars(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, count: number, size: number) {
  withBlend(g, 'lighter', () => {
    for (let i = 0; i < count; i++) {
      const x = rand(rng, x0, x1);
      const y = y0 + (y1 - y0) * Math.pow(rng(), 1.6);
      const r = size * rand(rng, 0.3, 1) * (rng() < 0.06 ? 2.2 : 1);
      const a = rand(rng, 0.35, 1);
      g.fillStyle = `rgba(255,${Math.round(rand(rng, 225, 255))},${Math.round(rand(rng, 200, 255))},${a})`;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  });
}

export function moon(g: Ctx, x: number, y: number, r: number) {
  glow(g, x, y, r * 6, '#ffe7b0', 0.18);
  glow(g, x, y, r * 2.4, '#fff1cc', 0.35);
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grd.addColorStop(0, '#fffaf0');
  grd.addColorStop(1, '#f2dcb0');
  ellipse(g, x, y, r, r, grd);
}

/** Drifting smoke / cloud band (normal blend). */
export function smoke(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, puffs: number, color: string, alpha: number) {
  for (let i = 0; i < puffs; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const r = rand(rng, 0.06, 0.16) * (x1 - x0);
    wash(g, x, y, r, r * rand(rng, 0.35, 0.6), color, alpha * rand(rng, 0.5, 1));
  }
}

// ------------------------------------------------------------------ fireworks
export type BurstKind = 'peony' | 'chrysanthemum' | 'willow' | 'ring' | 'palm' | 'crossette';

/**
 * Static firework burst (additive). `r` is the burst radius in px.
 * `color` is the main star colour; willows fall back to gold.
 */
export function firework(g: Ctx, rng: Rng, x: number, y: number, r: number, color: string, kind: BurstKind = 'peony', alpha = 1) {
  const n = kind === 'ring' ? 46 : kind === 'palm' ? 9 : kind === 'willow' ? 46 : 70;
  const gravity = kind === 'willow' ? 0.55 : kind === 'palm' ? 0.35 : 0.16;
  glow(g, x, y, r * 0.55, color, 0.28 * alpha);
  glow(g, x, y, r * 0.18, '#fff6e0', 0.35 * alpha);
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(rng, -0.05, 0.05);
      const len = r * (kind === 'ring' ? rand(rng, 0.95, 1.02) : rand(rng, 0.72, 1.05));
      const steps = kind === 'ring' ? 2 : 14;
      const c = kind === 'willow' ? (rng() < 0.75 ? '#ffcf6b' : color) : rng() < 0.12 ? '#fff4d8' : color;
      const w = Math.max(0.6, r * (kind === 'palm' ? 0.022 : 0.009));
      // trail: draw segments with increasing alpha toward the tip, drooping with gravity
      let px = x;
      let py = y;
      const start = kind === 'ring' ? 0.86 : kind === 'chrysanthemum' ? 0.08 : 0.3;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const tt = start + (1 - start) * t;
        const nx = x + Math.cos(a) * len * tt;
        const ny = y + Math.sin(a) * len * tt + gravity * r * tt * tt;
        if (tt >= start) {
          g.strokeStyle = rgba(c, alpha * (0.08 + 0.75 * t * t));
          g.lineWidth = w * (0.5 + t);
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(nx, ny);
          g.stroke();
        }
        px = nx;
        py = ny;
      }
      // star at the tip
      g.fillStyle = rgba('#ffffff', alpha * 0.85);
      g.beginPath();
      g.arc(px, py, w * 1.2, 0, TAU);
      g.fill();
      if (kind === 'crossette' && rng() < 0.5) {
        for (let k = 0; k < 4; k++) {
          const b = a + (k / 4) * TAU + 0.4;
          const L = r * 0.18;
          g.strokeStyle = rgba(c, alpha * 0.6);
          g.lineWidth = w * 0.8;
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(b) * L, py + Math.sin(b) * L + L * 0.2);
          g.stroke();
        }
      }
      if (kind !== 'ring' && rng() < 0.35) {
        // falling glitter below the star
        for (let k = 0; k < 3; k++) {
          g.fillStyle = rgba('#ffe2a0', alpha * rand(rng, 0.2, 0.6));
          g.beginPath();
          g.arc(px + rand(rng, -w, w) * 2, py + rand(rng, 1, 5) * w * (k + 1), w * 0.6, 0, TAU);
          g.fill();
        }
      }
    }
  });
}

/** Rising rocket trail ending at (x1,y1). */
export function rocket(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, color = '#ffd28a', width = 2) {
  withBlend(g, 'lighter', () => {
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const wob = Math.sin(t0 * 9) * width * 0.6;
      g.strokeStyle = rgba(color, 0.05 + 0.6 * t1 * t1);
      g.lineWidth = width * (0.4 + t1);
      g.beginPath();
      g.moveTo(lerp(x0, x1, t0) + wob, lerp(y0, y1, t0));
      g.lineTo(lerp(x0, x1, t1) + wob, lerp(y0, y1, t1));
      g.stroke();
      if (rng() < 0.4) {
        g.fillStyle = rgba('#fff0c8', rand(rng, 0.2, 0.7) * t1);
        g.fillRect(lerp(x0, x1, t0) + rand(rng, -4, 4) * width, lerp(y0, y1, t0) + rand(rng, 0, 6) * width, width * 0.8, width * 0.8);
      }
    }
  });
  glow(g, x1, y1, width * 8, color, 0.6);
}

/** Anar (flower-pot) fountain: a clay cone spraying a fan of golden sparks. */
export function anar(g: Ctx, rng: Rng, x: number, y: number, h: number, sparks = 160) {
  // pot
  const pw = h * 0.09;
  g.beginPath();
  g.moveTo(x - pw, y);
  g.lineTo(x - pw * 0.35, y - pw * 1.4);
  g.lineTo(x + pw * 0.35, y - pw * 1.4);
  g.lineTo(x + pw, y);
  g.closePath();
  const pg = g.createLinearGradient(x - pw, 0, x + pw, 0);
  pg.addColorStop(0, '#7a2a12');
  pg.addColorStop(0.5, '#c4642e');
  pg.addColorStop(1, '#5b1d0c');
  g.fillStyle = pg;
  g.fill();
  const top = y - pw * 1.4;
  glow(g, x, top - h * 0.3, h * 0.75, '#ffb347', 0.4);
  glow(g, x, top, h * 0.18, '#fff2c8', 0.9);
  withBlend(g, 'lighter', () => {
    for (let i = 0; i < sparks; i++) {
      const ang = -Math.PI / 2 + gauss(rng) * 0.28;
      const v = h * rand(rng, 0.5, 1.05);
      const T = rand(rng, 0.35, 1);
      const vx = Math.cos(ang) * v;
      const vy = Math.sin(ang) * v;
      const grav = h * 1.6;
      g.strokeStyle = rgba(rng() < 0.2 ? '#ffffff' : rng() < 0.5 ? '#ffd27a' : '#ffae42', rand(rng, 0.25, 0.8));
      g.lineWidth = Math.max(0.6, h * 0.006);
      g.beginPath();
      const t0 = T * 0.8;
      for (let k = 0; k <= 4; k++) {
        const t = t0 + (T - t0) * (k / 4);
        const px = x + vx * t;
        const py = top + vy * t + 0.5 * grav * t * t;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.stroke();
    }
  });
}

/** Chakri (ground spinner) caught as a glowing ring with a spiral trail. */
export function chakri(g: Ctx, rng: Rng, x: number, y: number, r: number) {
  glow(g, x, y, r * 3, '#ff9a3c', 0.35);
  withBlend(g, 'lighter', () => {
    for (let i = 0; i < 90; i++) {
      const a = rand(rng, 0, TAU);
      const rr = r * rand(rng, 0.7, 1.3);
      const sweep = rand(rng, 0.2, 0.7);
      g.strokeStyle = rgba(rng() < 0.5 ? '#ffd27a' : '#ff8a3d', rand(rng, 0.2, 0.7));
      g.lineWidth = Math.max(0.6, r * 0.05);
      g.beginPath();
      g.ellipse(x, y, rr, rr * 0.4, 0, a, a + sweep);
      g.stroke();
    }
  });
  glow(g, x, y, r * 0.5, '#fff4d0', 0.9);
}

/** Phuljhadi (sparkler) burning at (x,y). */
export function sparkler(g: Ctx, rng: Rng, x: number, y: number, r: number) {
  glow(g, x, y, r * 2.2, '#ffcf7a', 0.4);
  withBlend(g, 'lighter', () => {
    for (let i = 0; i < 60; i++) {
      const a = rand(rng, 0, TAU);
      const L = r * Math.pow(rng(), 0.6);
      const mx = x + Math.cos(a) * L * 0.5;
      const my = y + Math.sin(a) * L * 0.5;
      g.strokeStyle = rgba('#fff0c0', rand(rng, 0.3, 0.9));
      g.lineWidth = Math.max(0.5, r * 0.012);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(mx, my);
      g.lineTo(x + Math.cos(a + rand(rng, -0.4, 0.4)) * L, y + Math.sin(a + rand(rng, -0.4, 0.4)) * L);
      g.stroke();
    }
  });
  glow(g, x, y, r * 0.25, '#ffffff', 1);
}

// ------------------------------------------------------------------ lamps
export interface DiyaOpts {
  /** Clay body colour. */
  clay?: string;
  /** Painted band colours (rim decoration). */
  paint?: readonly string[];
  /** Spout direction: 1 = right, -1 = left. */
  dir?: 1 | -1;
}

/**
 * Earthen diya seen from slightly above. (x,y) is the centre of the rim,
 * `s` the overall width. Returns where the flame sits (draw it with
 * `diyaFlame` in the lights pass).
 */
export function diya(g: Ctx, x: number, y: number, s: number, o: DiyaOpts = {}): Pt {
  const dir = o.dir ?? 1;
  const clay = o.clay ?? PALETTE.clay;
  const rx = s * 0.42;
  const ry = s * 0.13;
  const depth = s * 0.3;
  const spoutX = x + dir * s * 0.58;
  const spoutY = y - s * 0.03;
  // soft contact shadow
  wash(g, x, y + depth * 0.95, s * 0.6, s * 0.12, '#000000', 0.45);
  // body: bowl with a pinched spout
  g.beginPath();
  g.moveTo(x - dir * rx, y);
  g.bezierCurveTo(x - dir * rx, y + depth * 0.9, x + dir * rx * 0.2, y + depth * 1.1, x + dir * rx * 0.7, y + depth * 0.55);
  g.quadraticCurveTo(spoutX - dir * s * 0.02, spoutY + s * 0.06, spoutX, spoutY);
  g.quadraticCurveTo(x + dir * rx * 0.9, y - ry * 0.9, x + dir * rx * 0.55, y - ry * 0.95);
  g.lineTo(x - dir * rx * 0.5, y - ry);
  g.quadraticCurveTo(x - dir * rx * 1.02, y - ry * 0.7, x - dir * rx, y);
  g.closePath();
  const bg = g.createLinearGradient(x - rx, y - ry, x + rx * 0.4, y + depth);
  bg.addColorStop(0, mix(clay, '#ffd2a0', 0.25));
  bg.addColorStop(0.45, clay);
  bg.addColorStop(1, mix(clay, '#1a0602', 0.6));
  g.fillStyle = bg;
  g.fill();
  // painted decoration band under the rim
  const paint = o.paint ?? ['#ffd34d', '#e2412b', '#ffffff'];
  withState(g, () => {
    g.clip();
    g.strokeStyle = paint[0];
    g.lineWidth = Math.max(1, s * 0.045);
    g.beginPath();
    g.ellipse(x, y + depth * 0.18, rx * 0.98, ry * 1.25, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    g.stroke();
    const dots = 7;
    for (let i = 0; i < dots; i++) {
      const t = 0.12 + (0.76 * i) / (dots - 1);
      const a = t * Math.PI;
      const px = x + Math.cos(a) * rx * 0.93;
      const py = y + depth * 0.36 + Math.sin(a) * ry * 1.2;
      ellipse(g, px, py, s * 0.022, s * 0.022, paint[(i % (paint.length - 1)) + 1] ?? paint[1]);
    }
  });
  // inner oil surface
  const og = g.createRadialGradient(x + dir * rx * 0.15, y - ry * 0.1, 0, x, y, rx);
  og.addColorStop(0, '#7a4a12');
  og.addColorStop(0.6, '#3a1c06');
  og.addColorStop(1, '#220e03');
  ellipse(g, x - dir * rx * 0.05, y - ry * 0.12, rx * 0.82, ry * 0.68, og);
  // rim highlight
  g.strokeStyle = rgba('#ffd9a8', 0.55);
  g.lineWidth = Math.max(0.8, s * 0.018);
  g.beginPath();
  g.ellipse(x - dir * rx * 0.05, y - ry * 0.12, rx * 0.86, ry * 0.75, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  // wick
  g.strokeStyle = '#2a1405';
  g.lineWidth = Math.max(1, s * 0.03);
  g.beginPath();
  g.moveTo(spoutX - dir * s * 0.12, spoutY + s * 0.02);
  g.lineTo(spoutX - dir * s * 0.02, spoutY - s * 0.03);
  g.stroke();
  return { x: spoutX - dir * s * 0.03, y: spoutY - s * 0.04 };
}

/** Diya / candle flame with its halo. `s` is the diya width (flame ~0.45 s tall). */
export function diyaFlame(g: Ctx, rng: Rng, x: number, y: number, s: number, intensity = 1) {
  const h = s * rand(rng, 0.4, 0.5);
  const w = h * 0.36;
  const lean = rand(rng, -0.12, 0.12) * h;
  glow(g, x, y - h * 0.4, s * 2.2, '#ff8c2a', 0.22 * intensity);
  glow(g, x, y - h * 0.35, s * 0.9, '#ffb547', 0.45 * intensity);
  // flame body
  const tipX = x + lean;
  const body = (scale: number) => {
    g.beginPath();
    g.moveTo(x, y + w * 0.35 * scale);
    g.bezierCurveTo(x - w * scale, y + w * 0.1 * scale, x - w * 0.6 * scale, y - h * 0.45 * scale, tipX, y - h * scale);
    g.bezierCurveTo(x + w * 0.6 * scale, y - h * 0.45 * scale, x + w * scale, y + w * 0.1 * scale, x, y + w * 0.35 * scale);
    g.closePath();
  };
  withBlend(g, 'lighter', () => {
    body(1);
    const fg = g.createLinearGradient(x, y, tipX, y - h);
    fg.addColorStop(0, rgba('#ff6a00', 0.9 * intensity));
    fg.addColorStop(0.35, rgba('#ffb23e', 0.95 * intensity));
    fg.addColorStop(1, rgba('#ff5a00', 0.2 * intensity));
    g.fillStyle = fg;
    g.fill();
    body(0.6);
    const cg = g.createLinearGradient(x, y, tipX, y - h);
    cg.addColorStop(0, rgba('#fffbe8', intensity));
    cg.addColorStop(0.7, rgba('#ffe28a', 0.85 * intensity));
    cg.addColorStop(1, rgba('#ffc04d', 0));
    g.fillStyle = cg;
    g.fill();
  });
  // blue root
  ellipse(g, x, y + w * 0.12, w * 0.32, w * 0.2, rgba('#5aa0ff', 0.35 * intensity));
}

/** Brass / clay standing lamp (samai) with several flames. Returns flame points. */
export function samai(g: Ctx, x: number, y: number, h: number): Pt[] {
  const brass = (x0: number, x1: number) => {
    const grd = g.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, '#5c3a0c');
    grd.addColorStop(0.35, '#e8b34a');
    grd.addColorStop(0.55, '#fff0b0');
    grd.addColorStop(0.75, '#c08a24');
    grd.addColorStop(1, '#4a2e08');
    return grd;
  };
  const w = h * 0.34;
  wash(g, x, y, w * 1.2, w * 0.18, '#000000', 0.5);
  // base
  g.beginPath();
  g.ellipse(x, y - h * 0.03, w * 0.55, h * 0.04, 0, 0, TAU);
  g.fillStyle = brass(x - w * 0.55, x + w * 0.55);
  g.fill();
  g.beginPath();
  g.moveTo(x - w * 0.5, y - h * 0.04);
  g.quadraticCurveTo(x - w * 0.15, y - h * 0.08, x - w * 0.07, y - h * 0.2);
  g.lineTo(x + w * 0.07, y - h * 0.2);
  g.quadraticCurveTo(x + w * 0.15, y - h * 0.08, x + w * 0.5, y - h * 0.04);
  g.closePath();
  g.fill();
  // stem with knots
  g.fillStyle = brass(x - w * 0.06, x + w * 0.06);
  g.fillRect(x - w * 0.045, y - h * 0.78, w * 0.09, h * 0.6);
  for (const k of [0.3, 0.48, 0.66]) {
    g.beginPath();
    g.ellipse(x, y - h * k, w * 0.11, h * 0.025, 0, 0, TAU);
    g.fillStyle = brass(x - w * 0.11, x + w * 0.11);
    g.fill();
  }
  // tray of lamps
  const ty = y - h * 0.8;
  g.beginPath();
  g.ellipse(x, ty, w * 0.5, h * 0.05, 0, 0, Math.PI);
  g.lineTo(x - w * 0.5, ty);
  g.fillStyle = brass(x - w * 0.5, x + w * 0.5);
  g.fill();
  g.beginPath();
  g.ellipse(x, ty, w * 0.5, h * 0.022, 0, 0, TAU);
  g.fillStyle = '#3a2206';
  g.fill();
  // finial (peacock-ish)
  g.beginPath();
  g.moveTo(x, ty - h * 0.2);
  g.quadraticCurveTo(x + w * 0.12, ty - h * 0.1, x + w * 0.03, ty - h * 0.02);
  g.lineTo(x - w * 0.03, ty - h * 0.02);
  g.quadraticCurveTo(x - w * 0.12, ty - h * 0.1, x, ty - h * 0.2);
  g.fillStyle = brass(x - w * 0.12, x + w * 0.12);
  g.fill();
  const flames: Pt[] = [];
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.1 + 0.8 * (i / 4));
    flames.push({ x: x - Math.cos(a) * w * 0.46, y: ty + Math.sin(a) * h * 0.012 - h * 0.012 });
  }
  return flames;
}

export type LanternStyle = 'star' | 'kandil' | 'globe';

/**
 * Akash kandil / paper lantern hanging from (x, top) by a cord, body centred
 * at (x, y). Draw `lanternGlow` in the lights pass for the inner light.
 */
export function lantern(g: Ctx, rng: Rng, x: number, top: number, y: number, size: number, color: string, style: LanternStyle = 'kandil') {
  g.strokeStyle = rgba('#2a1a10', 0.85);
  g.lineWidth = Math.max(1, size * 0.02);
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x, y - size * 0.5);
  g.stroke();
  const light = mix(color, '#fff3c4', 0.45);
  const dark = mix(color, '#2a0610', 0.45);
  if (style === 'star') {
    const pts = 8;
    const outer = size * 0.55;
    const inner = size * 0.3;
    g.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = (i / (pts * 2)) * TAU - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    const grd = g.createRadialGradient(x, y, 0, x, y, outer);
    grd.addColorStop(0, light);
    grd.addColorStop(0.55, color);
    grd.addColorStop(1, dark);
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = rgba('#ffe7a0', 0.7);
    g.lineWidth = Math.max(0.8, size * 0.015);
    g.stroke();
    ellipse(g, x, y, inner * 0.55, inner * 0.55, rgba('#fff4cc', 0.75));
  } else if (style === 'globe') {
    const grd = g.createRadialGradient(x - size * 0.12, y - size * 0.12, size * 0.05, x, y, size * 0.5);
    grd.addColorStop(0, light);
    grd.addColorStop(0.7, color);
    grd.addColorStop(1, dark);
    ellipse(g, x, y, size * 0.5, size * 0.46, grd);
    g.strokeStyle = rgba(dark, 0.6);
    g.lineWidth = Math.max(0.6, size * 0.012);
    for (let i = -3; i <= 3; i++) {
      g.beginPath();
      g.ellipse(x, y, Math.abs(i) * size * 0.075 + 0.5, size * 0.46, 0, 0, TAU);
      g.stroke();
    }
    g.fillStyle = '#3a240c';
    g.fillRect(x - size * 0.16, y - size * 0.5, size * 0.32, size * 0.06);
    g.fillRect(x - size * 0.16, y + size * 0.44, size * 0.32, size * 0.06);
  } else {
    // classic kandil: hexagonal crown, bell body, frilled skirt and tassels
    const w = size * 0.5;
    g.beginPath();
    g.moveTo(x, y - size * 0.5);
    g.lineTo(x + w * 0.75, y - size * 0.2);
    g.lineTo(x + w, y + size * 0.05);
    g.lineTo(x + w * 0.55, y + size * 0.3);
    g.lineTo(x - w * 0.55, y + size * 0.3);
    g.lineTo(x - w, y + size * 0.05);
    g.lineTo(x - w * 0.75, y - size * 0.2);
    g.closePath();
    const grd = g.createLinearGradient(x - w, 0, x + w, 0);
    grd.addColorStop(0, dark);
    grd.addColorStop(0.45, light);
    grd.addColorStop(1, dark);
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = rgba('#ffe7a0', 0.8);
    g.lineWidth = Math.max(0.8, size * 0.018);
    g.stroke();
    // panel lines
    g.beginPath();
    g.moveTo(x, y - size * 0.5);
    g.lineTo(x, y + size * 0.3);
    g.moveTo(x - w, y + size * 0.05);
    g.lineTo(x + w, y + size * 0.05);
    g.stroke();
    // frilled skirt
    const frills = 9;
    for (let i = 0; i < frills; i++) {
      const fx = x - w * 0.55 + (w * 1.1 * (i + 0.5)) / frills;
      g.beginPath();
      g.moveTo(fx - w * 0.07, y + size * 0.3);
      g.lineTo(fx, y + size * 0.3 + size * rand(rng, 0.28, 0.42));
      g.lineTo(fx + w * 0.07, y + size * 0.3);
      g.fillStyle = i % 2 ? color : mix(color, '#ffd166', 0.5);
      g.fill();
    }
    // tassels
    for (const sx of [-1, 1]) {
      g.strokeStyle = mix(color, '#ffd166', 0.3);
      g.lineWidth = Math.max(1, size * 0.03);
      g.beginPath();
      g.moveTo(x + sx * w, y + size * 0.05);
      g.lineTo(x + sx * w * 1.05, y + size * 0.65);
      g.stroke();
    }
  }
}

export function lanternGlow(g: Ctx, x: number, y: number, size: number, color: string, intensity = 1) {
  glow(g, x, y, size * 2.4, color, 0.22 * intensity);
  glow(g, x, y, size * 0.9, mix(color, '#fff2c0', 0.6), 0.45 * intensity);
  glow(g, x, y, size * 0.3, '#fff8e0', 0.5 * intensity);
}

// ------------------------------------------------------------------ string lights
export interface Bulb extends Pt {
  color: string;
  r: number;
}

/** Fairy-light string between a and b. Draws the wire now and returns the bulbs for the lights pass. */
export function stringLights(g: Ctx, rng: Rng, a: Pt, b: Pt, sag: number, count: number, colors: readonly string[], r: number, wire = 'rgba(30,20,12,0.75)'): Bulb[] {
  const path = sagPath(a, b, sag, 40);
  strokePath(g, path, wire, Math.max(0.8, r * 0.28));
  const out: Bulb[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const p = sagPoint(a, b, sag, t);
    out.push({ x: p.x + rand(rng, -0.5, 0.5) * r, y: p.y + r * 0.8, color: colors[i % colors.length], r: r * rand(rng, 0.85, 1.15) });
  }
  return out;
}

/** Vertical curtain lights hanging from a line (house facades). */
export function curtainLights(rng: Rng, x0: number, x1: number, y0: number, lengths: (x: number) => number, columns: number, spacing: number, colors: readonly string[], r: number): Bulb[] {
  const out: Bulb[] = [];
  for (let c = 0; c < columns; c++) {
    const x = lerp(x0, x1, columns === 1 ? 0.5 : c / (columns - 1));
    const L = lengths(x);
    for (let y = y0 + spacing * 0.5; y < y0 + L; y += spacing) out.push({ x: x + rand(rng, -0.4, 0.4) * r, y, color: pick(rng, colors), r: r * rand(rng, 0.8, 1.2) });
  }
  return out;
}

export function drawBulbs(g: Ctx, bulbs: Bulb[], intensity = 1) {
  for (const b of bulbs) glow(g, b.x, b.y, b.r * 7, b.color, 0.16 * intensity);
  withBlend(g, 'lighter', () => {
    for (const b of bulbs) {
      const grd = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2);
      grd.addColorStop(0, rgba('#ffffff', 0.95 * intensity));
      grd.addColorStop(0.35, rgba(b.color, 0.9 * intensity));
      grd.addColorStop(1, rgba(b.color, 0));
      g.fillStyle = grd;
      g.fillRect(b.x - b.r * 2, b.y - b.r * 2, b.r * 4, b.r * 4);
    }
  });
}

// ------------------------------------------------------------------ flowers & decor
/** A single marigold (genda) flower ball. */
export function marigold(g: Ctx, parent: Rng, x: number, y: number, r: number, color: string) {
  const rng = fork(parent);
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  grd.addColorStop(0, mix(color, '#fff2a8', 0.45));
  grd.addColorStop(0.65, color);
  grd.addColorStop(1, mix(color, '#5a1a00', 0.5));
  ellipse(g, x, y, r, r, grd);
  if (r < 3) return;
  // ruffled petals
  const n = Math.min(26, Math.round(r * 1.4));
  for (let i = 0; i < n; i++) {
    const a = rand(rng, 0, TAU);
    const d = r * Math.sqrt(rng()) * 0.85;
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    const pr = r * rand(rng, 0.16, 0.28);
    g.strokeStyle = rgba(rng() < 0.5 ? mix(color, '#5a1a00', 0.45) : mix(color, '#fff0a0', 0.4), 0.55);
    g.lineWidth = Math.max(0.5, r * 0.07);
    g.beginPath();
    g.arc(px, py, pr, a, a + Math.PI * 0.9);
    g.stroke();
  }
}

/** Marigold garland along a path. Alternates orange and yellow with the odd leaf. */
export function marigoldGarland(g: Ctx, rng: Rng, path: Pt[], r: number, colors: readonly string[] = ['#ff8a00', '#ffb000', '#ff8a00', '#ffc83d']) {
  const pts = resample(path, r * 1.45);
  pts.forEach((p, i) => {
    if (i % 5 === 2) leaf(g, p.x + r * 0.5, p.y + r * 0.6, r * 1.1, rand(rng, 0.6, 2.4), '#2f7d32');
    marigold(g, rng, p.x + rand(rng, -0.1, 0.1) * r, p.y + rand(rng, -0.1, 0.1) * r, r * rand(rng, 0.92, 1.08), colors[i % colors.length]);
  });
}

/** Hanging vertical marigold strand (ladi) from (x, y) of length L, ending in a bell. */
export function marigoldStrand(g: Ctx, rng: Rng, x: number, y: number, L: number, r: number, colors: readonly string[] = ['#ff8a00', '#ffc23d']) {
  const n = Math.max(2, Math.floor(L / (r * 1.6)));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const sway = Math.sin(t * 3 + x * 0.01) * r * 0.25;
    marigold(g, rng, x + sway, y + i * r * 1.6, r * (i % 6 === 5 ? 0.75 : 1), i % 6 === 5 ? '#e2412b' : colors[i % colors.length]);
  }
  bell(g, x, y + n * r * 1.6 + r * 0.3, r * 1.1);
}

export function bell(g: Ctx, x: number, y: number, s: number) {
  const grd = g.createLinearGradient(x - s, 0, x + s, 0);
  grd.addColorStop(0, '#6a4410');
  grd.addColorStop(0.45, '#ffe08a');
  grd.addColorStop(1, '#7a5014');
  g.beginPath();
  g.moveTo(x, y - s * 0.6);
  g.bezierCurveTo(x + s * 0.55, y - s * 0.6, x + s * 0.5, y + s * 0.3, x + s * 0.75, y + s * 0.55);
  g.lineTo(x - s * 0.75, y + s * 0.55);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.3, x - s * 0.55, y - s * 0.6, x, y - s * 0.6);
  g.fillStyle = grd;
  g.fill();
  ellipse(g, x, y + s * 0.62, s * 0.14, s * 0.14, '#8a5a14');
}

/** Pointed leaf (mango leaf for torans). `ang` in radians, 0 = pointing right. */
export function leaf(g: Ctx, x: number, y: number, len: number, ang: number, color = '#2f7d32') {
  withState(g, () => {
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -len * 0.26, len, 0);
    g.quadraticCurveTo(len * 0.5, len * 0.26, 0, 0);
    const grd = g.createLinearGradient(0, -len * 0.2, 0, len * 0.2);
    grd.addColorStop(0, mix(color, '#b8e07a', 0.35));
    grd.addColorStop(1, mix(color, '#0a2a0c', 0.45));
    g.fillStyle = grd;
    g.fill();
    g.strokeStyle = rgba('#d8f0a0', 0.4);
    g.lineWidth = Math.max(0.5, len * 0.025);
    g.beginPath();
    g.moveTo(len * 0.05, 0);
    g.lineTo(len * 0.92, 0);
    g.stroke();
  });
}

/** Toran across the top: a brocade band with hanging mango leaves and marigolds. */
export function toran(g: Ctx, rng: Rng, x0: number, x1: number, y: number, size: number) {
  const bandH = size * 0.5;
  const grd = g.createLinearGradient(0, y - bandH / 2, 0, y + bandH / 2);
  grd.addColorStop(0, '#8a1030');
  grd.addColorStop(0.5, '#c0213f');
  grd.addColorStop(1, '#6a0a22');
  g.fillStyle = grd;
  g.fillRect(x0, y - bandH / 2, x1 - x0, bandH);
  g.fillStyle = '#e8b84a';
  g.fillRect(x0, y - bandH / 2, x1 - x0, Math.max(1, bandH * 0.12));
  g.fillRect(x0, y + bandH / 2 - Math.max(1, bandH * 0.12), x1 - x0, Math.max(1, bandH * 0.12));
  // mirror dots
  for (let x = x0 + size * 0.4; x < x1; x += size * 0.8) ellipse(g, x, y, bandH * 0.16, bandH * 0.16, '#fff1c8');
  const step = size * 0.62;
  let i = 0;
  for (let x = x0 + step / 2; x < x1; x += step, i++) {
    if (i % 3 === 1) marigold(g, rng, x, y + bandH * 0.5 + size * 0.28, size * 0.26, i % 2 ? '#ff8a00' : '#ffc23d');
    else leaf(g, x, y + bandH * 0.4, size * rand(rng, 0.85, 1.05), Math.PI / 2 + rand(rng, -0.12, 0.12), '#2f7d32');
  }
}

/** Lotus flower (side view). */
export function lotus(g: Ctx, x: number, y: number, s: number, color = '#f06292') {
  const petal = (ang: number, len: number, wid: number, c: string) => {
    withState(g, () => {
      g.translate(x, y);
      g.rotate(ang);
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(wid, -len * 0.5, 0, -len);
      g.quadraticCurveTo(-wid, -len * 0.5, 0, 0);
      const grd = g.createLinearGradient(0, 0, 0, -len);
      grd.addColorStop(0, mix(c, '#fff6f0', 0.6));
      grd.addColorStop(1, c);
      g.fillStyle = grd;
      g.fill();
    });
  };
  for (const a of [-1.15, 1.15]) petal(a, s * 0.7, s * 0.22, mix(color, '#7a1040', 0.2));
  for (const a of [-0.7, 0.7]) petal(a, s * 0.85, s * 0.26, color);
  for (const a of [-0.28, 0.28]) petal(a, s * 0.95, s * 0.26, mix(color, '#ffd0e0', 0.25));
  petal(0, s, s * 0.28, mix(color, '#ffe0ea', 0.35));
}

/** Scattered petals (rose / marigold) on a surface. */
export function petals(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, count: number, size: number, colors: readonly string[] = ['#ff8a00', '#ffc23d', '#e2412b', '#d6247b']) {
  for (let i = 0; i < count; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const s = size * rand(rng, 0.5, 1.2);
    ellipse(g, x, y, s, s * 0.55, pick(rng, colors), rand(rng, 0, Math.PI));
  }
}

// ------------------------------------------------------------------ rangoli
export interface RangoliOpts {
  palette?: readonly string[];
  rings?: number;
  /** Vertical squash for perspective (1 = seen from above). */
  tilt?: number;
  /** Number of symmetric petals. */
  petals?: number;
  /** Place diyas around the outer ring (returns flame points). */
  diyas?: number;
}

/**
 * Mandala rangoli of coloured powder, centred at (cx, cy) with radius R.
 * Returns flame positions of the diyas placed around it (if any).
 */
export function rangoli(g: Ctx, parent: Rng, cx: number, cy: number, R: number, o: RangoliOpts = {}): (Pt & { s: number })[] {
  const rng = fork(parent);
  const pal = o.palette ?? ['#e2412b', '#ffb000', '#d6247b', '#1f9e89', '#5b2a86', '#ffffff', '#ff7a00'];
  const tilt = o.tilt ?? 1;
  const N = o.petals ?? 12;
  const rings = o.rings ?? 5;
  withState(g, () => {
    g.translate(cx, cy);
    g.scale(1, tilt);
    // soft powder halo
    ellipse(g, 0, 0, R * 1.04, R * 1.04, rgba('#000000', 0.22));
    // outer border of dots and scallops
    const ring = (r0: number, r1: number, n: number, c1: string, c2: string, rot: number) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU + rot;
        const a1 = ((i + 1) / n) * TAU + rot;
        const am = (a0 + a1) / 2;
        g.beginPath();
        g.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        g.quadraticCurveTo(Math.cos(am) * (r1 + (r1 - r0) * 0.6), Math.sin(am) * (r1 + (r1 - r0) * 0.6), Math.cos(a1) * r0, Math.sin(a1) * r0);
        g.closePath();
        g.fillStyle = i % 2 ? c1 : c2;
        g.fill();
      }
    };
    ellipse(g, 0, 0, R * 0.98, R * 0.98, pal[4 % pal.length]);
    ring(R * 0.78, R * 0.96, N * 2, pal[0], pal[1], 0);
    ellipse(g, 0, 0, R * 0.8, R * 0.8, pal[3 % pal.length]);
    for (let k = 0; k < rings; k++) {
      const r0 = R * (0.72 - k * 0.13);
      const r1 = r0 + R * 0.13;
      if (r0 <= R * 0.08) break;
      ring(r0, r1, N, pal[(k + 2) % pal.length], pal[(k + 5) % pal.length], k % 2 ? Math.PI / N : 0);
      ellipse(g, 0, 0, r0 * 1.0, r0 * 1.0, pal[(k + 1) % pal.length]);
    }
    // lotus centre
    for (let i = 0; i < 8; i++) {
      withState(g, () => {
        g.rotate((i / 8) * TAU);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(R * 0.06, -R * 0.12, 0, -R * 0.2);
        g.quadraticCurveTo(-R * 0.06, -R * 0.12, 0, 0);
        g.fillStyle = i % 2 ? '#ffffff' : pal[0];
        g.fill();
      });
    }
    ellipse(g, 0, 0, R * 0.05, R * 0.05, '#ffd34d');
    // white dotted outlines
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const rr of [0.98, 0.8, 0.45]) {
      const n = Math.round(R * rr * 0.35);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        g.beginPath();
        g.arc(Math.cos(a) * R * rr, Math.sin(a) * R * rr, Math.max(0.6, R * 0.008), 0, TAU);
        g.fill();
      }
    }
    // powder grain
    for (let i = 0; i < R * 6; i++) {
      const a = rand(rng, 0, TAU);
      const d = R * Math.sqrt(rng());
      g.fillStyle = rgba(rng() < 0.5 ? '#ffffff' : '#000000', rand(rng, 0.04, 0.12));
      g.fillRect(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.6, R * 0.006), Math.max(0.6, R * 0.006));
    }
  });
  const flames: (Pt & { s: number })[] = [];
  const nd = o.diyas ?? 0;
  const ds = R * 0.16;
  for (let i = 0; i < nd; i++) {
    const a = (i / nd) * TAU + Math.PI / nd;
    const dx = cx + Math.cos(a) * R * 1.12;
    const dy = cy + Math.sin(a) * R * 1.12 * tilt;
    if (Math.sin(a) < 0) flames.push({ ...diya(g, dx, dy, ds, { dir: Math.cos(a) > 0 ? 1 : -1 }), s: ds });
  }
  for (let i = 0; i < nd; i++) {
    const a = (i / nd) * TAU + Math.PI / nd;
    const dx = cx + Math.cos(a) * R * 1.12;
    const dy = cy + Math.sin(a) * R * 1.12 * tilt;
    if (Math.sin(a) >= 0) flames.push({ ...diya(g, dx, dy, ds, { dir: Math.cos(a) > 0 ? 1 : -1 }), s: ds });
  }
  return flames;
}

// ------------------------------------------------------------------ architecture
/** Mughal / Rajput cusped arch outline, base at y, spring at y - h * 0.55. */
export function archPath(g: Ctx, x: number, y: number, w: number, h: number, cusps = 0) {
  const hw = w / 2;
  const spring = y - h * 0.58;
  g.moveTo(x - hw, y);
  g.lineTo(x - hw, spring);
  if (cusps > 0) {
    // multifoil arch
    const n = cusps;
    let px = x - hw;
    let py = spring;
    for (let i = 1; i <= n; i++) {
      const a = Math.PI - (i / n) * Math.PI;
      const nx = x + Math.cos(a) * hw;
      const ny = spring - Math.sin(a) * (h - (y - spring)) * 1.0;
      const mx = (px + nx) / 2;
      const my = (py + ny) / 2;
      const nxv = -(ny - py);
      const nyv = nx - px;
      const L = Math.hypot(nxv, nyv) || 1;
      g.quadraticCurveTo(mx + (nxv / L) * hw * 0.12, my + (nyv / L) * hw * 0.12, nx, ny);
      px = nx;
      py = ny;
    }
  } else {
    // pointed (ogee-ish) arch
    g.bezierCurveTo(x - hw, spring - h * 0.25, x - hw * 0.25, y - h * 0.9, x, y - h);
    g.bezierCurveTo(x + hw * 0.25, y - h * 0.9, x + hw, spring - h * 0.25, x + hw, spring);
  }
  g.lineTo(x + hw, y);
}

/** Simple skyline of buildings / temple spires. Returns lit window rects for the lights pass. */
export function skyline(g: Ctx, rng: Rng, x0: number, x1: number, base: number, maxH: number, color: string, opts: { temples?: number; windowColor?: string } = {}) {
  const windows: { x: number; y: number; w: number; h: number; c: string }[] = [];
  let x = x0;
  g.fillStyle = color;
  while (x < x1) {
    const bw = maxH * rand(rng, 0.25, 0.6);
    const bh = maxH * rand(rng, 0.3, 1);
    g.fillRect(x, base - bh, bw + 1, bh + 2);
    if (rng() < 0.3) {
      // little rooftop chhatri
      g.beginPath();
      g.arc(x + bw / 2, base - bh, bw * 0.22, Math.PI, 0);
      g.fill();
    }
    const ww = Math.max(1.2, maxH * 0.035);
    for (let wy = base - bh + ww * 2; wy < base - ww * 2; wy += ww * 2.6)
      for (let wx = x + ww; wx < x + bw - ww; wx += ww * 2.2)
        if (rng() < 0.32) windows.push({ x: wx, y: wy, w: ww, h: ww * 1.3, c: opts.windowColor ?? pick(rng, ['#ffcf73', '#ffb347', '#ffe3a3']) });
    x += bw + maxH * rand(rng, 0, 0.06);
  }
  const temples = opts.temples ?? 0;
  for (let i = 0; i < temples; i++) {
    const tx = rand(rng, x0 + (x1 - x0) * 0.1, x1 - (x1 - x0) * 0.1);
    const th = maxH * rand(rng, 1.1, 1.5);
    const tw = th * 0.42;
    g.beginPath();
    g.moveTo(tx - tw / 2, base);
    g.lineTo(tx - tw / 2, base - th * 0.35);
    g.bezierCurveTo(tx - tw * 0.45, base - th * 0.8, tx - tw * 0.1, base - th * 0.92, tx, base - th);
    g.bezierCurveTo(tx + tw * 0.1, base - th * 0.92, tx + tw * 0.45, base - th * 0.8, tx + tw / 2, base - th * 0.35);
    g.lineTo(tx + tw / 2, base);
    g.fill();
    g.fillRect(tx - 1, base - th * 1.08, 2, th * 0.08);
  }
  return windows;
}

export function drawWindows(g: Ctx, windows: { x: number; y: number; w: number; h: number; c: string }[]) {
  for (const w of windows) {
    g.fillStyle = w.c;
    g.fillRect(w.x, w.y, w.w, w.h);
  }
  for (const w of windows) glow(g, w.x + w.w / 2, w.y + w.h / 2, w.w * 3, w.c, 0.12);
}

/** Palm / tree silhouette. */
export function palm(g: Ctx, rng: Rng, x: number, base: number, h: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, h * 0.035);
  g.lineCap = 'round';
  const lean = rand(rng, -0.15, 0.15) * h;
  g.beginPath();
  g.moveTo(x, base);
  g.quadraticCurveTo(x + lean * 0.2, base - h * 0.5, x + lean, base - h);
  g.stroke();
  const tx = x + lean;
  const ty = base - h;
  g.fillStyle = color;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rand(rng, -0.2, 0.2);
    const L = h * rand(rng, 0.35, 0.5);
    const ex = tx + Math.cos(a) * L;
    const ey = ty + Math.sin(a) * L * 0.55 + L * 0.25;
    g.beginPath();
    g.moveTo(tx, ty);
    g.quadraticCurveTo((tx + ex) / 2, ty - L * 0.25, ex, ey);
    g.quadraticCurveTo((tx + ex) / 2, ty - L * 0.1, tx, ty);
    g.fill();
  }
}

// ------------------------------------------------------------------ finishing
/** Darkens the edges (normal blend). */
export function vignette(g: Ctx, w: number, h: number, strength = 0.45, color = '#000000') {
  const r = Math.hypot(w, h) / 2;
  const grd = g.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
  grd.addColorStop(0, rgba(color, 0));
  grd.addColorStop(1, rgba(color, strength));
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

/** Warm ambient wash over the whole image (screen blend). */
export function warmWash(g: Ctx, w: number, h: number, color = '#ff9a3c', alpha = 0.08) {
  withBlend(g, 'screen', () => {
    g.fillStyle = rgba(color, alpha);
    g.fillRect(0, 0, w, h);
  });
}

/** Fine paint grain (normal blend, very low alpha speckle). */
export function grain(g: Ctx, parent: Rng, w: number, h: number, amount = 0.05) {
  const rng = fork(parent);
  const n = Math.round((w * h) / 90);
  const s = Math.max(1, Math.round(Math.max(w, h) / 1100));
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${amount * rng()})` : `rgba(0,0,0,${amount * rng()})`;
    g.fillRect(rng() * w, rng() * h, s, s);
  }
}
