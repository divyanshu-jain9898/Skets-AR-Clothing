/**
 * Procedural Indian textile textures, drawn with the Canvas 2D API.
 *
 * Every generator returns a pair of canvases:
 *  - `color`: albedo (sRGB)
 *  - `orm`:   R = 255, G = roughness, B = metalness (three.js reads G for
 *             roughnessMap and B for metalnessMap)
 *
 * Each design is written once against a tiny "Painter" abstraction and run
 * twice with the same seeded RNG: once with real colours and once with ORM
 * "inks", so zari (metallic thread), silk embroidery, mirror work and dyed
 * fabric get physically different surface responses that line up exactly
 * with the colour artwork.
 *
 * All square patterns tile seamlessly; borders tile horizontally.
 */

export type PatternId =
  | 'plain'
  | 'paisley'
  | 'booti'
  | 'bandhani'
  | 'leheriya'
  | 'ikat'
  | 'brocade'
  | 'chikankari'
  | 'block'
  | 'checks'
  | 'jaal'
  | 'stripes'
  | 'kali';
export type BorderId = 'none' | 'temple' | 'vine' | 'gota' | 'mirror' | 'simple' | 'kasavu';
export type WeaveKind = 'plain' | 'twill' | 'satin' | 'velvet';

export interface PatternColors {
  base: string;
  accent: string;
  border: string;
  zari: string;
}

export interface TexturePair {
  color: HTMLCanvasElement;
  orm: HTMLCanvasElement;
}

export const PATTERN_LABELS: Record<PatternId, string> = {
  plain: 'Plain Weave',
  paisley: 'Paisley (Buta)',
  booti: 'Floral Booti',
  bandhani: 'Bandhani',
  leheriya: 'Leheriya',
  ikat: 'Ikat',
  brocade: 'Banarasi Brocade',
  chikankari: 'Chikankari',
  block: 'Block Print',
  checks: 'Madras Checks',
  jaal: 'Zari Jaal',
  stripes: 'Pinstripe',
  kali: 'Kalidar Panels',
};

