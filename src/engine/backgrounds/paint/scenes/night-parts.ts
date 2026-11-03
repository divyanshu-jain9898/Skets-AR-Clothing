/**
 * Parts for the "Diwali Night Scene" (river ghat Deepotsav): flying sky
 * lanterns, rippled water reflections, a stone deepstambh (lamp tower),
 * floating leaf-boat diyas and a wooden boat.
 */
import { TAU, ctx2d, ellipse, gauss, glow, lerp, makeCanvas, mix, rand, rgba, wash, withBlend, withState, type AnyCanvas, type Ctx, type Pt, type Rng } from '../kit';
import { dot, lightSprite } from './crackers-parts';

// ------------------------------------------------------------------ sky lanterns
/** Paper sky lantern body (base pass). (x, y) = centre, `s` = height. */
export function skyLanternBody(g: Ctx, x: number, y: number, s: number, tint = '#ff8a2a') {
  if (s < 3) {
    ellipse(g, x, y, Math.max(0.8, s * 0.4), Math.max(1, s * 0.5), rgba('#ffb050', 0.85));
    return;
  }
  const wt = s * 0.64;
  const wb = s * 0.44;
  g.beginPath();
  g.moveTo(x - wb / 2, y + s / 2);
  g.lineTo(x - wt / 2, y - s * 0.3);
  g.quadraticCurveTo(x - wt / 2, y - s / 2, x, y - s / 2);
  g.quadraticCurveTo(x + wt / 2, y - s / 2, x + wt / 2, y - s * 0.3);
  g.lineTo(x + wb / 2, y + s / 2);
  g.closePath();
  const grd = g.createRadialGradient(x, y + s * 0.42, s * 0.02, x, y + s * 0.1, s * 0.85);
  grd.addColorStop(0, '#fff6c8');
  grd.addColorStop(0.28, '#ffc45a');
  grd.addColorStop(0.62, tint);
  grd.addColorStop(1, mix(tint, '#5a0a10', 0.55));
  g.fillStyle = grd;
  g.fill();
  if (s > 10) {
    g.strokeStyle = rgba('#8a2a10', 0.35);
    g.lineWidth = Math.max(0.6, s * 0.025);
    g.beginPath();
    g.moveTo(x - s * 0.08, y - s * 0.5);
    g.lineTo(x - s * 0.07, y + s * 0.5);
    g.moveTo(x + s * 0.12, y - s * 0.48);
    g.lineTo(x + s * 0.1, y + s * 0.5);
    g.stroke();
  }
  ellipse(g, x, y + s / 2, wb / 2, Math.max(0.6, s * 0.05), rgba('#ffe7a0', 0.9));
}

/** Inner light of a sky lantern (lights pass). */
export function skyLanternGlow(g: Ctx, x: number, y: number, s: number, k = 1) {
  glow(g, x, y, s * 2.4, '#ff8a2a', 0.18 * k);
  withBlend(g, 'lighter', () => {
    g.globalAlpha = Math.min(1, 0.55 * k);
    dot(g, lightSprite('#ffb24a', '#fff6d8'), x, y + s * 0.15, s * 0.75);
    g.globalAlpha = Math.min(1, k);
    dot(g, lightSprite('#ffd27a', '#ffffff'), x, y + s * 0.44, Math.max(1.2, s * 0.2));
  });
}

// ------------------------------------------------------------------ water
export interface ReflectOpts {
  /** Reflections are this many times taller than their source band. */
  stretch: number;
  alpha: number;
  /** Horizontal ripple amplitude in px (at the near edge). */
  amp: number;
  strips: number;
  op?: GlobalCompositeOperation;
  phase?: number;
  /** Downscale factor of the mirrored image (softens it). */
  blur?: number;
}

/**
 * Mirrors the band of `src` just above the waterline `wl` into the water
 * between `wl` and `y1`, in thin strips shifted sideways like ripples.
 * Only `drawImage` calls (no pixel loops).
 */
