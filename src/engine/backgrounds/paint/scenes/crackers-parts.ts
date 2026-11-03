/**
 * Painting parts for the "Diwali Crackers" scene (also reused by the river
 * ghat night scene): fireworks split into a painted base and crisp lights,
 * polygon silhouettes that record the skyline envelope (for the sky mask and
 * for clipping fireworks behind buildings), lit smoke, and ground crackers.
 *
 * Every helper that loops a size-dependent number of times takes its own
 * forked random stream, so the main sequence (and the layout) is identical at
 * every canvas size.
 */
import { TAU, clamp01, ctx2d, gauss, glow, lerp, makeCanvas, mix, mulberry32, pick, rand, randInt, rgba, wash, withBlend, withState, type AnyCanvas, type Ctx, type Rng } from '../kit';

/** Independent random stream derived from `rng` (consumes exactly one draw). */
export const fork = (rng: Rng): Rng => mulberry32(Math.floor(rng() * 4294967296));

// ------------------------------------------------------------------ light sprites
const sprites = new Map<string, AnyCanvas>();

/** Round light sprite: hot core fading to `color`. Cached; draw with 'lighter'. */
export function lightSprite(color: string, core = '#fffaf0'): AnyCanvas {
  const key = `${color}|${core}`;
  let c = sprites.get(key);
  if (!c) {
    c = makeCanvas(64, 64);
    const g = ctx2d(c);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, rgba(core, 1));
    grd.addColorStop(0.07, rgba(core, 0.95));
    grd.addColorStop(0.16, rgba(color, 0.7));
    grd.addColorStop(0.32, rgba(color, 0.22));
    grd.addColorStop(0.6, rgba(color, 0.06));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    sprites.set(key, c);
  }
  return c;
}

/** Small flame sprite (teardrop + halo). Base of the flame at (32, 74), flame 40 px tall. */
function flameSprite(): AnyCanvas {
  let c = sprites.get('flame');
  if (!c) {
    c = makeCanvas(64, 96);
    const g = ctx2d(c);
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(32, 60, 0, 32, 60, 32);
    halo.addColorStop(0, 'rgba(255,170,70,0.55)');
    halo.addColorStop(0.4, 'rgba(255,120,30,0.18)');
    halo.addColorStop(1, 'rgba(255,100,20,0)');
    g.fillStyle = halo;
    g.fillRect(0, 28, 64, 64);
    const body = (s: number) => {
      g.beginPath();
      g.moveTo(32, 74 + 4 * s);
      g.bezierCurveTo(32 - 11 * s, 72, 32 - 7 * s, 74 - 20 * s, 32, 74 - 40 * s);
      g.bezierCurveTo(32 + 7 * s, 74 - 20 * s, 32 + 11 * s, 72, 32, 74 + 4 * s);
    };
    body(1);
    const fg = g.createLinearGradient(0, 78, 0, 34);
    fg.addColorStop(0, 'rgba(255,110,10,0.95)');
    fg.addColorStop(0.35, 'rgba(255,180,60,1)');
    fg.addColorStop(1, 'rgba(255,90,0,0.15)');
    g.fillStyle = fg;
    g.fill();
    body(0.55);
    const cg = g.createLinearGradient(0, 78, 0, 50);
    cg.addColorStop(0, 'rgba(255,252,235,1)');
    cg.addColorStop(1, 'rgba(255,225,140,0)');
    g.fillStyle = cg;
    g.fill();
    sprites.set('flame', c);
  }
  return c;
}

/** Draws a sprite of radius r centred at (x, y). */
export function dot(g: Ctx, s: AnyCanvas, x: number, y: number, r: number) {
  if (r > 0.2) g.drawImage(s as CanvasImageSource, x - r, y - r, r * 2, r * 2);
}

/** Tiny lamp flame standing on (x, y), `fh` px tall (cheap: one sprite blit). */
export function tinyFlame(g: Ctx, x: number, y: number, fh: number, alpha = 1) {
  const s = fh / 40;
  withBlend(g, 'lighter', () => {
    g.globalAlpha = clamp01(alpha);
    g.drawImage(flameSprite() as CanvasImageSource, x - 32 * s, y - 74 * s, 64 * s, 96 * s);
  });
}

// ------------------------------------------------------------------ polygons + skyline envelope
/** Builds a flat [x0,y0,x1,y1,...] polygon from lines and sampled curves. */
export class Shape {
  p: number[] = [];
  l(x: number, y: number) {
    this.p.push(x, y);
    return this;
  }
  q(cx: number, cy: number, x: number, y: number, n = 8) {
    const x0 = this.p[this.p.length - 2];
    const y0 = this.p[this.p.length - 1];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const s = 1 - t;
      this.p.push(s * s * x0 + 2 * s * t * cx + t * t * x, s * s * y0 + 2 * s * t * cy + t * t * y);
    }
    return this;
  }
  c(ax: number, ay: number, bx: number, by: number, x: number, y: number, n = 10) {
    const x0 = this.p[this.p.length - 2];
    const y0 = this.p[this.p.length - 1];
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const s = 1 - t;
      this.p.push(s * s * s * x0 + 3 * s * s * t * ax + 3 * s * t * t * bx + t * t * t * x, s * s * s * y0 + 3 * s * s * t * ay + 3 * s * t * t * by + t * t * t * y);
    }
    return this;
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      this.p.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    return this;
  }
}

export function rectPoly(x0: number, y0: number, x1: number, y1: number) {
  return [x0, y1, x0, y0, x1, y0, x1, y1];
}

/** Adds a polygon (or polyline when open) to the current path. */
export function trace(g: Ctx, p: number[], close = true) {
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  if (close) g.closePath();
}

/** Upper envelope of everything standing in front of the sky. */
export class Envelope {
  top: Float32Array;
  dx: number;
  constructor(
    public w: number,
    public h: number,
    public n = 480,
  ) {
    this.top = new Float32Array(n).fill(h);
    this.dx = w / (n - 1);
  }
  add(p: number[]) {
    const L = p.length;
    for (let i = 0; i < L; i += 2) {
      const x0 = p[i];
      const y0 = p[i + 1];
      const x1 = p[(i + 2) % L];
      const y1 = p[(i + 3) % L];
      const a = Math.max(0, Math.ceil(Math.min(x0, x1) / this.dx));
      const b = Math.min(this.n - 1, Math.floor(Math.max(x0, x1) / this.dx));
      for (let k = a; k <= b; k++) {
        const t = x1 === x0 ? 0 : (k * this.dx - x0) / (x1 - x0);
        const y = Math.min(y0 + (y1 - y0) * t, x1 === x0 ? Math.min(y0, y1) : Infinity);
        if (y < this.top[k]) this.top[k] = y;
      }
    }
  }
  /** Lowers nothing; raises the envelope to at least `y` over [x0, x1]. */
  addRect(x0: number, x1: number, y: number) {
    this.add(rectPoly(x0, y, x1, this.h));
  }
  at(x: number) {
    return this.top[Math.max(0, Math.min(this.n - 1, Math.round(x / this.dx)))];
  }
  /** Path of the open sky above the envelope. */
  skyPath(g: Ctx) {
    g.beginPath();
    g.moveTo(-2, -2);
    g.lineTo(this.w + 2, -2);
    g.lineTo(this.w + 2, this.top[this.n - 1]);
    for (let k = this.n - 1; k >= 0; k--) g.lineTo(k * this.dx, this.top[k]);
    g.lineTo(-2, this.top[0]);
    g.closePath();
  }
}

// ------------------------------------------------------------------ fireworks
export type Kind = 'peony' | 'chrys' | 'willow' | 'ring' | 'palm' | 'crossette';

export interface Spark {
  pts: number[];
  c: string;
  w: number;
  a: number;
  /** Size of the bright head (0 = none). */
  tip: number;
  /** 0 = brightest at the head, 1 = bright near the start and burning out (willow). */
  fade: 0 | 1;
}