export const BORDER_LABELS: Record<BorderId, string> = {
  none: 'No Border',
  temple: 'Temple (Kanjeevaram)',
  vine: 'Floral Vine',
  gota: 'Gota Patti',
  mirror: 'Mirror Work',
  simple: 'Zari Lines',
  kasavu: 'Kasavu Gold',
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;
type RGB = [number, number, number];
type Rand = () => number;

function parseColor(input: string): RGB {
  let s = (input || '').trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3 || s.length === 4) s = s.slice(0, 3).split('').map((ch) => ch + ch).join('');
  if (s.length === 8) s = s.slice(0, 6);
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(([^)]+)\)/i.exec(input || '');
  if (m) {
    const parts = m[1].split(',').map((v) => parseFloat(v));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  return [128, 128, 128];
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
const css = (c: RGB, a = 1) =>
  a >= 1
    ? `rgb(${Math.round(clamp255(c[0]))},${Math.round(clamp255(c[1]))},${Math.round(clamp255(c[2]))})`
    : `rgba(${Math.round(clamp255(c[0]))},${Math.round(clamp255(c[1]))},${Math.round(clamp255(c[2]))},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];
const lum = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

function rng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stateless hash -> [0,1). Used for per-motif randomness that must be identical in wrapped copies. */
function hash01(n: number): number {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return [c, ctx];
}

/** Calls fn for every copy of a motif (centre x,y, half extents rx/ry) that touches the tile. */
function wrap(W: number, H: number, x: number, y: number, rx: number, ry: number, fn: (X: number, Y: number) => void, wrapY = true) {
  for (let ox = -1; ox <= 1; ox++) {
    const X = x + ox * W;
    if (X + rx < 0 || X - rx > W) continue;
    for (let oy = -1; oy <= 1; oy++) {
      if (!wrapY && oy !== 0) continue;
      const Y = y + oy * H;
      if (Y + ry < 0 || Y - ry > H) continue;
      fn(X, Y);
    }
  }
}

// ---------------------------------------------------------------------------
// Inks: semantic colours with matching ORM (roughness/metal) values
// ---------------------------------------------------------------------------

interface Inks {
  base: string;
  baseLight: string;
  baseDark: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  accentMid: string;
  border: string;
  borderLight: string;
  borderDark: string;
  zari: string;
  zariLight: string;
  zariDark: string;
  thread: string;
  threadShadow: string;
  mirror: string;
  gota: string;
}
type Ink = keyof Inks;
type OrmInk = Ink | 'silk' | 'dye';

const DYE = 'rgb(255,235,0)';
const DYED_SILK = 'rgb(255,226,0)';
const ZARI = 'rgb(255,96,242)';
const ORM_INK: Record<OrmInk, string> = {
  base: DYE,
  baseLight: DYE,
  baseDark: DYE,
  accent: DYED_SILK,
  accentLight: DYED_SILK,
  accentDark: DYED_SILK,
  accentMid: DYED_SILK,
  border: DYED_SILK,
  borderLight: DYED_SILK,
  borderDark: DYED_SILK,
  zari: ZARI,
  zariLight: 'rgb(255,82,250)',
  zariDark: 'rgb(255,122,206)',
  thread: 'rgb(255,150,0)',
  threadShadow: 'rgb(255,205,0)',
  mirror: 'rgb(255,30,255)',
  gota: 'rgb(255,64,255)',
  silk: 'rgb(255,165,0)',
  dye: DYE,
};

interface Palette {
  inks: Inks;
  rgb: { base: RGB; accent: RGB; border: RGB; zari: RGB };
}

function makePalette(c: PatternColors): Palette {
  const base = parseColor(c.base);
  const accent = parseColor(c.accent);
  const border = parseColor(c.border);
  const zari = parseColor(c.zari);
  const light = lum(base) > 0.72;
  return {
    rgb: { base, accent, border, zari },
    inks: {
      base: css(base),
      baseLight: css(mix(base, WHITE, light ? 0.5 : 0.16)),
      baseDark: css(mix(base, BLACK, 0.2)),
      accent: css(accent),
      accentLight: css(mix(accent, WHITE, 0.38)),
      accentDark: css(mix(accent, BLACK, 0.38)),
      accentMid: css(mix(accent, base, 0.5)),
      border: css(border),
      borderLight: css(mix(border, WHITE, 0.3)),
      borderDark: css(mix(border, BLACK, 0.38)),
      zari: css(zari),
      zariLight: css(mix(zari, WHITE, 0.45)),
      zariDark: css(mix(zari, BLACK, 0.42)),
      thread: light ? 'rgb(255,255,255)' : css(mix(base, WHITE, 0.6)),
      threadShadow: css(mix(base, BLACK, light ? 0.16 : 0.3)),
      mirror: 'rgb(226,231,238)',
      gota: css(mix(zari, WHITE, 0.12)),
    },
  };
}

class Painter {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly orm: boolean,
    readonly pal: Palette,
  ) {}

  style(ink: Ink, ormInk?: OrmInk): string {
    return this.orm ? ORM_INK[ormInk ?? ink] : this.pal.inks[ink];
  }

  rect(x: number, y: number, w: number, h: number, ink: Ink, ormInk?: OrmInk) {
    this.ctx.fillStyle = this.style(ink, ormInk);
    this.ctx.fillRect(x, y, w, h);
  }

  circle(x: number, y: number, r: number, ink: Ink, ormInk?: OrmInk) {
    const c = this.ctx;
    c.fillStyle = this.style(ink, ormInk);
    c.beginPath();
    c.arc(x, y, Math.max(0, r), 0, TAU);
    c.fill();
  }

  ellipse(x: number, y: number, rx: number, ry: number, rot: number, ink: Ink, ormInk?: OrmInk) {
    const c = this.ctx;
    c.fillStyle = this.style(ink, ormInk);
    c.beginPath();
    c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
    c.fill();
  }

  fill(path: Path2D, ink: Ink, ormInk?: OrmInk) {
    this.ctx.fillStyle = this.style(ink, ormInk);
    this.ctx.fill(path);
  }

  stroke(path: Path2D, ink: Ink, width: number, ormInk?: OrmInk) {
    const c = this.ctx;
    c.strokeStyle = this.style(ink, ormInk);
    c.lineWidth = width;
    c.stroke(path);
  }

  alpha(a: number) {
    this.ctx.globalAlpha = a;
  }
}

// --- shared scratch layer used to give zari its woven metallic look ---------
let layerCanvas: HTMLCanvasElement | null = null;

function getLayer(w: number, h: number): CanvasRenderingContext2D {
  if (!layerCanvas) layerCanvas = document.createElement('canvas');
  if (layerCanvas.width !== w || layerCanvas.height !== h) {
    layerCanvas.width = w;
    layerCanvas.height = h;
  }
  const ctx = layerCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

/**
 * Draws zari (metallic thread) artwork. In the colour pass the shapes are
 * rendered on a scratch layer and overlaid with fine weft hatching and
 * highlights so they read as woven gold/silver; in the ORM pass they are
 * drawn directly with the metallic ink. Must not be nested.
 */
function zariLayer(p: Painter, w: number, h: number, draw: (q: Painter) => void, hatch = 1) {
  if (p.orm) {
    draw(p);
    return;
  }
  const lctx = getLayer(w, h);
  draw(new Painter(lctx, false, p.pal));
  if (hatch > 0) {
    const k = Math.max(w, h) / 512;
    const step = Math.max(2, Math.round(3 * k));
    lctx.globalCompositeOperation = 'source-atop';
    lctx.globalAlpha = 0.25 * hatch;
    lctx.fillStyle = p.pal.inks.zariDark;
    for (let y = 0; y < h; y += step) lctx.fillRect(0, y, w, Math.max(1, step / 3));
    lctx.globalAlpha = 0.24 * hatch;
    lctx.fillStyle = p.pal.inks.zariLight;
    for (let y = Math.round(step / 2); y < h; y += step * 2) lctx.fillRect(0, y, w, Math.max(1, k * 0.8));
    lctx.globalAlpha = 1;
    lctx.globalCompositeOperation = 'source-over';
  }
  p.ctx.drawImage(layerCanvas as HTMLCanvasElement, 0, 0);
}

// --- yarn noise -------------------------------------------------------------
const noiseCache = new Map<string, HTMLCanvasElement>();

/** Tileable grain: per-pixel noise + periodic slub/warp variations (seamless for any size). */
function noiseCanvas(w: number, h: number, seed: number): HTMLCanvasElement {
  const key = `${w}x${h}:${seed}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const [c, ctx] = makeCanvas(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const r = rng(seed ^ 0x51ed270b);
  const row = new Float32Array(h);
  const col = new Float32Array(w);
  for (let k = 0; k < 7; k++) {
    const fy = 3 + Math.floor(r() * 26);
    const fx = 2 + Math.floor(r() * 14);
    const ay = (r() * 14) / (1 + k * 0.4);
    const ax = (r() * 7) / (1 + k * 0.4);
    const py = r() * TAU;
    const px = r() * TAU;
    for (let y = 0; y < h; y++) row[y] += ay * Math.sin((TAU * fy * y) / h + py);
    for (let x = 0; x < w; x++) col[x] += ax * Math.sin((TAU * fx * x) / w + px);
  }
  let i = 0;
  for (let y = 0; y < h; y++) {
    const ry = row[y];
    for (let x = 0; x < w; x++) {
      const v = 128 + ry + col[x] + (r() - 0.5) * 70;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
      i += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  if (noiseCache.size >= 8) noiseCache.clear();
  noiseCache.set(key, c);
  return c;
}

function yarnOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, strength: number) {
  if (strength <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = strength;
  // only 4 distinct grain fields per size keeps the cache small (~1 MB each at 512 px)
  ctx.drawImage(noiseCanvas(w, h, seed & 3), 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** Cubic segment: x0,y0, c1x,c1y, c2x,c2y, x1,y1 */
type Seg = [number, number, number, number, number, number, number, number];
type Pt = [number, number];

function bez(s: Seg, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * s[0] + b * s[2] + c * s[4] + d * s[6], a * s[1] + b * s[3] + c * s[5] + d * s[7]];
}

function bezTangent(s: Seg, t: number): Pt {
  const u = 1 - t;
  const dx = 3 * u * u * (s[2] - s[0]) + 6 * u * t * (s[4] - s[2]) + 3 * t * t * (s[6] - s[4]);
  const dy = 3 * u * u * (s[3] - s[1]) + 6 * u * t * (s[5] - s[3]) + 3 * t * t * (s[7] - s[5]);
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

/**
 * Paisley (kairi) built around a curved spine with a tapering width profile,
 * so every inner ring nests perfectly inside the outer one. Unit size, y down:
 * round bulb at the bottom, horn sweeping up-left and curling to a tip on the right.
 */
const PAISLEY_SPINE: Seg = [0.0, 0.2, -0.16, -0.3, 0.26, -0.6, 0.47, -0.3];
const PAISLEY_W0 = 0.33;
const PAISLEY_BULB: Pt = [0, 0.2];

function paisleyPoly(widthScale: number, spineEnd: number, n = 48): Pt[] {
  const sideA: Pt[] = [];
  const sideB: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * spineEnd;
    const f = i / n;
    const [px, py] = bez(PAISLEY_SPINE, s);
    const [tx, ty] = bezTangent(PAISLEY_SPINE, s);
    const w = PAISLEY_W0 * widthScale * Math.pow(Math.max(0, 1 - Math.pow(f, 1.2)), 1.15);
    sideA.push([px - ty * w, py + tx * w]);
    sideB.push([px + ty * w, py - tx * w]);
  }
  const [p0x, p0y] = bez(PAISLEY_SPINE, 0);
  const [t0x, t0y] = bezTangent(PAISLEY_SPINE, 0);
  const w0 = PAISLEY_W0 * widthScale;
  const cap: Pt[] = [];
  const nc = 24;
  for (let i = 1; i < nc; i++) {
    const phi = Math.PI * (1 - i / nc);
    const c = Math.cos(phi);
    const sn = Math.sin(phi);
    // normal = (-ty, tx); cap sweeps from side B (phi=PI) behind the spine start to side A (phi=0)
    cap.push([p0x + (-t0y * c - t0x * sn) * w0, p0y + (t0x * c - t0y * sn) * w0]);
  }
  return [...sideB.slice().reverse(), ...cap, ...sideA];
}

function polyPath(pts: Pt[]): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}

/** Evenly spaced points along a closed polyline. */
function resampleClosed(pts: Pt[], n: number): Pt[] {
  const P = [...pts, pts[0]];
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / n) * L;
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = (d - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j]);
    out.push([P[j][0] + (P[j + 1][0] - P[j][0]) * t, P[j][1] + (P[j + 1][1] - P[j][1]) * t]);
  }
  return out;
}

interface PaisleyGeo {
  outer: Path2D;
  band: Path2D;
  inner: Path2D;
  dots: Pt[];
  ringDots: Pt[];
}
let paisleyGeo: PaisleyGeo | null = null;
function paisley(): PaisleyGeo {
  if (!paisleyGeo) {
    paisleyGeo = {
      outer: polyPath(paisleyPoly(1, 1)),
      band: polyPath(paisleyPoly(0.64, 0.84)),
      inner: polyPath(paisleyPoly(0.36, 0.66)),
      dots: resampleClosed(paisleyPoly(1.22, 1), 36),
      ringDots: resampleClosed(paisleyPoly(0.82, 0.93), 30),
    };
  }
  return paisleyGeo;
}

/** n-petal flower made of ellipses. */
function flower(p: Painter, x: number, y: number, r: number, petals: number, petalInk: Ink, centerInk: Ink, rot = 0, petalOrm?: OrmInk, centerOrm?: OrmInk) {
  for (let i = 0; i < petals; i++) {
    const a = rot + (i * TAU) / petals;
    p.ellipse(x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52, r * 0.5, r * 0.25, a, petalInk, petalOrm);
  }
  p.circle(x, y, r * 0.27, centerInk, centerOrm);
}

function leafPath(len: number, w: number): Path2D {
  const p = new Path2D();
  p.moveTo(0, 0);
  p.bezierCurveTo(len * 0.3, -w, len * 0.72, -w * 0.9, len, 0);
  p.bezierCurveTo(len * 0.72, w * 0.9, len * 0.3, w, 0, 0);
  p.closePath();
  return p;
}