export function reflect(g: Ctx, src: AnyCanvas, w: number, wl: number, y1: number, o: ReflectOpts) {
  const H = y1 - wl;
  const mh = Math.max(2, Math.min(wl, H / o.stretch));
  // a softened (downscaled) mirror image: rippled water never reflects crisply
  const k = Math.max(1, o.blur ?? 1);
  const tw = Math.max(2, Math.round(w / k));
  const th = Math.max(2, Math.round(mh / k));
  const T = makeCanvas(tw, th);
  const tg = ctx2d(T);
  tg.imageSmoothingEnabled = true;
  tg.translate(0, th);
  tg.scale(1, -1);
  tg.drawImage(src as CanvasImageSource, 0, wl - mh, w, mh, 0, 0, tw, th);
  const ph = o.phase ?? 0;
  withState(g, () => {
    g.globalCompositeOperation = o.op ?? 'source-over';
    g.imageSmoothingEnabled = true;
    const n = o.strips;
    for (let i = 0; i < n; i++) {
      // strips get taller toward the viewer (perspective)
      const t0 = Math.pow(i / n, 1.35);
      const t1 = Math.pow((i + 1) / n, 1.35);
      const dy = wl + H * t0;
      const dh = H * (t1 - t0);
      const sy = th * t0;
      const sh = Math.max(0.25, th * (t1 - t0));
      const dx = o.amp * (0.25 + t1) * (Math.sin(i * 1.13 + ph) * 0.65 + Math.sin(i * 0.37 + ph * 2.1) * 0.35);
      const a = o.alpha * (1 - 0.5 * t0);
      g.globalAlpha = a * 0.6;
      g.drawImage(T as CanvasImageSource, 0, sy, tw, sh, dx, dy, w, dh + 0.6);
      g.globalAlpha = a * 0.4;
      g.drawImage(T as CanvasImageSource, 0, sy, tw, sh, -dx * 0.8 + o.amp * 0.3, dy, w, dh + 0.6);
    }
  });
}

/** Shimmering column of horizontal ripple dashes (moon path, light reflections). */
export function lightPath(g: Ctx, rng: Rng, x: number, y0: number, y1: number, width0: number, width1: number, color: string, alpha: number, n: number, thick: number) {
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rng(), 0.8);
      const y = lerp(y0, y1, t);
      const spread = lerp(width0, width1, t);
      const cx = x + gauss(rng) * spread * 0.45;
      const len = spread * rand(rng, 0.08, 0.35) * (1 - 0.5 * Math.abs(cx - x) / (spread + 1));
      g.strokeStyle = rgba(color, alpha * rand(rng, 0.3, 1) * (1 - 0.55 * t));
      g.lineWidth = thick * (0.6 + t);
      g.beginPath();
      g.moveTo(cx - len / 2, y);
      g.lineTo(cx + len / 2, y);
      g.stroke();
    }
  });
}

// ------------------------------------------------------------------ deepstambh
/**
 * Deepmal: a stone lamp tower of stacked rings, each lined with little
 * lamps (base pass). Stands on (x, base), `H` tall. Returns the flame points.
 */