export interface Burst {
  x: number;
  y: number;
  r: number;
  c: string;
  c2: string;
  a: number;
  kind: Kind;
  sparks: Spark[];
  /** Glitter dots: x, y, radius triplets. */
  glit: number[];
}

/** Lays out a firework burst (all geometry fixed here, so base and lights match). */
export function planBurst(rng: Rng, x: number, y: number, r: number, kind: Kind, c: string, c2: string, a = 1): Burst {
  const b: Burst = { x, y, r, c, c2, a, kind, sparks: [], glit: [] };
  const lw = Math.max(0.9, r * 0.0085);
  const traj = (dx: number, dy: number, drag: number, grav: number, t0: number, t1: number, n: number, ox = x, oy = y, R = r) => {
    const pts: number[] = [];
    const norm = 1 - Math.exp(-drag);
    for (let k = 0; k <= n; k++) {
      const t = t0 + (t1 - t0) * (k / n);
      const s = (1 - Math.exp(-drag * t)) / norm;
      pts.push(ox + dx * R * s, oy + dy * R * s + grav * R * t * t);
    }
    return pts;
  };
  const sphere = (): [number, number] => {
    const z = rand(rng, -1, 1);
    const p = rand(rng, 0, TAU);
    const q = Math.sqrt(1 - z * z);
    return [Math.cos(p) * q, Math.sin(p) * q];
  };
  const glitter = (pts: number[], count: number, size: number, drop: number) => {
    const n = pts.length / 2;
    for (let i = 0; i < count; i++) {
      const k = Math.min(n - 1, Math.floor(Math.pow(rng(), 0.6) * n));
      b.glit.push(pts[k * 2] + gauss(rng) * r * 0.012, pts[k * 2 + 1] + rand(rng, 0, drop) * r, size * rand(rng, 0.4, 1.1));
    }
  };
  const white = '#fff6e6';
  switch (kind) {
    case 'peony': {
      for (let i = 0; i < 76; i++) {
        const [dx, dy] = sphere();
        const sp = rand(rng, 0.9, 1.05);
        const col = rng() < 0.1 ? white : rng() < 0.22 ? c2 : c;
        b.sparks.push({ pts: traj(dx * sp, dy * sp, 2.2, 0.12, 0.38, 1, 6), c: col, w: lw, a: rand(rng, 0.55, 1), tip: 1, fade: 0 });
      }
      break;
    }
    case 'chrys': {
      for (let i = 0; i < 92; i++) {
        const [dx, dy] = sphere();
        const sp = rand(rng, 0.92, 1.04);
        const pts = traj(dx * sp, dy * sp, 2.4, 0.15, 0.03, 1, 8);
        b.sparks.push({ pts, c: rng() < 0.08 ? white : c, w: lw * 0.9, a: rand(rng, 0.5, 1), tip: 0.9, fade: 0 });
        if (rng() < 0.45) glitter(pts, 2, lw * 1.6, 0.03);
      }
      // bright tips in the second colour
      for (const s of b.sparks) if (rng() < 0.6) s.c = rng() < 0.5 ? s.c : c2;
      break;
    }
    case 'willow': {
      for (let i = 0; i < 50; i++) {
        const [dx, dy] = sphere();
        const sp = rand(rng, 0.8, 1.05);
        const pts = traj(dx * sp, dy * sp, 3.4, 0.5, 0.05, rand(rng, 1.15, 1.75), 12);
        b.sparks.push({ pts, c: pick(rng, [c, c, '#ffcf6b', '#ffb04a', '#fff0c0']), w: lw * 1.05, a: rand(rng, 0.55, 1), tip: 0, fade: 1 });
        glitter(pts, 4, lw * 1.5, 0.12);
      }
      break;
    }
    case 'ring': {
      const ct = rand(rng, 0.5, 0.85);
      const rot = rand(rng, -0.5, 0.5);
      for (let i = 0; i < 48; i++) {
        const th = (i / 48) * TAU + rand(rng, -0.03, 0.03);
        const px = Math.cos(th);
        const py = Math.sin(th) * ct;
        const dx = px * Math.cos(rot) - py * Math.sin(rot);
        const dy = px * Math.sin(rot) + py * Math.cos(rot);
        b.sparks.push({ pts: traj(dx, dy, 2, 0.08, 0.66, 1, 3), c: rng() < 0.12 ? white : c, w: lw * 1.1, a: rand(rng, 0.7, 1), tip: 1.15, fade: 0 });
      }
      for (let i = 0; i < 28; i++) {
        const [dx, dy] = sphere();
        b.sparks.push({ pts: traj(dx * 0.4, dy * 0.4, 2, 0.06, 0.4, 1, 3), c: c2, w: lw * 0.9, a: rand(rng, 0.5, 0.9), tip: 0.9, fade: 0 });
      }
      break;
    }
    case 'palm': {
      // rising trunk
      const tr: number[] = [];
      for (let k = 0; k <= 10; k++) tr.push(x + Math.sin(k * 0.9) * lw * 0.8, y + r * 1.5 * (1 - k / 10));
      b.sparks.push({ pts: tr, c: '#ffd9a0', w: lw * 1.6, a: 0.7, tip: 0, fade: 0 });
      const arms = 9;
      for (let i = 0; i < arms; i++) {
        const th = -Math.PI / 2 + ((i + 0.5) / arms - 0.5) * TAU * 0.92 + rand(rng, -0.12, 0.12);
        const pts = traj(Math.cos(th) * rand(rng, 0.9, 1.05), Math.sin(th) * 0.85, 1.5, 0.62, 0.02, 1.25, 12);
        b.sparks.push({ pts, c: pick(rng, [c, '#ffcf6b', '#ffe2a0']), w: lw * 2.8, a: 0.95, tip: 0.8, fade: 1 });
        // feathered side sparks
        for (let k = 0; k < 7; k++) {
          const j = 2 + Math.floor(rng() * 8);
          const sx = pts[j * 2];
          const sy = pts[j * 2 + 1];
          const ang = Math.atan2(pts[j * 2 + 3] - sy, pts[j * 2 + 2] - sx) + (rng() < 0.5 ? 1 : -1) * rand(rng, 0.5, 1);
          const L = r * rand(rng, 0.06, 0.14);
          b.sparks.push({ pts: [sx, sy, sx + Math.cos(ang) * L * 0.6, sy + Math.sin(ang) * L * 0.6 + L * 0.1, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L + L * 0.35], c: '#ffe2a0', w: lw * 0.8, a: 0.6, tip: 0, fade: 1 });
        }
        glitter(pts, 10, lw * 1.8, 0.1);
      }
      break;
    }
    case 'crossette': {
      const n = 13;
      for (let i = 0; i < n; i++) {
        const th = (i / n) * TAU + rand(rng, -0.15, 0.15);
        const sp = rand(rng, 0.85, 1);
        const pts = traj(Math.cos(th) * sp, Math.sin(th) * sp, 1.8, 0.1, 0.1, 0.62, 5);
        b.sparks.push({ pts, c: c, w: lw * 1.3, a: 0.85, tip: 0, fade: 0 });
        const ex = pts[pts.length - 2];
        const ey = pts[pts.length - 1];
        const rot = th + Math.PI / 4 + rand(rng, -0.2, 0.2);
        for (let k = 0; k < 4; k++) {
          const d = rot + (k * Math.PI) / 2;
          b.sparks.push({ pts: traj(Math.cos(d), Math.sin(d), 1.6, 0.25, 0.08, 1, 4, ex, ey, r * rand(rng, 0.28, 0.38)), c: c2, w: lw, a: rand(rng, 0.7, 1), tip: 1, fade: 0 });
        }
      }
      break;
    }
  }
  return b;
}

/** Painted part of a burst: the light it throws on sky and smoke, and soft broad rays. */
export function burstBase(g: Ctx, b: Burst, k = 1) {
  const A = b.a * k;
  glow(g, b.x, b.y + b.r * 0.2, b.r * 1.9, b.c, 0.15 * A, 1.7);
  glow(g, b.x, b.y, b.r * 0.75, mix(b.c, '#ffffff', 0.35), 0.13 * A, 1.2);
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of b.sparks) {
      g.strokeStyle = rgba(s.c, 0.13 * s.a * A);
      g.lineWidth = Math.max(2.5, s.w * 4.5);
      g.beginPath();
      trace(g, s.pts, false);
      g.stroke();
    }
  });
}