function leaf(p: Painter, x: number, y: number, len: number, w: number, angle: number, ink: Ink, ormInk?: OrmInk) {
  const c = p.ctx;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  p.fill(leafPath(len, w), ink, ormInk);
  c.restore();
}

/** Pointed-petal rosette (block print / brocade). */
function rosettePath(r: number, petals: number, pointy = 0.32): Path2D {
  const path = new Path2D();
  for (let i = 0; i < petals; i++) {
    const a = (i * TAU) / petals;
    path.moveTo(0, 0);
    path.quadraticCurveTo(Math.cos(a - pointy) * r * 0.78, Math.sin(a - pointy) * r * 0.78, Math.cos(a) * r, Math.sin(a) * r);
    path.quadraticCurveTo(Math.cos(a + pointy) * r * 0.78, Math.sin(a + pointy) * r * 0.78, 0, 0);
    path.closePath();
  }
  return path;
}

function drawPaisleyMotif(p: Painter, x: number, y: number, size: number, rot: number, mirror: number, k: number) {
  const g = paisley();
  const c = p.ctx;
  const px = 1 / size;
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.scale(mirror * size, size);
  c.fillStyle = p.style('zari');
  for (const [dx, dy] of g.dots) {
    c.beginPath();
    c.arc(dx, dy, 1.9 * k * px, 0, TAU);
    c.fill();
  }
  p.fill(g.outer, 'accent', 'silk');
  p.stroke(g.outer, 'accentDark', 1.1 * k * px);
  c.fillStyle = p.style('zariLight', 'zari');
  for (const [dx, dy] of g.ringDots) {
    c.beginPath();
    c.arc(dx, dy, 1.15 * k * px, 0, TAU);
    c.fill();
  }
  p.fill(g.band, 'border', 'silk');
  p.stroke(g.band, 'zari', 1.6 * k * px);
  p.fill(g.inner, 'accentLight', 'silk');
  flower(p, PAISLEY_BULB[0], PAISLEY_BULB[1], 0.13, 6, 'zari', 'accentDark', 0, 'zari', 'silk');
  c.restore();
}

// ---------------------------------------------------------------------------
// Patterns (square, seamless). Signature: (painter, size, rng)
// ---------------------------------------------------------------------------

type PatternFn = (p: Painter, S: number, r: Rand) => void;

const plain: PatternFn = (p, S, r) => {
  p.rect(0, 0, S, S, 'base');
  if (p.orm) return;
  const k = S / 512;
  const c = p.ctx;
  const soft = lum(p.pal.rgb.base) > 0.72 ? 0.45 : 1;
  for (let i = 0; i < 110; i++) {
    const x = r() * S;
    const y = r() * S;
    const len = (24 + r() * 90) * k;
    const th = (0.7 + r() * 1.4) * k;
    const ink: Ink = r() < 0.5 ? 'baseLight' : 'baseDark';
    const a = (0.1 + r() * 0.16) * soft;
    wrap(S, S, x, y, len, th, (X, Y) => {
      c.globalAlpha = a;
      c.fillStyle = p.style(ink);
      c.beginPath();
      c.ellipse(X, Y, len / 2, th, 0, 0, TAU);
      c.fill();
    });
  }
  c.globalAlpha = 1;
};

const paisleyPattern: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const n = 4;
  const cell = S / n;
  for (let cx = 0; cx < n; cx++) {
    for (let ry = 0; ry < n; ry++) {
      const odd = cx % 2;
      const x = (cx + 0.5) * cell;
      const y = (ry + 0.5) * cell + odd * cell * 0.5;
      wrap(S, S, x, y, cell * 0.55, cell * 0.55, (X, Y) => drawPaisleyMotif(p, X, Y, cell * 0.62, odd ? 0.32 : -0.32, odd ? -1 : 1, k));
      // little four-dot butis in the gaps
      const gx = cx * cell;
      const gy = (ry + 0.5) * cell + (odd ? 0 : cell * 0.5);
      wrap(S, S, gx, gy, cell * 0.1, cell * 0.1, (X, Y) => {
        for (let i = 0; i < 4; i++) {
          const a = (i * TAU) / 4 + Math.PI / 4;
          p.circle(X + Math.cos(a) * 5 * k, Y + Math.sin(a) * 5 * k, 2.2 * k, 'zari');
        }
        p.circle(X, Y, 1.8 * k, 'accent', 'silk');
      });
    }
  }
};

const booti: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const n = 5;
  const cell = S / n;
  for (let cx = 0; cx < n; cx++) {
    for (let ry = 0; ry < n; ry++) {
      const odd = cx % 2;
      const x = (cx + 0.5) * cell;
      const y = (ry + 0.5) * cell + odd * cell * 0.5;
      const variant = (cx * 3 + ry) % 3;
      const rot = hash01(cx * 31 + ry * 7) * 0.6;
      wrap(S, S, x, y, cell * 0.4, cell * 0.4, (X, Y) => {
        // stem and leaves
        const c = p.ctx;
        c.strokeStyle = p.style('borderDark');
        c.lineWidth = 1.6 * k;
        c.beginPath();
        c.moveTo(X, Y);
        c.quadraticCurveTo(X + cell * 0.04, Y + cell * 0.14, X - cell * 0.01, Y + cell * 0.24);
        c.stroke();
        leaf(p, X + cell * 0.01, Y + cell * 0.13, cell * 0.17, cell * 0.055, 2.55, 'border');
        leaf(p, X + cell * 0.025, Y + cell * 0.18, cell * 0.17, cell * 0.055, 0.55, 'border');
        if (variant === 2) {
          flower(p, X, Y, cell * 0.16, 4, 'zari', 'accent', rot + Math.PI / 4, 'zari', 'silk');
          flower(p, X, Y, cell * 0.08, 4, 'accent', 'zari', rot, 'silk', 'zari');
        } else {
          flower(p, X, Y, cell * 0.16, variant ? 5 : 6, 'accent', 'zari', rot, 'silk', 'zari');
          p.circle(X, Y, cell * 0.022, 'accentDark', 'silk');
        }
      });
      // tiny zari dots between flowers
      const gx = cx * cell;
      const gy = (ry + (odd ? 0 : 0.5)) * cell;
      wrap(S, S, gx, gy, 6 * k, 6 * k, (X, Y) => {
        p.circle(X, Y - 3 * k, 1.9 * k, 'zari');
        p.circle(X, Y + 3 * k, 1.9 * k, 'zari');
      });
    }
  }
};

const bandhani: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const c = p.ctx;
  const dot = (x: number, y: number, rad: number, ink: Ink, id: number) => {
    const jx = (hash01(id * 3 + 1) - 0.5) * 2.2 * k;
    const jy = (hash01(id * 3 + 2) - 0.5) * 2.2 * k;
    const rr = rad * (0.85 + hash01(id * 3 + 3) * 0.3);
    wrap(S, S, x + jx, y + jy, rr * 2, rr * 2, (X, Y) => {
      if (!p.orm) {
        c.globalAlpha = 0.22;
        p.circle(X, Y, rr * 1.6, ink);
        c.globalAlpha = 1;
      }
      p.circle(X, Y, rr, ink);
      p.circle(X + 0.25 * rr, Y + 0.2 * rr, rr * 0.38, 'accentMid');
    });
  };
  const n = 4;
  const cell = S / n;
  let id = 0;
  for (let cx = 0; cx < n; cx++) {
    for (let ry = 0; ry < n; ry++) {
      const x = (cx + 0.5) * cell;
      const y = (ry + 0.5) * cell;
      // flower cluster
      dot(x, y, 3.6 * k, 'accent', id++);
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        dot(x + Math.cos(a) * 14 * k, y + Math.sin(a) * 14 * k, 3.2 * k, 'accent', id++);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8 + Math.PI / 8;
        dot(x + Math.cos(a) * 27 * k, y + Math.sin(a) * 27 * k, 3.3 * k, 'border', id++);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4;
        dot(x + Math.cos(a) * 41 * k, y + Math.sin(a) * 41 * k, 3 * k, 'accent', id++);
      }
      // diamond at the cell corner
      const gx = cx * cell;
      const gy = ry * cell;
      dot(gx, gy, 3.4 * k, 'border', id++);
      for (let i = 0; i < 4; i++) {
        const a = (i * TAU) / 4;
        dot(gx + Math.cos(a) * 11 * k, gy + Math.sin(a) * 11 * k, 2.8 * k, 'accent', id++);
      }
      // scattered singles
      for (const [fx, fy] of [
        [0.5, 0],
        [0, 0.5],
      ]) {
        dot(gx + fx * cell, gy + fy * cell, 2.6 * k, 'accent', id++);
      }
    }
  }
};