export function deepstambh(g: Ctx, rng: Rng, x: number, base: number, H: number): Pt[] {
  const flames: Pt[] = [];
  const stone = (x0: number, x1: number, lit = 0.5) => {
    const grd = g.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, '#1e1010');
    grd.addColorStop(0.3, mix('#6a4032', '#c07a50', lit));
    grd.addColorStop(0.5, mix('#7a4c38', '#e0a070', lit));
    grd.addColorStop(1, '#1a0c0e');
    return grd;
  };
  wash(g, x, base, H * 0.3, H * 0.04, '#000000', 0.6);
  // plinth
  g.fillStyle = stone(x - H * 0.16, x + H * 0.16, 0.3);
  g.fillRect(x - H * 0.16, base - H * 0.045, H * 0.32, H * 0.045);
  g.fillStyle = stone(x - H * 0.12, x + H * 0.12, 0.4);
  g.fillRect(x - H * 0.12, base - H * 0.085, H * 0.24, H * 0.042);
  const top = base - H * 0.86;
  const tiers = 7;
  const ys: number[] = [];
  for (let k = 0; k < tiers; k++) ys.push(lerp(base - H * 0.2, top + H * 0.05, k / (tiers - 1)));
  const shaftW = (y: number) => lerp(H * 0.06, H * 0.04, (base - y) / (base - top));
  const shaft = (y0: number, y1: number) => {
    const a = shaftW(y0);
    const b = shaftW(y1);
    g.beginPath();
    g.moveTo(x - a, y0);
    g.lineTo(x - b, y1);
    g.lineTo(x + b, y1);
    g.lineTo(x + a, y0);
    g.closePath();
    g.fillStyle = stone(x - a, x + a, 0.55);
    g.fill();
  };
  shaft(base - H * 0.085, ys[0]);
  for (let k = 0; k < tiers; k++) {
    const y = ys[k];
    const R = lerp(H * 0.15, H * 0.075, k / (tiers - 1));
    const ry = R * 0.26;
    // ring: dark rim then lit top
    ellipse(g, x, y + ry * 0.45, R, ry, '#24120e');
    const tg = g.createRadialGradient(x, y + ry * 0.4, R * 0.1, x, y, R);
    tg.addColorStop(0, '#d89060');
    tg.addColorStop(0.6, '#8a5038');
    tg.addColorStop(1, '#3a1e18');
    ellipse(g, x, y, R, ry, tg);
    const n = k < tiers - 2 ? 5 : 4;
    const lamp = (a: number) => {
      const px = x + Math.cos(a) * R * 0.84;
      const py = y + Math.sin(a) * ry * 0.84;
      ellipse(g, px, py, R * 0.11, R * 0.05, '#a24a22');
      flames.push({ x: px + rand(rng, -0.2, 0.2), y: py - R * 0.03 });
    };
    // lamps on the far side of the ring, partly hidden by the shaft
    for (let j = 0; j < 3; j++) lamp(Math.PI * (1.2 + 0.3 * j));
    shaft(y, k + 1 < tiers ? ys[k + 1] : top);
    for (let j = 0; j < n; j++) lamp(Math.PI * (0.08 + (0.84 * j) / (n - 1)));
  }
  // capital with a kalash
  g.fillStyle = stone(x - H * 0.05, x + H * 0.05, 0.6);
  g.beginPath();
  g.moveTo(x - H * 0.05, top);
  g.quadraticCurveTo(x - H * 0.05, top - H * 0.06, x, top - H * 0.07);
  g.quadraticCurveTo(x + H * 0.05, top - H * 0.06, x + H * 0.05, top);
  g.fill();
  ellipse(g, x, top - H * 0.085, H * 0.018, H * 0.02, '#c08a40');
  flames.push({ x, y: top - H * 0.1 });
  return flames;
}

/**
 * Big straw umbrella of the Varanasi ghats, standing on (x, base); `s` is the
 * canopy width (base pass).
 */
export function ghatUmbrella(g: Ctx, x: number, base: number, s: number, lean = 0) {
  const top = base - s * 0.62;
  g.strokeStyle = '#2a160e';
  g.lineWidth = Math.max(1.5, s * 0.035);
  g.beginPath();
  g.moveTo(x, base);
  g.lineTo(x + lean * s, top);
  g.stroke();
  const cx = x + lean * s;
  g.beginPath();
  g.moveTo(cx - s * 0.5, top + s * 0.05);
  g.quadraticCurveTo(cx - s * 0.2, top - s * 0.16, cx, top - s * 0.2);
  g.quadraticCurveTo(cx + s * 0.2, top - s * 0.16, cx + s * 0.5, top + s * 0.05);
  g.quadraticCurveTo(cx, top - s * 0.02, cx - s * 0.5, top + s * 0.05);
  const grd = g.createLinearGradient(0, top - s * 0.2, 0, top + s * 0.05);
  grd.addColorStop(0, '#4a2a1a');
  grd.addColorStop(0.7, '#8a5a32');
  grd.addColorStop(1, '#d0904a');
  g.fillStyle = grd;
  g.fill();
  // underside lit by the diyas below
  g.beginPath();
  g.ellipse(cx, top + s * 0.035, s * 0.48, s * 0.03, 0, 0, Math.PI);
  g.fillStyle = rgba('#ffb060', 0.6);
  g.fill();
}

// ------------------------------------------------------------------ floating diyas & boats
/** Leaf-boat (dona) diya floating on water (base pass). Returns the flame point. */
export function floatingDiya(g: Ctx, rng: Rng, x: number, y: number, s: number): Pt {
  wash(g, x, y + s * 0.05, s * 0.9, s * 0.16, '#000000', 0.4);
  // leaf boat
  g.beginPath();
  g.moveTo(x - s * 0.55, y - s * 0.04);
  g.quadraticCurveTo(x, y + s * 0.24, x + s * 0.55, y - s * 0.04);
  g.quadraticCurveTo(x, y + s * 0.02, x - s * 0.55, y - s * 0.04);
  g.fillStyle = '#2a5a22';
  g.fill();
  // marigold petals in the boat
  for (let i = 0; i < 4; i++) {
    const px = x + rand(rng, -0.35, 0.35) * s;
    const py = y + rand(rng, 0, 0.06) * s;
    if (s > 6) ellipse(g, px, py, s * 0.09, s * 0.06, i % 2 ? '#ff8a00' : '#ffc23d');
  }
  // clay diya
  g.beginPath();
  g.ellipse(x, y - s * 0.02, s * 0.2, s * 0.09, 0, 0, Math.PI);
  g.fillStyle = '#b4532a';
  g.fill();
  ellipse(g, x, y - s * 0.03, s * 0.2, s * 0.05, '#4a2008');
  return { x: x + s * 0.05, y: y - s * 0.05 };
}