/** Crisp sparks of a burst (lights pass). */
export function burstLights(g: Ctx, b: Burst, k = 1) {
  const A = b.a * k;
  glow(g, b.x, b.y, b.r * 0.35, mix(b.c, '#ffffff', 0.5), 0.2 * A);
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of b.sparks) {
      const p = s.pts;
      const n = p.length;
      const sa = s.a * A;
      const grd = g.createLinearGradient(p[0], p[1], p[n - 2], p[n - 1]);
      if (s.fade) {
        grd.addColorStop(0, rgba(s.c, 0.1 * sa));
        grd.addColorStop(0.25, rgba(s.c, 0.85 * sa));
        grd.addColorStop(0.7, rgba(s.c, 0.45 * sa));
        grd.addColorStop(1, rgba(s.c, 0));
      } else {
        grd.addColorStop(0, rgba(s.c, 0));
        grd.addColorStop(0.55, rgba(s.c, 0.35 * sa));
        grd.addColorStop(1, rgba(s.c, sa));
      }
      g.strokeStyle = grd;
      g.lineWidth = s.w;
      g.beginPath();
      trace(g, p, false);
      g.stroke();
    }
    for (const s of b.sparks) {
      if (!s.tip) continue;
      const n = s.pts.length;
      g.globalAlpha = clamp01(s.a * A);
      dot(g, lightSprite(s.c), s.pts[n - 2], s.pts[n - 1], s.w * 3.4 * s.tip);
    }
    const gs = lightSprite('#ffc85a', '#fffbe8');
    for (let i = 0; i < b.glit.length; i += 3) {
      g.globalAlpha = clamp01(A * 0.85);
      dot(g, gs, b.glit[i], b.glit[i + 1], b.glit[i + 2] * 2.2);
    }
  });
}

/** Rising rocket: a wobbling spark trail with a hot head (lights pass). */
export function rocketTrail(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, width: number, color = '#ffd9a0') {
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    const n = 14;
    const pts: number[] = [];
    const bend = rand(rng, -0.06, 0.06) * Math.abs(y1 - y0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(lerp(x0, x1, t) + Math.sin(t * Math.PI) * bend + Math.sin(t * 23) * width * 0.35, lerp(y0, y1, t));
    }
    const grd = g.createLinearGradient(x0, y0, x1, y1);
    grd.addColorStop(0, rgba(color, 0));
    grd.addColorStop(0.7, rgba(color, 0.35));
    grd.addColorStop(1, rgba('#fff4dc', 0.9));
    g.strokeStyle = grd;
    g.lineWidth = width;
    g.beginPath();
    trace(g, pts, false);
    g.stroke();
    const sp = lightSprite('#ffb54a', '#fff2c8');
    for (let i = 0; i < 10; i++) {
      const t = Math.pow(rng(), 0.5);
      const k = Math.min(n, Math.floor(t * n));
      g.globalAlpha = 0.3 + 0.6 * t;
      dot(g, sp, pts[k * 2] + gauss(rng) * width * 2, pts[k * 2 + 1] + rand(rng, 0, 6) * width, width * rand(rng, 0.8, 1.8));
    }
    g.globalAlpha = 1;
    dot(g, lightSprite('#ffc870', '#ffffff'), x1, y1, width * 6);
  });
}

/** Drifting glitter / embers over a region (lights pass). */
export function embers(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, count: number, size: number, colors: readonly string[] = ['#ffd27a', '#fff0c8', '#ffb04a']) {
  withBlend(g, 'lighter', () => {
    for (let i = 0; i < count; i++) {
      const x = rand(rng, x0, x1);
      const y = rand(rng, y0, y1);
      g.globalAlpha = rand(rng, 0.25, 0.95);
      dot(g, lightSprite(pick(rng, colors)), x, y, size * Math.pow(rng(), 1.8) * 2.4 + size * 0.5);
    }
  });
}

/** Twinkling stars (lights pass, crisp). */
export function starField(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, count: number, size: number) {
  withBlend(g, 'lighter', () => {
    const cool = lightSprite('#bcd0ff', '#ffffff');
    const warm = lightSprite('#ffe0b0', '#ffffff');
    for (let i = 0; i < count; i++) {
      const x = rand(rng, x0, x1);
      const y = y0 + (y1 - y0) * Math.pow(rng(), 1.5);
      const big = rng() < 0.07;
      g.globalAlpha = rand(rng, 0.3, 0.9) * (1 - 0.6 * ((y - y0) / (y1 - y0)));
      dot(g, rng() < 0.6 ? cool : warm, x, y, size * (big ? rand(rng, 2.2, 3.4) : rand(rng, 0.7, 1.5)));
    }
  });
}

// ------------------------------------------------------------------ smoke
/**
 * Billowing smoke puffs lit from a direction: each puff is a radial gradient
 * whose bright side faces the light. Painted in the base pass.
 */
export function litSmoke(g: Ctx, rng: Rng, cx: number, cy: number, rx: number, ry: number, puffs: number, size: number, shadow: string, light: string, lx: number, ly: number, alpha: number) {
  for (let i = 0; i < puffs; i++) {
    const a = rand(rng, 0, TAU);
    const d = Math.sqrt(rng());
    puff(g, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, size * rand(rng, 0.55, 1.25), shadow, light, lx, ly, alpha * rand(rng, 0.55, 1));
  }
}

/** One smoke puff whose bright side faces the light at (lx, ly). */
export function puff(g: Ctx, x: number, y: number, r: number, shadow: string, light: string, lx: number, ly: number, al: number) {
  const dl = Math.hypot(lx - x, ly - y) || 1;
  const ox = ((lx - x) / dl) * r * 0.4;
  const oy = ((ly - y) / dl) * r * 0.4;
  const grd = g.createRadialGradient(x + ox, y + oy, r * 0.05, x, y, r);
  grd.addColorStop(0, rgba(light, al));
  grd.addColorStop(0.45, rgba(mix(light, shadow, 0.55), al * 0.75));
  grd.addColorStop(0.8, rgba(shadow, al * 0.35));
  grd.addColorStop(1, rgba(shadow, 0));
  g.fillStyle = grd;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Smoke left by a rocket, drifting along a quadratic curve and widening. */
export function smokeTrail(g: Ctx, rng: Rng, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, n: number, r0: number, r1: number, shadow: string, light: string, lx: number, ly: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const s = 1 - t;
    const x = s * s * x0 + 2 * s * t * cx + t * t * x1;
    const y = s * s * y0 + 2 * s * t * cy + t * t * y1;
    const r = lerp(r0, r1, t) * rand(rng, 0.7, 1.2);
    puff(g, x + gauss(rng) * r * 0.3, y + gauss(rng) * r * 0.3, r, shadow, light, lx, ly, alpha * rand(rng, 0.5, 1) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.3))));
  }
}

/** A long horizontal band of haze (normal blend). */
export function hazeBand(g: Ctx, y0: number, y1: number, w: number, color: string, alpha: number) {
  const grd = g.createLinearGradient(0, y0, 0, y1);
  grd.addColorStop(0, rgba(color, 0));
  grd.addColorStop(0.5, rgba(color, alpha));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, y0, w, y1 - y0);
}

// ------------------------------------------------------------------ architecture
export interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
  arch: boolean;
  c: string;
  /** Brightness 0..1 (0 = dark window). */
  on: number;
}

export interface Strand {
  pts: number[];
  colors: readonly string[];
  r: number;
}