const leheriya: PatternFn = (p, S) => {
  if (p.orm) {
    p.rect(0, 0, S, S, 'base');
    return;
  }
  const { base, accent, border } = p.pal.rgb;
  const light = mix(accent, WHITE, 0.55);
  const P = Math.max(8, Math.round(S / 8));
  const Q = Math.max(8, Math.round(S / 4));
  const Q2 = Math.max(8, Math.round(S / 2));
  const k = S / 512;
  const A = 4.5 * k;
  const A2 = 2.5 * k;
  // 1D colour LUT across one stripe period, softened (dye bleed)
  const SUB = 4;
  const L = P * SUB;
  const bands: [number, RGB][] = [
    [0.0, base],
    [0.3, accent],
    [0.47, light],
    [0.55, base],
    [0.63, border],
    [0.8, light],
    [0.86, base],
  ];
  const raw: RGB[] = [];
  for (let i = 0; i < L; i++) {
    const f = i / L;
    let col = bands[0][1];
    for (const [s, cc] of bands) if (f >= s) col = cc;
    raw.push(col);
  }
  const blur = Math.max(1, Math.round(1.6 * k * SUB));
  const lut = new Uint8ClampedArray(L * 3);
  for (let i = 0; i < L; i++) {
    let rr = 0;
    let gg = 0;
    let bb = 0;
    for (let j = -blur; j <= blur; j++) {
      const c = raw[(i + j + L) % L];
      rr += c[0];
      gg += c[1];
      bb += c[2];
    }
    const n = blur * 2 + 1;
    lut[i * 3] = rr / n;
    lut[i * 3 + 1] = gg / n;
    lut[i * 3 + 2] = bb / n;
  }
  const sinQ = new Float32Array(Q);
  for (let i = 0; i < Q; i++) sinQ[i] = Math.sin((TAU * i) / Q) * A;
  const sinQ2 = new Float32Array(Q2);
  for (let i = 0; i < Q2; i++) sinQ2[i] = Math.sin((TAU * i) / Q2 + 1.3) * A2;
  const img = p.ctx.createImageData(S, S);
  const d = img.data;
  let o = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = (((x - y) % S) + S) % S;
      const v = x + y + sinQ[t % Q] + sinQ2[t % Q2];
      let m = v % P;
      if (m < 0) m += P;
      const li = Math.min(L - 1, (m * SUB) | 0) * 3;
      d[o] = lut[li];
      d[o + 1] = lut[li + 1];
      d[o + 2] = lut[li + 2];
      d[o + 3] = 255;
      o += 4;
    }
  }
  p.ctx.putImageData(img, 0, 0);
};

const ikat: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const n = 4;
  const cell = S / n;
  const step = Math.max(2, 3 * k);
  let id = 0;
  const diamond = (x: number, y: number, hw: number, hh: number, ink: Ink, jit: number) => {
    const myId = id++ * 997;
    const rows: [number, number, number][] = [];
    let ri = 0;
    for (let yy = -hh; yy < hh; yy += step) {
      const t = 1 - Math.abs(yy + step / 2) / hh;
      const hs = hw * t;
      if (hs > 0.6) rows.push([yy, (hash01(myId + ri * 2) - 0.5) * jit, (hash01(myId + ri * 2 + 1) - 0.5) * jit]);
      ri++;
    }
    wrap(S, S, x, y, hw + jit, hh, (X, Y) => {
      for (const [yy, j1, j2] of rows) {
        const t = 1 - Math.abs(yy + step / 2) / hh;
        const hs = hw * t;
        p.rect(X - hs + j1, Y + yy, 2 * hs + j2 - j1, step + 0.5, ink);
      }
    });
  };
  for (let cx = 0; cx < n; cx++) {
    for (let ry = 0; ry < n; ry++) {
      const x = (cx + 0.5) * cell;
      const y = (ry + 0.5) * cell + (cx % 2) * cell * 0.5;
      diamond(x, y, cell * 0.44, cell * 0.48, 'accent', 10 * k);
      diamond(x, y, cell * 0.28, cell * 0.31, 'border', 7 * k);
      diamond(x, y, cell * 0.13, cell * 0.15, 'baseLight', 5 * k);
      diamond(x, y, cell * 0.05, cell * 0.06, 'accentDark', 3 * k);
    }
    // chevron arrows in the gaps
    for (let ry = 0; ry < n; ry++) {
      const x = cx * cell;
      const y = (ry + 0.5) * cell + ((cx + 1) % 2) * cell * 0.5;
      diamond(x, y, cell * 0.07, cell * 0.12, 'accentDark', 4 * k);
    }
  }
};