/** Wooden ghat boat seen side-on (base pass). Returns lamp points along the gunwale. */
export function boat(g: Ctx, x: number, y: number, L: number, dir: 1 | -1 = 1): Pt[] {
  const d = dir;
  wash(g, x, y + L * 0.05, L * 0.6, L * 0.05, '#000000', 0.5);
  const hull = () => {
    g.beginPath();
    g.moveTo(x - d * L * 0.5, y - L * 0.075);
    g.quadraticCurveTo(x - d * L * 0.38, y + L * 0.06, x, y + L * 0.065);
    g.quadraticCurveTo(x + d * L * 0.36, y + L * 0.06, x + d * L * 0.52, y - L * 0.1);
    g.lineTo(x + d * L * 0.46, y - L * 0.03);
    g.lineTo(x - d * L * 0.44, y - L * 0.02);
    g.closePath();
  };
  hull();
  const grd = g.createLinearGradient(0, y - L * 0.08, 0, y + L * 0.07);
  grd.addColorStop(0, '#7a4a2a');
  grd.addColorStop(0.35, '#4a2a1a');
  grd.addColorStop(1, '#140806');
  g.fillStyle = grd;
  g.fill();
  // painted band
  g.strokeStyle = rgba('#d63a3a', 0.85);
  g.lineWidth = Math.max(1.5, L * 0.012);
  g.beginPath();
  g.moveTo(x - d * L * 0.45, y - L * 0.01);
  g.quadraticCurveTo(x, y + L * 0.025, x + d * L * 0.47, y - L * 0.02);
  g.stroke();
  g.strokeStyle = rgba('#ffc860', 0.5);
  g.lineWidth = Math.max(1, L * 0.006);
  g.beginPath();
  g.moveTo(x - d * L * 0.45, y - L * 0.025);
  g.lineTo(x + d * L * 0.46, y - L * 0.035);
  g.stroke();
  const lamps: Pt[] = [];
  for (let i = 0; i < 6; i++) {
    const t = -0.36 + (0.72 * i) / 5;
    lamps.push({ x: x + d * L * t, y: y - L * 0.03 - L * 0.012 * t });
  }
  return lamps;
}

/** Reflection of a small flame on the water: a few warm ripple dashes (lights pass). */
export function flameReflection(g: Ctx, rng: Rng, x: number, y: number, s: number, len: number) {
  withBlend(g, 'lighter', () => {
    g.lineCap = 'round';
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = (i + rand(rng, 0, 0.6)) / n;
      const yy = y + len * t;
      const half = s * rand(rng, 0.25, 0.7) * (1 - t * 0.4);
      g.strokeStyle = rgba(i < 2 ? '#ffe2a0' : '#ffa040', 0.75 * (1 - t));
      g.lineWidth = Math.max(0.8, s * 0.12);
      g.beginPath();
      g.moveTo(x - half + gauss(rng) * s * 0.1, yy);
      g.lineTo(x + half + gauss(rng) * s * 0.1, yy);
      g.stroke();
    }
  });
}

/** Scatter of loose marigold and rose petals (base pass). */
export function petalScatter(g: Ctx, rng: Rng, x0: number, y0: number, x1: number, y1: number, n: number, size: number) {
  for (let i = 0; i < n; i++) {
    const x = rand(rng, x0, x1);
    const y = rand(rng, y0, y1);
    const s = size * rand(rng, 0.6, 1.2) * (0.6 + 0.6 * ((y - y0) / Math.max(1, y1 - y0)));
    const c = rng() < 0.45 ? '#ff8a00' : rng() < 0.6 ? '#ffc23d' : rng() < 0.7 ? '#d6247b' : '#e2412b';
    g.beginPath();
    g.ellipse(x, y, s, s * 0.5, rand(rng, 0, TAU), 0, TAU);
    g.fillStyle = c;
    g.fill();
  }
}