/** Everything a row of buildings needs for the base and lights passes. */
export class City {
  polys: number[][] = [];
  /** Per-polygon tone 0..1 (one per building) for varied silhouettes. */
  tones: number[] = [];
  tone = 0;
  /** Floor ledges (chajjas): x0, x1, y, thickness. */
  ledges: number[] = [];
  sticks: number[] = [];
  flags: number[][] = [];
  wins: Win[] = [];
  strands: Strand[] = [];
  /** Small lamp flames: x, y, height triplets. */
  lamps: number[] = [];
  /** Light outlines (polylines) of temple spires and domes. */
  outlines: { pts: number[]; color: string; r: number; step: number }[] = [];
  constructor(
    public env: Envelope | null,
    public u: number,
  ) {}
  add(p: number[]) {
    this.polys.push(p);
    this.tones.push(this.tone);
    this.env?.add(p);
    return p;
  }
  stick(x0: number, y0: number, x1: number, y1: number, w: number) {
    this.sticks.push(x0, y0, x1, y1, w);
    this.env?.add([x0 - w, y0, x0 + w, y0, x1 + w, y1, x1 - w, y1]);
  }
}

export const WARM_WINDOWS = ['#ffcf73', '#ffb347', '#ffe3a3', '#ffc061', '#ff9f4a'] as const;
export const FAIRY_SETS: readonly (readonly string[])[] = [
  ['#ffd166', '#ffb03a', '#fff0b0'],
  ['#ff4f6d', '#ffd166', '#5ad1ff', '#7dff7a', '#ff7ad9'],
  ['#ff7a00', '#ffd166'],
  ['#ff5ab4', '#b88cff', '#ffd166'],
  ['#5ad1ff', '#ffffff', '#ffd166'],
];

function windowsGrid(rng: Rng, c: City, x0: number, x1: number, top: number, bottom: number, floors: number, cols: number, arch: boolean, pLit: number) {
  const fh = (bottom - top) / floors;
  const cw = (x1 - x0) / cols;
  const ww = cw * rand(rng, 0.36, 0.5);
  const wh = fh * rand(rng, 0.42, 0.56);
  for (let f = 0; f < floors; f++)
    for (let k = 0; k < cols; k++) {
      const lit = rng() < pLit;
      c.wins.push({
        x: x0 + cw * (k + 0.5) - ww / 2,
        y: top + fh * f + (fh - wh) * 0.45,
        w: ww,
        h: wh,
        arch,
        c: rng() < 0.06 ? '#a8d4ff' : pick(rng, WARM_WINDOWS),
        on: lit ? rand(rng, 0.55, 1) : 0,
      });
    }
}

/** Water tank on a little stand, sitting on y. */
function tank(c: City, x: number, y: number, tw: number) {
  const th = tw * 1.05;
  const leg = th * 0.28;
  c.add(rectPoly(x - tw * 0.42, y - leg, x + tw * 0.42, y));
  const s = new Shape()
    .l(x - tw / 2, y - leg)
    .l(x - tw / 2, y - leg - th * 0.72)
    .q(x - tw / 2, y - leg - th * 0.95, x - tw * 0.18, y - leg - th * 0.97, 4)
    .l(x - tw * 0.14, y - leg - th * 1.08)
    .l(x + tw * 0.14, y - leg - th * 1.08)
    .l(x + tw * 0.18, y - leg - th * 0.97)
    .q(x + tw / 2, y - leg - th * 0.95, x + tw / 2, y - leg - th * 0.72, 4)
    .l(x + tw / 2, y - leg);
  c.add(s.p);
}

/** Flat-roofed town house with a slab lip, stair room, tank, antenna, lights. */
export function townHouse(rng: Rng, c: City, x: number, base: number, bw: number, floors: number, floorH: number, opts: { lights?: number; lamps?: number; pLit?: number } = {}) {
  const u = c.u;
  c.tone = rng();
  const bh = floors * floorH + floorH * 0.35;
  const top = base - bh;
  const lip = Math.max(u * 0.004, floorH * 0.09);
  const o = bw * 0.035;
  for (let f = 1; f < floors; f++) {
    const ly = top + lip * 1.5 + ((base - top - lip * 1.5) * f) / floors;
    c.ledges.push(x - o * 0.6, x + bw + o * 0.6, ly, Math.max(2.5, lip * 0.7));
  }
  c.add([x, base + 2, x, top + lip, x - o, top + lip, x - o, top, x + bw + o, top, x + bw + o, top + lip, x + bw, top + lip, x + bw, base + 2]);
  // roof parapet (low wall) on part of the roof
  const roll = rng();
  let roofY = top;
  if (roll < 0.45) {
    // stair room (mumty) at one end
    const mw = bw * rand(rng, 0.26, 0.4);
    const mh = floorH * rand(rng, 0.7, 0.95);
    const left = rng() < 0.5;
    const mx = left ? x + bw * 0.06 : x + bw * 0.94 - mw;
    c.add([mx, top, mx, top - mh + lip, mx - o * 0.6, top - mh + lip, mx - o * 0.6, top - mh, mx + mw + o * 0.6, top - mh, mx + mw + o * 0.6, top - mh + lip, mx + mw, top - mh + lip, mx + mw, top]);
    if (rng() < 0.7) tank(c, mx + mw / 2, top - mh, Math.min(mw * 0.55, u * 0.03));
    else if (rng() < 0.6) tank(c, left ? x + bw * 0.75 : x + bw * 0.25, top, Math.min(bw * 0.2, u * 0.028));
    roofY = top - mh;
  } else if (roll < 0.75) {
    tank(c, x + bw * rand(rng, 0.25, 0.75), top, Math.min(bw * 0.2, u * 0.03));
  } else {
    // low parapet wall with railing posts
    const ph = floorH * 0.28;
    c.add(rectPoly(x - o, top - ph, x + bw + o, top + 1));
    roofY = top - ph;
  }
  if (rng() < 0.3) {
    const ax = x + bw * rand(rng, 0.2, 0.8);
    const ah = u * rand(rng, 0.03, 0.05);
    c.stick(ax, top, ax, top - ah, Math.max(1, u * 0.0016));
    c.stick(ax - ah * 0.25, top - ah * 0.8, ax + ah * 0.25, top - ah * 0.8, Math.max(1, u * 0.0014));
  }
  const cols = Math.max(1, Math.round(bw / (floorH * 0.85)));
  windowsGrid(rng, c, x + bw * 0.04, x + bw * 0.96, top + lip * 1.5, base, floors, Math.min(cols, 5), false, opts.pLit ?? 0.5);
  // fairy lights
  if (rng() < (opts.lights ?? 0.5)) {
    const set = pick(rng, FAIRY_SETS);
    const r = u * 0.0028;
    if (rng() < 0.55) {
      // curtain of vertical strands hanging from the slab
      const cols2 = randInt(rng, 5, 9);
      const len = bh * rand(rng, 0.35, 0.9);
      for (let i = 0; i < cols2; i++) {
        const sx = x + bw * ((i + 0.5) / cols2);
        const L = len * rand(rng, 0.85, 1);
        c.strands.push({ pts: [sx, top + lip, sx, top + lip + L], colors: set, r });
      }
    } else {
      // swags along the slab
      const n = randInt(rng, 2, 3);
      for (let i = 0; i < n; i++) {
        const xa = x - o + ((bw + 2 * o) * i) / n;
        const xb = x - o + ((bw + 2 * o) * (i + 1)) / n;
        const pts: number[] = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          pts.push(lerp(xa, xb, t), top + lip + floorH * 0.35 * 4 * t * (1 - t));
        }
        c.strands.push({ pts, colors: set, r });
      }
    }
  }
  // rooftop diyas along the slab
  if (rng() < (opts.lamps ?? 0.5)) {
    const n = randInt(rng, 3, 7);
    for (let i = 0; i < n; i++) c.lamps.push(x + bw * ((i + 0.5) / n), (roll >= 0.75 ? roofY : top) - 0.5, u * 0.012);
  }
  return top;
}