const brocade: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const c = p.ctx;
  // silk twill ground
  if (!p.orm) {
    c.globalAlpha = 0.07;
    c.strokeStyle = p.style('baseDark');
    c.lineWidth = 1 * k;
    for (let i = -S; i < S; i += 4 * k) {
      c.beginPath();
      c.moveTo(i, S);
      c.lineTo(i + S, 0);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
  const n = 4;
  const cell = S / n;
  const motifs: [number, number, number][] = [];
  const butis: [number, number][] = [];
  for (let cx = 0; cx < n; cx++) {
    for (let ry = 0; ry < n; ry++) {
      const odd = cx % 2;
      motifs.push([(cx + 0.5) * cell, (ry + 0.5) * cell + odd * cell * 0.5, odd]);
      butis.push([cx * cell, (ry + 0.5) * cell + (odd ? 0 : cell * 0.5)]);
    }
  }
  zariLayer(p, S, S, (q) => {
    const qc = q.ctx;
    // fine zari trellis running between the diagonal rows of motifs
    qc.strokeStyle = q.style('zari');
    qc.lineWidth = 1.7 * k;
    const amp = cell * 0.05;
    for (const slope of [0.5, -0.5]) {
      const off = slope > 0 ? 0.75 : 0.25;
      for (let m = -4; m <= 6; m++) {
        const b = (m + off) * cell;
        qc.beginPath();
        for (let x = -cell; x <= S + cell; x += 4 * k) {
          const y = slope * x + b + amp * Math.sin((TAU * x) / (2 * cell));
          if (x === -cell) qc.moveTo(x, y);
          else qc.lineTo(x, y);
        }
        qc.stroke();
      }
    }
    for (const [x, y, odd] of motifs) {
      wrap(S, S, x, y, cell * 0.5, cell * 0.55, (X, Y) => {
        qc.strokeStyle = q.style('zari');
        qc.lineWidth = 3 * k;
        qc.lineCap = 'round';
        qc.beginPath();
        qc.moveTo(X, Y + cell * 0.36);
        qc.bezierCurveTo(X - cell * 0.08, Y + cell * 0.2, X + cell * 0.08, Y + cell * 0.12, X, Y);
        qc.stroke();
        const m = odd ? -1 : 1;
        leaf(q, X, Y + cell * 0.26, cell * 0.26, cell * 0.08, Math.PI - 0.5 * m, 'zari');
        leaf(q, X, Y + cell * 0.19, cell * 0.24, cell * 0.075, -0.45 * m, 'zari');
        leaf(q, X, Y - cell * 0.05, cell * 0.17, cell * 0.06, -Math.PI / 2 - 0.5, 'zari');
        leaf(q, X, Y - cell * 0.05, cell * 0.17, cell * 0.06, -Math.PI / 2 + 0.5, 'zari');
        q.circle(X, Y - cell * 0.27, cell * 0.045, 'zari');
        flower(q, X, Y, cell * 0.29, 8, 'zari', 'zari', Math.PI / 8);
      });
    }
    for (const [x, y] of butis) {
      wrap(S, S, x, y, cell * 0.12, cell * 0.12, (X, Y) => flower(q, X, Y, cell * 0.09, 4, 'zari', 'zari', Math.PI / 4));
    }
  });
  // meenakari (coloured enamel) accents on top of the zari
  for (const [x, y] of motifs) {
    wrap(S, S, x, y, cell * 0.3, cell * 0.3, (X, Y) => {
      flower(p, X, Y, cell * 0.15, 8, 'accent', 'border', Math.PI / 8, 'silk', 'silk');
      p.circle(X, Y, cell * 0.03, 'zariLight', 'zari');
      p.circle(X, Y - cell * 0.27, cell * 0.022, 'accent', 'silk');
    });
  }
  for (const [x, y] of butis) wrap(S, S, x, y, 5 * k, 5 * k, (X, Y) => p.circle(X, Y, 2.2 * k, 'accent', 'silk'));
};

const chikankari: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const c = p.ctx;
  const n = 4;
  const cell = S / n;
  const lw = 1.5 * k;
  const motif = (X: number, Y: number, v: number, shadow: boolean) => {
    const ink: Ink = shadow ? 'threadShadow' : 'thread';
    const ox = shadow ? 0.8 * k : 0;
    const oy = shadow ? 1 * k : 0;
    const x = X + ox;
    const y = Y + oy;
    c.strokeStyle = p.style(ink);
    c.fillStyle = p.style(ink);
    c.lineWidth = lw;
    c.lineCap = 'round';
    // stem
    c.beginPath();
    c.moveTo(x, y + cell * 0.08);
    c.bezierCurveTo(x + cell * 0.1, y + cell * 0.2, x - cell * 0.12, y + cell * 0.28, x - cell * 0.02, y + cell * 0.4);
    c.stroke();
    // leaves (outline + vein, shadow-work fill)
    for (const [lx, ly, la] of [
      [x + cell * 0.02, y + cell * 0.2, 0.35],
      [x - cell * 0.04, y + cell * 0.29, Math.PI - 0.4],
    ]) {
      c.save();
      c.translate(lx, ly);
      c.rotate(la);
      const lp = leafPath(cell * 0.17, cell * 0.06);
      if (!shadow && !p.orm) {
        c.globalAlpha = 0.33;
        c.fill(lp);
        c.globalAlpha = 1;
      }
      c.stroke(lp);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(cell * 0.15, 0);
      c.stroke();
      c.restore();
    }
    // flower: outlined petals
    const petals = v === 0 ? 6 : 5;
    const r = cell * 0.12;
    for (let i = 0; i < petals; i++) {
      const a = (i * TAU) / petals + v * 0.3;
      c.beginPath();
      c.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.27, a, 0, TAU);
      if (!shadow && !p.orm) {
        c.globalAlpha = 0.3;
        c.fill();
        c.globalAlpha = 1;
      }
      c.stroke();
    }
    // french knots
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      c.beginPath();
      c.arc(x + Math.cos(a) * r * 0.16, y + Math.sin(a) * r * 0.16, 1.4 * k, 0, TAU);
      c.fill();
    }
    // bakhiya dotted arc
    for (let i = 0; i < 7; i++) {
      const a = -0.3 + i * 0.32;
      c.beginPath();
      c.arc(x + Math.cos(a) * r * 1.65, y - cell * 0.03 + Math.sin(a) * r * 1.65 - r * 0.2, 1.1 * k, 0, TAU);
      c.fill();
    }
  };
  const lightBase = lum(p.pal.rgb.base) > 0.72;
  for (let pass = 0; pass < 2; pass++) {
    const shadow = pass === 0;
    if (shadow && p.orm) continue;
    if (shadow) c.globalAlpha = lightBase ? 0.8 : 0.55;
    for (let cx = 0; cx < n; cx++) {
      for (let ry = 0; ry < n; ry++) {
        const odd = cx % 2;
        const x = (cx + 0.5) * cell;
        const y = (ry + 0.32) * cell + odd * cell * 0.5;
        const v = (cx + ry) % 2;
        wrap(S, S, x, y + cell * 0.15, cell * 0.4, cell * 0.45, (X, Y) => motif(X, Y - cell * 0.15, v, shadow));
        // phanda (knot) trios in the gaps
        const gx = cx * cell;
        const gy = (ry + (odd ? 0 : 0.5)) * cell;
        wrap(S, S, gx, gy, 6 * k, 6 * k, (X, Y) => {
          const sx = shadow ? 0.8 * k : 0;
          for (let i = 0; i < 3; i++) {
            const a = (i * TAU) / 3 - Math.PI / 2;
            p.circle(X + sx + Math.cos(a) * 3.5 * k, Y + sx + Math.sin(a) * 3.5 * k, 1.6 * k, shadow ? 'threadShadow' : 'thread');
          }
        });
      }
    }
    c.globalAlpha = 1;
  }
};

const blockPrint: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const c = p.ctx;
  const n = 6;
  const cell = S / n;
  const ros = rosettePath(cell * 0.3, 8, 0.36);
  const inner = rosettePath(cell * 0.14, 8, 0.4);
  const mx = 1.7 * k;
  const my = 1.2 * k;
  for (let ry = 0; ry < n; ry++) {
    for (let cx = 0; cx < n; cx++) {
      const x = (cx + 0.5) * cell + (ry % 2) * cell * 0.5;
      const y = (ry + 0.5) * cell;
      const rot = (ry % 2) * (Math.PI / 8);
      wrap(S, S, x, y, cell * 0.36, cell * 0.36, (X, Y) => {
        c.save();
        c.translate(X, Y);
        c.rotate(rot);
        p.fill(ros, 'accent', 'dye');
        p.fill(inner, 'border', 'dye');
        p.circle(0, 0, cell * 0.045, 'base', 'dye');
        c.translate(mx, my); // misregistered outline block
        p.stroke(ros, 'accentDark', 1.3 * k, 'dye');
        c.restore();
      });
      // gap buti
      const gx = cx * cell + (ry % 2) * cell * 0.5;
      const gy = ry * cell;
      wrap(S, S, gx, gy, 6 * k, 6 * k, (X, Y) => {
        for (let i = 0; i < 4; i++) {
          const a = (i * TAU) / 4;
          p.circle(X + Math.cos(a) * 3.6 * k, Y + Math.sin(a) * 3.6 * k, 1.8 * k, 'border', 'dye');
        }
      });
    }
  }
};

const checks: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const c = p.ctx;
  const unit = S / 4;
  const stripes: [number, number, Ink][] = [
    [0.0, 0.26, 'accent'],
    [0.31, 0.035, 'border'],
    [0.38, 0.015, 'accentDark'],
    [0.45, 0.035, 'border'],
    [0.62, 0.1, 'accentLight'],
    [0.82, 0.02, 'borderDark'],
  ];
  const a = p.orm ? 1 : 0.58;
  for (let pass = 0; pass < 2; pass++) {
    c.globalAlpha = a;
    for (let u = 0; u < 4; u++) {
      for (const [s, w, ink] of stripes) {
        const o = (u + s) * unit;
        if (pass === 0) p.rect(0, o, S, w * unit, ink);
        else p.rect(o, 0, w * unit, S, ink);
      }
    }
  }
  c.globalAlpha = 1;
  if (!p.orm) {
    c.globalAlpha = 0.07;
    c.strokeStyle = p.style('accentDark');
    c.lineWidth = 1 * k;
    for (let i = -S; i < S; i += 4 * k) {
      c.beginPath();
      c.moveTo(i, S);
      c.lineTo(i + S, 0);
      c.stroke();
    }
    c.globalAlpha = 1;
  }
};

const jaal: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const X = S / 4;
  const P = S / 2;
  const A = X / 2;
  zariLayer(p, S, S, (q) => {
    const c = q.ctx;
    c.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      c.strokeStyle = q.style(pass === 0 ? 'zari' : 'zariDark');
      c.lineWidth = (pass === 0 ? 4.2 : 1) * k;
      for (let i = -1; i <= 4; i++) {
        for (const sgn of [1, -1]) {
          c.beginPath();
          for (let y = -4; y <= S + 4; y += 2) {
            const x = i * X + sgn * A * Math.sin((TAU * y) / P);
            if (y === -4) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
      }
    }
    // knots where the trellis meets
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        wrap(S, S, i * X, (j * P) / 2, 8 * k, 8 * k, (x, y) => {
          q.ellipse(x, y, 5.5 * k, 8 * k, 0, 'zari');
        });
        wrap(S, S, (i + 0.5) * X, P / 4 + (j * P) / 2, 8 * k, 8 * k, (x, y) => q.ellipse(x, y, 7 * k, 4.5 * k, 0, 'zari'));
      }
    }
  });
  // flower in each cell
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = i * X;
      const y = P / 4 + (j * P) / 2;
      wrap(S, S, x, y, X * 0.3, X * 0.3, (cx, cy) => {
        leaf(p, cx, cy + X * 0.04, X * 0.2, X * 0.06, Math.PI / 2 + 0.6, 'border');
        leaf(p, cx, cy + X * 0.04, X * 0.2, X * 0.06, Math.PI / 2 - 0.6, 'border');
        flower(p, cx, cy - X * 0.02, X * 0.17, 5, 'accent', 'zari', -Math.PI / 2, 'silk', 'zari');
      });
    }
  }
};

const stripesPattern: PatternFn = (p, S) => {
  const k = S / 512;
  p.rect(0, 0, S, S, 'base');
  const P = S / 16;
  for (let i = 0; i < 16; i++) {
    const x = i * P;
    p.rect(x, 0, Math.max(1, 1.6 * k), S, 'accent');
    if (i % 4 === 0) {
      p.rect(x + 5 * k, 0, Math.max(1, 1 * k), S, 'border');
      p.rect(x - 5 * k, 0, Math.max(1, 1 * k), S, 'border');
    }
  }
  p.rect(S - 5 * k, 0, Math.max(1, 1 * k), S, 'border');
};

/** Kalidar ghagra: panels of four colours (base, accent, border, deep border) with zari piping on the seams. */
const kaliPanels: PatternFn = (p, S) => {
  const k = S / 512;
  const inks: Ink[] = ['base', 'accent', 'border', 'borderDark'];
  const w = S / 4;
  for (let i = 0; i < 4; i++) p.rect(i * w, 0, w + 1, S, inks[i]);
  // a soft sheen down the middle of each panel, like dyed silk catching light
  if (!p.orm) {
    const c = p.ctx;
    for (let i = 0; i < 4; i++) {
      const g = c.createLinearGradient(i * w, 0, (i + 1) * w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.12)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      c.fillStyle = g;
      c.fillRect(i * w, 0, w, S);
    }
  }
  zariLayer(p, S, S, (q) => {
    for (let i = 0; i <= 4; i++) q.rect(i * w - 3 * k, 0, 6 * k, S, 'zari');
  });
};

const PATTERN_FNS: Record<PatternId, PatternFn> = {
  plain,
  paisley: paisleyPattern,
  booti,
  bandhani,
  leheriya,
  ikat,
  brocade,
  chikankari,
  block: blockPrint,
  checks,
  jaal,
  stripes: stripesPattern,
  kali: kaliPanels,
};

const GRAIN: Record<PatternId, number> = {
  plain: 0.22,
  paisley: 0.12,
  booti: 0.12,
  bandhani: 0.16,
  leheriya: 0.14,
  ikat: 0.16,
  brocade: 0.1,
  chikankari: 0.14,
  block: 0.16,
  checks: 0.16,
  jaal: 0.1,
  stripes: 0.18,
  kali: 0.14,
};

/** Seamless square tile. */
export function drawPattern(id: PatternId, colors: PatternColors, size = 512, seed = 1): TexturePair {
  const S = Math.max(16, Math.round(size));
  const [color, cctx] = makeCanvas(S, S);
  const [orm, octx] = makeCanvas(S, S);
  const pal = makePalette(colors);
  const fn = PATTERN_FNS[id] ?? plain;
  const s0 = (hashStr(id) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0;
  fn(new Painter(cctx, false, pal), S, rng(s0));
  fn(new Painter(octx, true, pal), S, rng(s0));
  yarnOverlay(cctx, S, S, s0, GRAIN[id] ?? 0.12);
  return { color, orm };
}

// ---------------------------------------------------------------------------
// Borders (tile horizontally; inner edge at top, outer garment edge at bottom)
// ---------------------------------------------------------------------------

type BorderFn = (p: Painter, W: number, H: number) => void;

const repeatsFor = (W: number, motifW: number) => Math.max(1, Math.round(W / Math.max(1, motifW)));

const borderNone: BorderFn = (p, W, H) => p.rect(0, 0, W, H, 'base');

const borderSimple: BorderFn = (p, W, H) => {
  p.rect(0, 0, W, H, 'border');
  zariLayer(p, W, H, (q) => {
    q.rect(0, H * 0.1, W, H * 0.07, 'zari');
    q.rect(0, H * 0.72, W, H * 0.14, 'zari');
    const n = repeatsFor(W, H * 0.17);
    const w = W / n;
    for (let i = 0; i < n; i++) q.circle((i + 0.5) * w, H * 0.44, H * 0.04, 'zari');
  });
  p.rect(0, H * 0.9, W, H * 0.025, 'accent');
};

const borderTemple: BorderFn = (p, W, H) => {
  p.rect(0, 0, W, H, 'border');
  const n = repeatsFor(W, H * 0.56);
  const w = W / n;
  const base = H * 0.8;
  zariLayer(p, W, H, (q) => {
    q.rect(0, H * 0.05, W, H * 0.055, 'zari');
    q.rect(0, base, W, H * 0.13, 'zari');
    for (let i = 0; i < n; i++) {
      const x0 = i * w;
      wrap(W, H, x0 + w / 2, H / 2, w, H, (X) => {
        const x = X - w / 2;
        const tri = new Path2D();
        tri.moveTo(x, base + 1);
        // stepped gopuram silhouette
        const steps = 4;
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          const yA = base - (base - H * 0.2) * t0;
          const yB = base - (base - H * 0.2) * t1;
          const half0 = (w / 2) * (1 - t0);
          const half1 = (w / 2) * (1 - t1);
          tri.lineTo(x + w / 2 - half0 + (half0 - half1) * 0.35, yA);
          tri.lineTo(x + w / 2 - half1, yB);
        }
        for (let s = steps - 1; s >= 0; s--) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          const yA = base - (base - H * 0.2) * t0;
          const yB = base - (base - H * 0.2) * t1;
          const half0 = (w / 2) * (1 - t0);
          const half1 = (w / 2) * (1 - t1);
          tri.lineTo(x + w / 2 + half1, yB);
          tri.lineTo(x + w / 2 + half0 - (half0 - half1) * 0.35, yA);
        }
        tri.closePath();
        q.fill(tri, 'zari');
        q.circle(x + w / 2, H * 0.155, H * 0.035, 'zari');
      }, false);
    }
  });
  for (let i = 0; i < n; i++) {
    wrap(W, H, i * w + w / 2, H / 2, w, H, (X) => {
      const inner = new Path2D();
      inner.moveTo(X - w * 0.24, base);
      inner.lineTo(X, H * 0.42);
      inner.lineTo(X + w * 0.24, base);
      inner.closePath();
      p.fill(inner, 'border');
      const core = new Path2D();
      core.moveTo(X - w * 0.11, base);
      core.lineTo(X, H * 0.6);
      core.lineTo(X + w * 0.11, base);
      core.closePath();
      p.fill(core, 'accent', 'silk');
    }, false);
  }
  p.rect(0, H * 0.94, W, H * 0.06, 'borderDark');
};

const borderVine: BorderFn = (p, W, H) => {
  p.rect(0, 0, W, H, 'border');
  const n = repeatsFor(W, H * 1.7);
  const lam = W / n;
  const yAt = (x: number) => H * 0.5 + H * 0.16 * Math.sin((TAU * x) / lam);
  const flowers: [number, number, number][] = [];
  zariLayer(p, W, H, (q) => {
    const c = q.ctx;
    q.rect(0, H * 0.05, W, H * 0.05, 'zari');
    q.rect(0, H * 0.86, W, H * 0.08, 'zari');
    c.strokeStyle = q.style('zari');
    c.lineWidth = H * 0.04;
    c.lineCap = 'round';
    c.beginPath();
    for (let x = -4; x <= W + 4; x += 2) {
      if (x === -4) c.moveTo(x, yAt(x));
      else c.lineTo(x, yAt(x));
    }
    c.stroke();
    for (let i = 0; i < n; i++) {
      const x0 = i * lam;
      // leaves near the zero crossings, alternating sides
      for (const [f, side] of [
        [0.05, -1],
        [0.45, 1],
        [0.55, 1],
        [0.95, -1],
      ] as [number, number][]) {
        const x = x0 + f * lam;
        const slope = Math.atan2(yAt(x + 1) - yAt(x - 1), 2);
        wrap(W, H, x, yAt(x), H * 0.25, H, (X) => leaf(q, X, yAt(x), H * 0.2, H * 0.065, slope + side * 1.0, 'zari'), false);
      }
      flowers.push([x0 + 0.25 * lam, H * 0.64, i]);
      flowers.push([x0 + 0.75 * lam, H * 0.36, i]);
    }
    for (const [x, y] of flowers) wrap(W, H, x, y, H * 0.14, H, (X) => flower(q, X, y, H * 0.13, 5, 'zari', 'zari', -Math.PI / 2), false);
  });
  for (const [x, y] of flowers) wrap(W, H, x, y, H * 0.05, H, (X) => p.circle(X, y, H * 0.035, 'accent', 'silk'), false);
};