/** Old haveli: crenellated parapet, arched windows, a rooftop chhatri. */
export function haveli(rng: Rng, c: City, x: number, base: number, bw: number, floors: number, floorH: number, opts: { lamps?: number; lights?: number } = {}) {
  const u = c.u;
  c.tone = rng();
  const bh = floors * floorH + floorH * 0.5;
  const top = base - bh;
  for (let f = 1; f < floors; f++) {
    const ly = top + floorH * 0.3 + ((base - top - floorH * 0.3) * f) / floors;
    c.ledges.push(x - bw * 0.025, x + bw * 1.025, ly, Math.max(2.5, floorH * 0.08));
  }
  const s = new Shape().l(x, base + 2).l(x, top + floorH * 0.12).l(x - bw * 0.03, top + floorH * 0.12).l(x - bw * 0.03, top);
  const merl = Math.max(4, Math.round(bw / (floorH * 0.32)));
  const mw = (bw * 1.06) / merl;
  for (let i = 0; i < merl; i++) {
    const mx = x - bw * 0.03 + mw * i;
    s.l(mx + mw * 0.15, top).arc(mx + mw * 0.5, top, mw * 0.35, mw * 0.5, Math.PI, TAU, 4).l(mx + mw, top);
  }
  s.l(x + bw * 1.03, top + floorH * 0.12).l(x + bw, top + floorH * 0.12).l(x + bw, base + 2);
  c.add(s.p);
  // chhatri on the roof
  if (rng() < 0.7) chhatri(c, x + bw * rand(rng, 0.3, 0.7), top - mw * 0.4, Math.min(bw * 0.32, u * 0.06), rng() < 0.5);
  // jharokha balcony: lit arched windows in bays
  windowsGrid(rng, c, x + bw * 0.05, x + bw * 0.95, top + floorH * 0.3, base, floors, Math.min(4, Math.max(2, Math.round(bw / floorH))), true, 0.6);
  if (rng() < (opts.lamps ?? 0.8)) {
    const n = Math.min(merl, 8);
    for (let i = 0; i < n; i++) c.lamps.push(x + bw * ((i + 0.5) / n), top - mw * 0.45, u * 0.011);
  }
  if (rng() < (opts.lights ?? 0.4)) {
    const set = pick(rng, FAIRY_SETS);
    const cols = randInt(rng, 6, 10);
    for (let i = 0; i < cols; i++) {
      const sx = x + bw * ((i + 0.5) / cols);
      c.strands.push({ pts: [sx, top + floorH * 0.15, sx, top + bh * rand(rng, 0.45, 0.6)], colors: set, r: u * 0.0028 });
    }
  }
  return top;
}

/** Small domed pavilion (chhatri). (x, y) = centre of its floor. */
export function chhatri(c: City, x: number, y: number, cw: number, outline = false, lightColor = '#ffd27a') {
  const ph = cw * 0.55;
  const pw = cw * 0.1;
  c.add(rectPoly(x - cw * 0.55, y - cw * 0.06, x + cw * 0.55, y + 1));
  c.add(rectPoly(x - cw * 0.45, y - ph, x - cw * 0.45 + pw, y));
  c.add(rectPoly(x + cw * 0.45 - pw, y - ph, x + cw * 0.45, y));
  c.add(rectPoly(x - cw * 0.6, y - ph - cw * 0.08, x + cw * 0.6, y - ph));
  const dy = y - ph - cw * 0.08;
  const dome = new Shape()
    .l(x - cw * 0.46, dy)
    .c(x - cw * 0.5, dy - cw * 0.35, x - cw * 0.15, dy - cw * 0.5, x, dy - cw * 0.6, 8)
    .c(x + cw * 0.15, dy - cw * 0.5, x + cw * 0.5, dy - cw * 0.35, x + cw * 0.46, dy, 8);
  c.add(dome.p);
  c.stick(x, dy - cw * 0.58, x, dy - cw * 0.82, Math.max(1, cw * 0.035));
  if (outline) c.outlines.push({ pts: dome.p, color: lightColor, r: c.u * 0.0026, step: c.u * 0.011 });
}

/** Nagara temple: hall with a stepped roof and a curvilinear shikhara with an amalaka, kalash and flag. */
export function shikharaTemple(rng: Rng, c: City, cx: number, base: number, tw: number, th: number, opts: { outline?: string; flip?: boolean } = {}) {
  const u = c.u;
  const f = opts.flip ? -1 : 1;
  const plinth = th * 0.07;
  c.add(rectPoly(cx - tw * 1.05, base - plinth, cx + tw * 0.75, base + 2).map((v, i) => (i % 2 === 0 ? cx + (v - cx) * f : v)));
  // mandapa (hall) with a pyramidal roof
  const hx0 = cx - f * tw * 1.0;
  const hx1 = cx - f * tw * 0.3;
  const hTop = base - plinth - th * 0.2;
  const hall = new Shape()
    .l(hx0, base - plinth)
    .l(hx0, hTop)
    .l(hx0 - f * tw * 0.06, hTop)
    .l(hx0 - f * tw * 0.06, hTop - th * 0.025);
  const tiers = 4;
  const hw = Math.abs(hx1 - hx0) + tw * 0.06;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const inset = hw * 0.5 * t * 0.85;
    const y0 = hTop - th * 0.025 - th * 0.055 * i;
    hall.l(hx0 - f * tw * 0.06 + f * inset, y0).l(hx0 - f * tw * 0.06 + f * (inset + hw * 0.06), y0 - th * 0.055);
  }
  const apexX = (hx0 + hx1) / 2 - f * tw * 0.03;
  hall.l(apexX - f * tw * 0.04, hTop - th * 0.025 - th * 0.055 * tiers).l(apexX, hTop - th * 0.27).l(apexX + f * tw * 0.04, hTop - th * 0.025 - th * 0.055 * tiers);
  hall.l(hx1 + f * tw * 0.1, hTop - th * 0.04).l(hx1 + f * tw * 0.1, base - plinth);
  c.add(hall.p);
  c.stick(apexX, hTop - th * 0.26, apexX, hTop - th * 0.33, Math.max(1, u * 0.002));
  // sub-spires (urushringa) either side of the main tower
  const spire = (sx: number, sb: number, sw: number, sh: number) => {
    const s = new Shape()
      .l(sx - sw / 2, sb)
      .l(sx - sw / 2, sb - sh * 0.18)
      .c(sx - sw * 0.53, sb - sh * 0.6, sx - sw * 0.34, sb - sh * 0.86, sx - sw * 0.17, sb - sh * 0.93, 10)
      .arc(sx, sb - sh * 0.935, sw * 0.24, sh * 0.035, Math.PI, TAU, 6)
      .l(sx + sw * 0.17, sb - sh * 0.93)
      .c(sx + sw * 0.34, sb - sh * 0.86, sx + sw * 0.53, sb - sh * 0.6, sx + sw / 2, sb - sh * 0.18, 10)
      .l(sx + sw / 2, sb);
    c.add(s.p);
    // kalash
    c.add(new Shape().arc(sx, sb - sh * 0.985, sw * 0.07, sh * 0.03, 0, TAU, 8).p);
    c.stick(sx, sb - sh * 0.99, sx, sb - sh * 1.04, Math.max(1, u * 0.0018));
    return s.p;
  };
  const tb = base - plinth;
  spire(cx - tw * 0.36, tb, tw * 0.55, th * 0.6);
  spire(cx + tw * 0.36, tb, tw * 0.55, th * 0.6);
  spire(cx - tw * 0.2, tb, tw * 0.62, th * 0.78);
  spire(cx + tw * 0.2, tb, tw * 0.62, th * 0.78);
  const main = spire(cx, tb, tw, th - plinth);
  // flag on the main finial
  const fy = tb - (th - plinth) * 1.04;
  const pole = th * 0.12;
  c.stick(cx, fy, cx, fy - pole, Math.max(1.2, u * 0.0022));
  const fl = th * 0.13;
  const flag = new Shape()
    .l(cx, fy - pole)
    .q(cx + fl * 0.5, fy - pole - fl * 0.08, cx + fl, fy - pole + fl * 0.12, 5)
    .q(cx + fl * 0.5, fy - pole + fl * 0.22, cx, fy - pole + fl * 0.32, 5);
  c.flags.push(flag.p);
  c.env?.add(flag.p);
  // doorway glow
  c.wins.push({ x: cx - tw * 0.11, y: tb - th * 0.16, w: tw * 0.22, h: th * 0.15, arch: true, c: '#ffb347', on: 1 });
  if (opts.outline) {
    const half = Math.floor(main.length / 4) * 2;
    c.outlines.push({ pts: main.slice(2, half + 4), color: opts.outline, r: u * 0.0032, step: u * 0.012 });
    c.outlines.push({ pts: main.slice(half - 4, main.length - 2), color: opts.outline, r: u * 0.0032, step: u * 0.012 });
    c.outlines.push({ pts: hall.p.slice(4, hall.p.length - 4), color: opts.outline, r: u * 0.0028, step: u * 0.012 });
  }
  return main;
}