const borderGota: BorderFn = (p, W, H) => {
  p.rect(0, 0, W, H, 'border');
  const top = H * 0.26;
  const bot = H * 0.9;
  p.rect(0, H * 0.1, W, H * 0.03, 'accent', 'silk');
  p.rect(0, top + H * 0.05, W, bot - top - H * 0.05, 'gota');
  const sc = repeatsFor(W, H * 0.13);
  const sw = W / sc;
  for (let i = 0; i < sc; i++) {
    wrap(W, H, (i + 0.5) * sw, top + H * 0.06, sw, H, (X) => {
      const c = p.ctx;
      c.fillStyle = p.style('gota');
      c.beginPath();
      c.arc(X, top + H * 0.06, sw / 2, Math.PI, 0);
      c.fill();
    }, false);
  }
  const n = repeatsFor(W, H * 0.4);
  const w = W / n;
  for (let i = 0; i < n; i++) {
    wrap(W, H, (i + 0.5) * w, H / 2, w, H, (X) => {
      const c = p.ctx;
      c.save();
      c.translate(X, (top + bot) / 2 + H * 0.2);
      c.rotate(-Math.PI / 2 + (i % 2 ? 0.18 : -0.18));
      const lp = leafPath(H * 0.42, H * 0.12);
      p.fill(lp, 'border');
      c.strokeStyle = p.style('gota');
      c.lineWidth = H * 0.02;
      c.beginPath();
      c.moveTo(H * 0.05, 0);
      c.lineTo(H * 0.36, 0);
      c.stroke();
      c.restore();
    }, false);
  }
  if (!p.orm) {
    const g = p.ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    p.ctx.fillStyle = g;
    p.ctx.fillRect(0, top, W, bot - top);
  }
  p.rect(0, bot, W, H - bot, 'borderDark');
};

const borderMirror: BorderFn = (p, W, H) => {
  p.rect(0, 0, W, H, 'border');
  zariLayer(p, W, H, (q) => {
    q.rect(0, H * 0.05, W, H * 0.05, 'zari');
    q.rect(0, H * 0.88, W, H * 0.06, 'zari');
  });
  const n = repeatsFor(W, H * 0.62);
  const w = W / n;
  const cy = H * 0.49;
  for (let i = 0; i < n; i++) {
    wrap(W, H, (i + 0.5) * w, cy, w, H, (X) => {
      for (let j = 0; j < 8; j++) {
        const a = (j * TAU) / 8 + Math.PI / 8;
        p.ellipse(X + Math.cos(a) * H * 0.255, cy + Math.sin(a) * H * 0.255, H * 0.065, H * 0.032, a, j % 2 ? 'accent' : 'zari', j % 2 ? 'thread' : 'zari');
      }
      const c = p.ctx;
      c.strokeStyle = p.style('accentLight', 'thread');
      c.lineWidth = H * 0.045;
      c.beginPath();
      c.arc(X, cy, H * 0.185, 0, TAU);
      c.stroke();
      c.setLineDash([H * 0.02, H * 0.025]);
      c.strokeStyle = p.style('accentDark', 'thread');
      c.lineWidth = H * 0.015;
      c.beginPath();
      c.arc(X, cy, H * 0.185, 0, TAU);
      c.stroke();
      c.setLineDash([]);
      p.circle(X, cy, H * 0.15, 'mirror');
      if (!p.orm) {
        const g = c.createRadialGradient(X - H * 0.05, cy - H * 0.05, H * 0.01, X, cy, H * 0.15);
        g.addColorStop(0, 'rgba(255,255,255,0.9)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        g.addColorStop(1, 'rgba(90,100,115,0.35)');
        c.fillStyle = g;
        c.beginPath();
        c.arc(X, cy, H * 0.15, 0, TAU);
        c.fill();
      }
    }, false);
    wrap(W, H, i * w, cy, H * 0.06, H, (X) => {
      p.circle(X, cy, H * 0.04, 'zari');
      p.circle(X, cy - H * 0.13, H * 0.022, 'accentLight', 'thread');
      p.circle(X, cy + H * 0.13, H * 0.022, 'accentLight', 'thread');
    }, false);
  }
};

const borderKasavu: BorderFn = (p, W, H) => {
  p.rect(0, 0, W, H, 'base');
  p.rect(0, H * 0.16, W, H * 0.05, 'border', 'silk');
  zariLayer(p, W, H, (q) => {
    q.rect(0, H * 0.07, W, H * 0.025, 'zari');
    q.rect(0, H * 0.26, W, H * 0.74, 'zari');
  }, 0.8);
  p.rect(0, H * 0.33, W, H * 0.012, 'zariDark', 'zari');
  p.rect(0, H * 0.955, W, H * 0.02, 'zariDark', 'zari');
};

const BORDER_FNS: Record<BorderId, BorderFn> = {
  none: borderNone,
  temple: borderTemple,
  vine: borderVine,
  gota: borderGota,
  mirror: borderMirror,
  simple: borderSimple,
  kasavu: borderKasavu,
};

/** Border strip, tiles horizontally. Decorative OUTER edge of the garment is at the BOTTOM of the canvas (y = height). */
export function drawBorder(id: BorderId, colors: PatternColors, width = 512, height = 128): TexturePair {
  const W = Math.max(8, Math.round(width));
  const H = Math.max(4, Math.round(height));
  const [color, cctx] = makeCanvas(W, H);
  const [orm, octx] = makeCanvas(W, H);
  const pal = makePalette(colors);
  const fn = BORDER_FNS[id] ?? borderNone;
  fn(new Painter(cctx, false, pal), W, H);
  fn(new Painter(octx, true, pal), W, H);
  yarnOverlay(cctx, W, H, hashStr('border:' + id), 0.1);
  return { color, orm };
}

// ---------------------------------------------------------------------------
// Drapes
// ---------------------------------------------------------------------------

/**
 * Composite for long drapes (dupatta / saree pallu / stole): seamless in V;
 * the left and right ~13% carry the border running vertically with its outer
 * edge facing outward (x = 0 and x = size), the middle is the pattern.
 */
export function drawDrape(pattern: PatternId, border: BorderId, colors: PatternColors, size = 512): TexturePair {
  const S = Math.max(32, Math.round(size));
  const bw = Math.max(4, Math.round(S * 0.13));
  const pat = drawPattern(pattern, colors, S);
  if (border === 'none') return pat;
  const bord = drawBorder(border, colors, S, bw);
  const [color, cctx] = makeCanvas(S, S);
  const [orm, octx] = makeCanvas(S, S);
  const jobs: [CanvasRenderingContext2D, HTMLCanvasElement, HTMLCanvasElement][] = [
    [cctx, pat.color, bord.color],
    [octx, pat.orm, bord.orm],
  ];
  for (const [ctx, body, strip] of jobs) {
    ctx.drawImage(body, 0, 0);
    // left: rotate 90deg clockwise -> strip bottom (outer edge) lands at x = 0
    ctx.save();
    ctx.translate(bw, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(strip, 0, 0);
    ctx.restore();
    // right: rotate 90deg counter-clockwise -> outer edge at x = S
    ctx.save();
    ctx.translate(S - bw, S);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(strip, 0, 0);
    ctx.restore();
  }
  return { color, orm };
}

/**
 * Heavily decorated end panel for a saree pallu / dupatta end. Tiles in U,
 * not in V; the outer (fringed) edge is at the bottom.
 */
export function drawPalluEnd(pattern: PatternId, colors: PatternColors, width = 512, height = 512): TexturePair {
  const W = Math.max(32, Math.round(width));
  const H = Math.max(32, Math.round(height));
  const [color, cctx] = makeCanvas(W, H);
  const [orm, octx] = makeCanvas(W, H);
  const pal = makePalette(colors);
  // pattern band source (small tile, drawn as a repeating fill)
  const bandH = H * 0.17;
  const nTiles = repeatsFor(W, bandH);
  const tileSize = Math.max(16, Math.round(W / nTiles));
  const tile = drawPattern(pattern, colors, tileSize);
  const temple = drawBorder('temple', colors, W, Math.round(H * 0.24));

  const run = (p: Painter) => {
    const c = p.ctx;
    const k = Math.max(W, H) / 512;
    // transition from the drape body
    p.rect(0, 0, W, H, 'border');
    p.rect(0, 0, W, H * 0.05, 'base');
    // row of large zari paisleys (kalka)
    const top = H * 0.1;
    const bot = H * 0.4;
    const n = repeatsFor(W, H * 0.34);
    const w = W / n;
    const g = paisley();
    zariLayer(p, W, H, (q) => {
      q.rect(0, H * 0.05, W, H * 0.022, 'zari');
      q.rect(0, H * 0.085, W, H * 0.01, 'zari');
      q.rect(0, bot + H * 0.005, W, H * 0.022, 'zari');
      q.rect(0, bot + H * 0.04, W, H * 0.008, 'zari');
      const qc = q.ctx;
      for (let i = 0; i < n; i++) {
        wrap(W, H, (i + 0.5) * w, (top + bot) / 2, w, H, (X) => {
          qc.save();
          qc.translate(X, (top + bot) / 2 + H * 0.01);
          qc.rotate(-0.2);
          qc.scale((i % 2 ? -1 : 1) * (bot - top) * 0.82, (bot - top) * 0.82);
          q.fill(g.outer, 'zari');
          qc.restore();
        }, false);
        // small butis between the kalkas
        wrap(W, H, i * w, (top + bot) / 2, w * 0.2, H, (X) => {
          flower(q, X, (top + bot) / 2 - H * 0.06, H * 0.035, 6, 'zari', 'zari');
          flower(q, X, (top + bot) / 2 + H * 0.07, H * 0.035, 6, 'zari', 'zari');
        }, false);
      }
    });
    for (let i = 0; i < n; i++) {
      wrap(W, H, (i + 0.5) * w, (top + bot) / 2, w, H, (X) => {
        c.save();
        c.translate(X, (top + bot) / 2 + H * 0.01);
        c.rotate(-0.2);
        const s = (bot - top) * 0.82;
        c.scale((i % 2 ? -1 : 1) * s, s);
        p.fill(g.band, 'accent', 'silk');
        p.stroke(g.band, 'zariDark', (1.4 * k) / s, 'zari');
        p.fill(g.inner, 'zari');
        c.fillStyle = p.style('zariLight', 'zari');
        for (const [dx, dy] of g.ringDots) {
          c.beginPath();
          c.arc(dx, dy, (1.4 * k) / s, 0, TAU);
          c.fill();
        }
        flower(p, PAISLEY_BULB[0], PAISLEY_BULB[1], 0.11, 6, 'border', 'zariLight', 0, 'silk', 'zari');
        c.restore();
      }, false);
    }
    // pattern band
    const by = bot + H * 0.055;
    c.save();
    const fillSrc = p.orm ? tile.orm : tile.color;
    const pat = c.createPattern(fillSrc, 'repeat');
    if (pat) {
      c.fillStyle = pat;
      c.translate(0, by);
      c.fillRect(0, 0, W, bandH);
    }
    c.restore();
    // temple spires
    const ty = by + bandH;
    c.drawImage(p.orm ? temple.orm : temple.color, 0, ty);
    // fringe (tassels)
    const fy = ty + H * 0.24;
    p.rect(0, fy, W, H - fy, 'borderDark');
    const strands = repeatsFor(W, 4.5 * k);
    const sw = W / strands;
    for (let i = 0; i < strands; i++) {
      const x = (i + 0.5) * sw;
      const ink: Ink = i % 3 === 0 ? 'zari' : i % 3 === 1 ? 'accent' : 'border';
      const ormInk: OrmInk = ink === 'zari' ? 'zari' : 'thread';
      const len = (H - fy) * (0.82 + hash01(i * 13) * 0.16);
      p.rect(x - sw * 0.28, fy, sw * 0.56, len, ink, ormInk);
      if (i % 4 === 0) p.circle(x, fy + (H - fy) * 0.3, sw * 0.55, 'zari');
    }
  };
  run(new Painter(cctx, false, pal));
  run(new Painter(octx, true, pal));
  yarnOverlay(cctx, W, H, hashStr('pallu:' + pattern), 0.08);
  return { color, orm };
}

// ---------------------------------------------------------------------------
// Weave normal maps
// ---------------------------------------------------------------------------

/** Tangent-space normal map of the woven fabric structure (seamless). */
export function drawWeaveNormal(kind: WeaveKind, size = 256): HTMLCanvasElement {
  const S = Math.max(16, Math.round(size));
  const h = new Float32Array(S * S);
  const T = kind === 'satin' ? 48 : kind === 'velvet' ? 64 : 32;
  const r = rng(hashStr('weave:' + kind));
  if (kind === 'velvet') {
    // fine pile: smoothed value noise on a coarse lattice + per-pixel fuzz
    const G = 64;
    const lat = new Float32Array(G * G);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const gx = (x / S) * G;
        const gy = (y / S) * G;
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const fx = gx - x0;
        const fy = gy - y0;
        const sx = fx * fx * (3 - 2 * fx);
        const sy = fy * fy * (3 - 2 * fy);
        const a = lat[(y0 % G) * G + (x0 % G)];
        const b = lat[(y0 % G) * G + ((x0 + 1) % G)];
        const c = lat[((y0 + 1) % G) * G + (x0 % G)];
        const d = lat[((y0 + 1) % G) * G + ((x0 + 1) % G)];
        h[y * S + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy + (r() - 0.5) * 0.35;
      }
    }
  } else {
    for (let y = 0; y < S; y++) {
      const v = (y / S) * T;
      const iv = Math.floor(v);
      const fv = v - iv;
      for (let x = 0; x < S; x++) {
        const u = (x / S) * T;
        const iu = Math.floor(u);
        const fu = u - iu;
        let warpOver: boolean;
        if (kind === 'twill') warpOver = (((iu - iv) % 4) + 4) % 4 < 2;
        else if (kind === 'satin') warpOver = (iu * 2 + iv) % 5 !== 0;
        else warpOver = (iu + iv) % 2 === 0;
        const warp = Math.sin(Math.PI * fu); // thread running vertically, profile across u
        const weft = Math.sin(Math.PI * fv);
        let val: number;
        if (warpOver) {
          const arch = kind === 'satin' ? 1 : 0.65 + 0.35 * Math.sin(Math.PI * fv);
          val = 0.45 + 0.55 * Math.sqrt(Math.max(0, warp)) * arch;
        } else {
          const arch = 0.65 + 0.35 * Math.sin(Math.PI * fu);
          val = 0.45 + 0.55 * Math.sqrt(Math.max(0, weft)) * arch;
        }
        // fibre grain along the floating thread
        val += (r() - 0.5) * 0.06;
        h[y * S + x] = val;
      }
    }
  }
  const strength = kind === 'plain' ? 2.6 : kind === 'twill' ? 2.4 : kind === 'satin' ? 1.4 : 0.9;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const scale = strength * (S / 256);
  for (let y = 0; y < S; y++) {
    const ym = ((y - 1 + S) % S) * S;
    const yp = ((y + 1) % S) * S;
    const yr = y * S;
    for (let x = 0; x < S; x++) {
      const xm = (x - 1 + S) % S;
      const xp = (x + 1) % S;
      const dx = (h[yr + xp] - h[yr + xm]) * 0.5;
      const dy = (h[yp + x] - h[ym + x]) * 0.5;
      let nx = -dx * scale;
      let ny = dy * scale; // canvas y points down, texture v points up
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l;
      ny /= l;
      nz /= l;
      const o = (yr + x) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255;
      d[o + 1] = (ny * 0.5 + 0.5) * 255;
      d[o + 2] = (nz * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