/** Domed palace pavilion: arcaded block, drum and onion dome with corner chhatris. */
export function domeHall(c: City, cx: number, base: number, dw: number, dh: number, opts: { outline?: string } = {}) {
  const u = c.u;
  const bh = dh * 0.36;
  const top = base - bh;
  c.add(rectPoly(cx - dw / 2, top, cx + dw / 2, base + 2));
  c.add(rectPoly(cx - dw * 0.53, top - dh * 0.03, cx + dw * 0.53, top + dh * 0.01));
  const drumW = dw * 0.36;
  const drumTop = top - dh * 0.1;
  c.add(rectPoly(cx - drumW, drumTop, cx + drumW, top));
  const dome = new Shape()
    .l(cx - drumW * 0.95, drumTop)
    .c(cx - drumW * 1.32, drumTop - dh * 0.2, cx - drumW * 0.75, drumTop - dh * 0.42, cx - drumW * 0.12, drumTop - dh * 0.5, 12)
    .q(cx, drumTop - dh * 0.52, cx, drumTop - dh * 0.56, 3)
    .q(cx, drumTop - dh * 0.52, cx + drumW * 0.12, drumTop - dh * 0.5, 3)
    .c(cx + drumW * 0.75, drumTop - dh * 0.42, cx + drumW * 1.32, drumTop - dh * 0.2, cx + drumW * 0.95, drumTop, 12);
  c.add(dome.p);
  c.stick(cx, drumTop - dh * 0.55, cx, drumTop - dh * 0.64, Math.max(1.2, u * 0.0022));
  c.add(new Shape().arc(cx, drumTop - dh * 0.6, dw * 0.018, dw * 0.018, 0, TAU, 8).p);
  chhatri(c, cx - dw * 0.42, top - dh * 0.03, dw * 0.16, !!opts.outline, opts.outline);
  chhatri(c, cx + dw * 0.42, top - dh * 0.03, dw * 0.16, !!opts.outline, opts.outline);
  // arcade of lit arches
  const n = 5;
  for (let i = 0; i < n; i++) {
    const ax = cx - dw / 2 + (dw * (i + 0.5)) / n;
    c.wins.push({ x: ax - dw * 0.045, y: top + bh * 0.25, w: dw * 0.09, h: bh * 0.6, arch: true, c: '#ffbf5a', on: i === 2 ? 1 : 0.75 });
  }
  if (opts.outline) {
    c.outlines.push({ pts: dome.p, color: opts.outline, r: u * 0.003, step: u * 0.012 });
    c.outlines.push({ pts: [cx - dw * 0.53, top - dh * 0.03, cx + dw * 0.53, top - dh * 0.03], color: opts.outline, r: u * 0.0026, step: u * 0.012 });
  }
  return dome.p;
}

/** Neem / peepal tree silhouette: a trunk and three lobed, leafy crowns. */
export function tree(rng: Rng, c: City, x: number, base: number, th: number) {
  c.tone = rng();
  const tw = th * 0.035;
  c.add(new Shape().l(x - tw * 1.4, base + 2).q(x - tw * 0.6, base - th * 0.3, x - tw * 1.8, base - th * 0.52).l(x + tw * 1.6, base - th * 0.5).q(x + tw * 0.6, base - th * 0.3, x + tw * 1.4, base + 2).p);
  for (let L = 0; L < 3; L++) {
    const cx = x + (L - 1) * th * 0.24 + rand(rng, -0.04, 0.04) * th;
    const cy = base - th * (L === 1 ? 0.72 : 0.56) + rand(rng, -0.03, 0.03) * th;
    const R = th * (L === 1 ? 0.3 : 0.21);
    const p1 = rand(rng, 0, TAU);
    const p2 = rand(rng, 0, TAU);
    const p3 = rand(rng, 0, TAU);
    const sh = new Shape();
    for (let j = 0; j < 40; j++) {
      const a = (j / 40) * TAU;
      const r = R * (1 + 0.1 * Math.sin(5 * a + p1) + 0.07 * Math.sin(9 * a + p2) + 0.05 * Math.sin(17 * a + p3));
      sh.l(cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * (Math.sin(a) > 0 ? 0.62 : 0.85));
    }
    c.add(sh.p);
  }
}

/** Coconut palm silhouette. */
export function palmTree(rng: Rng, c: City, x: number, base: number, th: number) {
  c.tone = rng();
  const lean = rand(rng, -0.18, 0.18) * th;
  const tx = x + lean;
  const ty = base - th;
  const tw = th * 0.022;
  const trunk = new Shape().l(x - tw * 1.3, base + 2).q(x + lean * 0.2 - tw, base - th * 0.5, tx - tw * 0.7, ty).l(tx + tw * 0.7, ty).q(x + lean * 0.2 + tw, base - th * 0.5, x + tw * 1.3, base + 2);
  c.add(trunk.p);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rand(rng, -0.25, 0.25);
    const L = th * rand(rng, 0.32, 0.45);
    const ex = tx + Math.cos(a) * L;
    const ey = ty + Math.sin(a) * L * 0.45 + L * 0.35;
    const mx = (tx + ex) / 2;
    const my = Math.min(ty, ey) - L * 0.22;
    const nx = -(ey - ty) / L;
    const ny = (ex - tx) / L;
    const wdt = L * 0.09;
    c.add(new Shape().l(tx, ty).q(mx + nx * wdt, my + ny * wdt, ex, ey, 6).q(mx - nx * wdt, my - ny * wdt, tx, ty, 6).p);
  }
}

/** Fills all silhouettes of a city with one style. */
export function paintCity(g: Ctx, c: City, fill: string | CanvasGradient, tones?: readonly string[]) {
  g.fillStyle = fill;
  c.polys.forEach((p, i) => {
    if (tones) g.fillStyle = tones[Math.min(tones.length - 1, Math.floor(c.tones[i] * tones.length))];
    g.beginPath();
    trace(g, p);
    g.fill();
  });
  g.fillStyle = fill;
  if (c.sticks.length) {
    g.strokeStyle = fill;
    g.lineCap = 'round';
    for (let i = 0; i < c.sticks.length; i += 5) {
      g.lineWidth = c.sticks[i + 4];
      g.beginPath();
      g.moveTo(c.sticks[i], c.sticks[i + 1]);
      g.lineTo(c.sticks[i + 2], c.sticks[i + 3]);
      g.stroke();
    }
  }
}

/**
 * Paints a city's silhouettes on their own layer (each building in one of
 * `tones`), lets `shade` light it with 'source-atop' fills, then composites it.
 */
export function cityLayer(g: Ctx, w: number, h: number, c: City, tones: readonly string[], shade: (lg: Ctx) => void) {
  const L = makeCanvas(w, h);
  const lg = ctx2d(L);
  paintCity(lg, c, tones[0], tones);
  lg.globalCompositeOperation = 'source-atop';
  shade(lg);
  g.drawImage(L as CanvasImageSource, 0, 0);
}

/** Saffron temple flags. */
export function flagsBase(g: Ctx, c: City) {
  for (const f of c.flags) {
    g.beginPath();
    trace(g, f);
    const grd = g.createLinearGradient(f[0], f[1], f[f.length - 2], f[f.length - 1]);
    grd.addColorStop(0, '#ff8a1a');
    grd.addColorStop(1, '#c2400a');
    g.fillStyle = grd;
    g.fill();
  }
}

/** Floor ledges catching warm light from below / the sky (base pass). */
export function ledgesBase(g: Ctx, c: City, lit: string, shade: string) {
  for (let i = 0; i < c.ledges.length; i += 4) {
    const [x0, x1, y, t] = [c.ledges[i], c.ledges[i + 1], c.ledges[i + 2], c.ledges[i + 3]];
    g.fillStyle = shade;
    g.fillRect(x0, y + t, x1 - x0, t * 1.6);
    g.fillStyle = lit;
    g.fillRect(x0, y, x1 - x0, t);
  }
}

export function winPath(g: Ctx, wn: Win, grow = 0) {
  const x = wn.x - grow;
  const y = wn.y - grow;
  const w = wn.w + grow * 2;
  const h = wn.h + grow * 2;
  g.beginPath();
  if (wn.arch) {
    g.moveTo(x, y + h);
    g.lineTo(x, y + w * 0.5);
    g.quadraticCurveTo(x, y, x + w / 2, y);
    g.quadraticCurveTo(x + w, y, x + w, y + w * 0.5);
    g.lineTo(x + w, y + h);
    g.closePath();
  } else g.rect(x, y, w, h);
}

/** Windows painted into the base (dim; the lights pass makes them glow). */
export function windowsBase(g: Ctx, c: City, dim = 0.55, dark = 'rgba(8,4,16,0.55)') {
  for (const wn of c.wins) {
    winPath(g, wn);
    if (wn.on > 0) {
      const grd = g.createLinearGradient(0, wn.y, 0, wn.y + wn.h);
      grd.addColorStop(0, rgba(mix(wn.c, '#7a3010', 0.35), dim * wn.on));
      grd.addColorStop(1, rgba(wn.c, dim * wn.on));
      g.fillStyle = grd;
    } else g.fillStyle = dark;
    g.fill();
  }
}

/** Crisp lit windows with a soft spill (lights pass). */
export function windowsLights(g: Ctx, c: City, k = 1) {
  withBlend(g, 'lighter', () => {
    for (const wn of c.wins) {
      if (wn.on <= 0) continue;
      winPath(g, wn, -Math.min(wn.w, wn.h) * 0.08);
      const grd = g.createLinearGradient(0, wn.y, 0, wn.y + wn.h);
      grd.addColorStop(0, rgba(wn.c, 0.35 * wn.on * k));
      grd.addColorStop(1, rgba(mix(wn.c, '#fff4d6', 0.4), 0.75 * wn.on * k));
      g.fillStyle = grd;
      g.fill();
    }
    for (const wn of c.wins) {
      if (wn.on <= 0) continue;
      g.globalAlpha = 0.22 * wn.on * k;
      dot(g, lightSprite(wn.c, wn.c), wn.x + wn.w / 2, wn.y + wn.h * 0.6, Math.max(wn.w, wn.h) * 1.6);
    }
  });
}

/** Fairy-light strands, outline bulbs and rooftop lamps (lights pass). */
export function cityLights(g: Ctx, rng: Rng, c: City, k = 1) {
  withBlend(g, 'lighter', () => {
    for (const s of c.strands) {
      const len = Math.hypot(s.pts[s.pts.length - 2] - s.pts[0], s.pts[s.pts.length - 1] - s.pts[1]);
      const n = Math.max(2, Math.min(30, Math.round(len / (s.r * 4.2))));
      const segs = s.pts.length / 2 - 1;
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1)) * segs;
        const j = Math.min(segs - 1, Math.floor(t));
        const f = t - j;
        const x = lerp(s.pts[j * 2], s.pts[j * 2 + 2], f);
        const y = lerp(s.pts[j * 2 + 1], s.pts[j * 2 + 3], f);
        g.globalAlpha = clamp01(k * (0.65 + 0.35 * ((i * 7919) % 13) / 13));
        dot(g, lightSprite(s.colors[i % s.colors.length]), x, y, s.r * 3.2);
      }
    }
    for (const o of c.outlines) {
      const spr = lightSprite(o.color);
      let carry = 0;
      for (let i = 2; i < o.pts.length; i += 2) {
        const x0 = o.pts[i - 2];
        const y0 = o.pts[i - 1];
        const seg = Math.hypot(o.pts[i] - x0, o.pts[i + 1] - y0);
        let d = o.step - carry;
        while (d <= seg) {
          const t = d / seg;
          g.globalAlpha = clamp01(k * 0.95);
          dot(g, spr, lerp(x0, o.pts[i], t), lerp(y0, o.pts[i + 1], t), o.r * 3.4);
          d += o.step;
        }
        carry = seg - (d - o.step);
      }
    }
  });
  for (let i = 0; i < c.lamps.length; i += 3) tinyFlame(g, c.lamps[i] + rand(rng, -0.5, 0.5), c.lamps[i + 1], c.lamps[i + 2], k * rand(rng, 0.75, 1));
}

/** Soft wires for the fairy-light strands (base pass). */
export function strandWires(g: Ctx, c: City, color = 'rgba(20,10,20,0.6)') {
  g.strokeStyle = color;
  g.lineWidth = Math.max(1, c.u * 0.0014);
  for (const s of c.strands) {
    g.beginPath();
    trace(g, s.pts, false);
    g.stroke();
  }
}

/** Glows of strands and outlines painted into the base so the painting carries their colour. */
export function cityGlowBase(g: Ctx, c: City, k = 1) {
  for (const s of c.strands) {
    const n = s.pts.length;
    const mx = (s.pts[0] + s.pts[n - 2]) / 2;
    const my = (s.pts[1] + s.pts[n - 1]) / 2;
    const L = Math.hypot(s.pts[n - 2] - s.pts[0], s.pts[n - 1] - s.pts[1]);
    glow(g, mx, my, L * 0.7 + s.r * 10, s.colors[0], 0.1 * k);
  }
  for (const o of c.outlines) {
    for (let i = 0; i + 1 < o.pts.length; i += 8) glow(g, o.pts[i], o.pts[i + 1], o.r * 9, o.color, 0.12 * k);
  }
  for (let i = 0; i < c.lamps.length; i += 3) glow(g, c.lamps[i], c.lamps[i + 1] - c.lamps[i + 2] * 0.4, c.lamps[i + 2] * 2.5, '#ffa040', 0.2 * k);
}

// ------------------------------------------------------------------ ground crackers
/** Clay anar pot (pomegranate shaped) standing on (x, y), `s` tall. Returns the nozzle. */
export function anarPot(g: Ctx, x: number, y: number, s: number, label = '#c21f3a') {
  wash(g, x, y, s * 0.9, s * 0.16, '#000000', 0.55);
  const body = () => {
    g.beginPath();
    g.moveTo(x - s * 0.1, y - s * 0.84);
    g.bezierCurveTo(x - s * 0.12, y - s * 0.74, x - s * 0.5, y - s * 0.72, x - s * 0.49, y - s * 0.4);
    g.bezierCurveTo(x - s * 0.47, y - s * 0.08, x - s * 0.22, y, x, y);
    g.bezierCurveTo(x + s * 0.22, y, x + s * 0.47, y - s * 0.08, x + s * 0.49, y - s * 0.4);
    g.bezierCurveTo(x + s * 0.5, y - s * 0.72, x + s * 0.12, y - s * 0.74, x + s * 0.1, y - s * 0.84);
    g.closePath();
  };
  body();
  const grd = g.createRadialGradient(x - s * 0.12, y - s * 0.62, s * 0.04, x, y - s * 0.4, s * 0.6);
  grd.addColorStop(0, '#ffb26a');
  grd.addColorStop(0.35, '#c9622a');
  grd.addColorStop(0.75, '#7a2e10');
  grd.addColorStop(1, '#2a0c04');
  g.fillStyle = grd;
  g.fill();
  withState(g, () => {
    body();
    g.clip();
    // paper label band with a gold stripe
    g.fillStyle = rgba(label, 0.85);
    g.fillRect(x - s, y - s * 0.46, s * 2, s * 0.2);
    g.fillStyle = rgba('#ffd45a', 0.85);
    g.fillRect(x - s, y - s * 0.46, s * 2, s * 0.035);
    g.fillRect(x - s, y - s * 0.295, s * 2, s * 0.035);
    // shading over the band
    const sh = g.createLinearGradient(x - s * 0.5, 0, x + s * 0.5, 0);
    sh.addColorStop(0, 'rgba(20,4,0,0.6)');
    sh.addColorStop(0.4, 'rgba(20,4,0,0)');
    sh.addColorStop(1, 'rgba(20,4,0,0.65)');
    g.fillStyle = sh;
    g.fillRect(x - s, y - s, s * 2, s);
  });
  // lip
  g.beginPath();
  g.ellipse(x, y - s * 0.84, s * 0.13, s * 0.035, 0, 0, TAU);
  g.fillStyle = '#3a1406';
  g.fill();
  // top lit by the fountain
  glow(g, x, y - s * 0.8, s * 0.5, '#ffb347', 0.5);
  return { x, y: y - s * 0.86 };
}

/** The golden spray of an anar fountain rising `H` px from (x, y) (lights pass). */
export function anarSpray(g: Ctx, rng: Rng, x: number, y: number, H: number, floorY: number, n = 300, spread = 0.2) {
  glow(g, x, y - H * 0.4, H * 0.75, '#ff8a2a', 0.22);
  glow(g, x, y - H * 0.18, H * 0.32, '#ffc060', 0.35);
  const S = 2 * H;
  const G = 2 * H;
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    // hot core jet
    for (let i = 0; i < 14; i++) {
      const ang = -Math.PI / 2 + gauss(rng) * spread * 0.35;
      const L = H * rand(rng, 0.25, 0.7);
      const grd = g.createLinearGradient(x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L);
      grd.addColorStop(0, 'rgba(255,255,240,0.9)');
      grd.addColorStop(0.5, 'rgba(255,220,140,0.35)');
      grd.addColorStop(1, 'rgba(255,170,60,0)');
      g.strokeStyle = grd;
      g.lineWidth = Math.max(1, H * rand(rng, 0.006, 0.014));
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L);
      g.stroke();
    }
    const lw = Math.max(0.7, H * 0.0032);
    const spark = lightSprite('#ffc860', '#ffffff');
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + gauss(rng) * spread;
      const v = Math.sqrt(rand(rng, 0.4, 1.02));
      const vx = Math.cos(ang) * v * S;
      const vy = Math.sin(ang) * v * S;
      const tEnd = (-vy + Math.sqrt(vy * vy + 2 * G * Math.max(1, floorY - y))) / G;
      const t = tEnd * Math.pow(rng(), 1.15);
      const dt = rand(rng, 0.025, 0.08);
      const ta = Math.max(0, t - dt);
      const age = t / tEnd;
      const px = (tt: number) => x + vx * tt;
      const py = (tt: number) => y + vy * tt + 0.5 * G * tt * tt;
      const col = age < 0.22 ? '#fff6dc' : age < 0.55 ? (rng() < 0.6 ? '#ffd27a' : '#fff0c0') : rng() < 0.6 ? '#ffb04a' : '#ff8a3a';
      const a = (1 - age * 0.7) * rand(rng, 0.4, 1);
      g.strokeStyle = rgba(col, a);
      g.lineWidth = lw * (age < 0.3 ? 1.3 : 1);
      g.beginPath();
      g.moveTo(px(ta), py(ta));
      g.quadraticCurveTo(px((ta + t) / 2), py((ta + t) / 2), px(t), py(t));
      g.stroke();
      if (rng() < 0.22) {
        g.globalAlpha = a;
        dot(g, spark, px(t), py(t), lw * rand(rng, 2.5, 4.5));
        g.globalAlpha = 1;
      }
    }
  });
  glow(g, x, y, H * 0.08, '#ffffff', 0.9);
}

/** Chakri (ground spinner) whirling on the floor at (x, y), radius R (lights pass). */
export function chakriSpin(g: Ctx, rng: Rng, x: number, y: number, R: number, tilt = 0.36, colors: readonly string[] = ['#ffd27a', '#ff9a3c', '#fff2c8']) {
  glow(g, x, y, R * 5, colors[1], 0.2);
  glow(g, x, y, R * 1.8, colors[0], 0.35);
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    // motion-blurred rings
    for (let i = 0; i < 34; i++) {
      const rr = R * rand(rng, 0.3, 1.05);
      const a0 = rand(rng, 0, TAU);
      g.strokeStyle = rgba(pick(rng, colors), rand(rng, 0.15, 0.55));
      g.lineWidth = Math.max(0.8, R * rand(rng, 0.02, 0.06));
      g.beginPath();
      g.ellipse(x, y, rr, rr * tilt, 0, a0, a0 + rand(rng, 0.8, 2.6));
      g.stroke();
    }
    // sparks flung off tangentially
    const lw = Math.max(0.8, R * 0.025);
    for (let i = 0; i < 130; i++) {
      const a = rand(rng, 0, TAU);
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const L = R * (0.4 + 2.6 * Math.pow(rng(), 1.6));
      const dx = -uy * 0.85 + ux * 0.5;
      const dy = ux * 0.85 + uy * 0.5;
      const sx = x + ux * R * 0.95;
      const sy = y + uy * R * 0.95 * tilt;
      const lift = rand(rng, 0, 0.5) * L;
      const ex = sx + dx * L;
      const ey = sy + dy * L * tilt - lift * 0.3;
      const grd = g.createLinearGradient(sx, sy, ex, ey);
      const c = pick(rng, colors);
      grd.addColorStop(0, rgba('#ffffff', 0.85));
      grd.addColorStop(0.3, rgba(c, 0.6));
      grd.addColorStop(1, rgba(c, 0));
      g.strokeStyle = grd;
      g.lineWidth = lw * rand(rng, 0.6, 1.2);
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + dx * L * 0.5, sy + dy * L * 0.5 * tilt - lift * 0.25, ex, ey);
      g.stroke();
    }
  });
  glow(g, x, y, R * 0.6, '#ffffff', 0.85);
}

/** Burning phuljhadi tip at (x, y): branching white-gold sparks (lights pass). */
export function sparklerBurn(g: Ctx, rng: Rng, x: number, y: number, r: number, n = 70) {
  glow(g, x, y, r * 2.6, '#ffb860', 0.28);
  glow(g, x, y, r * 0.8, '#fff0c8', 0.5);
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const lw = Math.max(0.7, r * 0.014);
    for (let i = 0; i < n; i++) {
      const a = rand(rng, 0, TAU);
      const L = r * (0.25 + 0.75 * Math.pow(rng(), 0.7));
      const bx = x + Math.cos(a) * L * 0.6;
      const by = y + Math.sin(a) * L * 0.6;
      g.strokeStyle = rgba(rng() < 0.6 ? '#fff6dc' : '#ffd27a', rand(rng, 0.45, 0.95));
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(bx, by);
      const fan = randInt(rng, 2, 3);
      for (let k = 0; k < fan; k++) {
        const b = a + rand(rng, -0.7, 0.7);
        const l2 = L * rand(rng, 0.25, 0.45);
        g.moveTo(bx, by);
        g.lineTo(bx + Math.cos(b) * l2, by + Math.sin(b) * l2);
      }
      g.stroke();
    }
    const sp = lightSprite('#ffd27a', '#ffffff');
    for (let i = 0; i < 24; i++) {
      const a = rand(rng, 0, TAU);
      const L = r * rand(rng, 0.5, 1.3);
      g.globalAlpha = rand(rng, 0.4, 1);
      dot(g, sp, x + Math.cos(a) * L, y + Math.sin(a) * L, lw * rand(rng, 1.5, 3));
    }
  });
  glow(g, x, y, r * 0.22, '#ffffff', 1);
}
