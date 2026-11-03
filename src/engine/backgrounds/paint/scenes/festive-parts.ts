/**
 * Decoration primitives for the 'festive' scene: rich toran, akash kandil,
 * silk drapes, block-print wall pattern, lotus arrangement in a brass urli on
 * a stand and a detailed powder rangoli. Fixed randomness per call.
 */
import { TAU, bell, ellipse, lerp, mix, rgba, wash, withState, type Ctx, type Pt, type Rng } from '../kit';
import { brassH, clayDiya, fork, genda, lathe, leafSimple, lotusPad, lotusSide, rose, type Flame } from './diyas-parts';

// ------------------------------------------------------------------ wall
/** Paisley (ambi) outline as a sub-path; `f` = 1 or -1 mirrors it. */
function paisleyPath(g: Ctx, x: number, y: number, s: number, f: number) {
  g.moveTo(x - f * s * 0.38, y + s * 0.15);
  g.bezierCurveTo(x - f * s * 0.42, y - s * 0.42, x - f * s * 0.02, y - s * 0.78, x + f * s * 0.38, y - s * 0.82);
  g.bezierCurveTo(x + f * s * 0.1, y - s * 0.6, x + f * s * 0.4, y - s * 0.3, x + f * s * 0.38, y + s * 0.15);
  g.bezierCurveTo(x + f * s * 0.36, y + s * 0.55, x - f * s * 0.36, y + s * 0.55, x - f * s * 0.38, y + s * 0.15);
  g.closePath();
}

/** Half-drop block-print pattern of paisleys and dots (one fill each). */
export function butiPattern(g: Ctx, x0: number, y0: number, x1: number, y1: number, step: number, color: string, alpha: number) {
  const cols = Math.ceil((x1 - x0) / step) + 1;
  const rows = Math.ceil((y1 - y0) / step) + 1;
  g.beginPath();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * step + (r % 2 ? step / 2 : 0);
      const y = y0 + r * step;
      paisleyPath(g, x, y, step * 0.36, (r + c) % 2 ? 1 : -1);
    }
  g.fillStyle = rgba(color, alpha);
  g.fill();
  g.beginPath();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * step + (r % 2 ? 0 : step / 2);
      const y = y0 + r * step;
      g.moveTo(x + step * 0.05, y);
      g.arc(x, y, step * 0.05, 0, TAU);
    }
  g.fillStyle = rgba(color, alpha * 0.8);
  g.fill();
}

/**
 * Silk drape hanging at one edge, pleated, with a zari border on its inner
 * edge and a tie-back at `tieY`. side = -1 (left edge) or 1 (right edge).
 */
export function drape(g: Ctx, side: -1 | 1, w: number, h: number, width: number, top: number, tieY: number, bottom: number, color: string, border: string) {
  const ex = side < 0 ? -width * 0.1 : w + width * 0.1; // outer edge
  const ix = side < 0 ? width : w - width; // inner edge at top
  const tx = side < 0 ? width * 0.45 : w - width * 0.45; // pinched at the tie
  const bx = side < 0 ? width * 0.8 : w - width * 0.8; // flare at the floor
  const inner = (p: (x: number, y: number) => void) => {
    p(ix, top);
    return [
      [ix, lerp(top, tieY, 0.5), tx, lerp(top, tieY, 0.8), tx, tieY],
      [tx, lerp(tieY, bottom, 0.3), bx, lerp(tieY, bottom, 0.6), bx, bottom],
    ] as const;
  };
  g.beginPath();
  g.moveTo(ex, top);
  const segs = inner((x, y) => g.lineTo(x, y));
  for (const s of segs) g.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
  g.lineTo(ex, bottom);
  g.closePath();
  const pg = g.createLinearGradient(ex, 0, bx, 0);
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pg.addColorStop(t, i % 2 ? mix(color, '#000000', 0.45) : mix(color, '#9ff0e8', 0.18));
  }
  g.fillStyle = pg;
  g.fill();
  // shade toward the floor and the wall edge
  const sg = g.createLinearGradient(0, top, 0, bottom);
  sg.addColorStop(0, 'rgba(0,0,0,0.1)');
  sg.addColorStop(0.5, 'rgba(0,0,0,0)');
  sg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = sg;
  g.fill();
  // zari border along the inner edge
  g.beginPath();
  g.moveTo(ix, top);
  for (const s of segs) g.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
  g.strokeStyle = border;
  g.lineWidth = width * 0.13;
  g.stroke();
  g.strokeStyle = rgba('#fff0b0', 0.5);
  g.lineWidth = width * 0.025;
  g.stroke();
  // tie-back sash with a tassel
  ellipse(g, tx - side * width * 0.2, tieY, width * 0.42, width * 0.09, border, side * 0.15);
  g.strokeStyle = border;
  g.lineWidth = width * 0.04;
  g.beginPath();
  g.moveTo(tx + side * width * 0.05, tieY);
  g.quadraticCurveTo(tx + side * width * 0.12, tieY + width * 0.3, tx + side * width * 0.05, tieY + width * 0.55);
  g.stroke();
  ellipse(g, tx + side * width * 0.05, tieY + width * 0.62, width * 0.06, width * 0.12, mix(border, '#7a4a0a', 0.3));
}

// ------------------------------------------------------------------ toran
/**
 * Rich toran across the top: brocade band with mirror work, alternating
 * fabric flaps with bells, mango leaves and marigold drops.
 */
export function richToran(g: Ctx, rng: Rng, x0: number, x1: number, y: number, size: number) {
  const r = fork(rng);
  const bh = size * 0.6;
  const unit = size * 0.62;
  const n = Math.ceil((x1 - x0) / unit);
  // hanging pieces first (behind the band)
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * unit;
    const yb = y + bh * 0.45;
    const a = (r() - 0.5) * 0.16;
    if (i % 2 === 0) {
      // fabric flap
      const fw = unit * 0.5;
      const fh = size * 0.9;
      g.beginPath();
      g.moveTo(x - fw, yb);
      g.lineTo(x + a * fh, yb + fh);
      g.lineTo(x + fw, yb);
      g.closePath();
      const col = i % 4 === 0 ? '#0b7f86' : '#c2185b';
      const fg = g.createLinearGradient(0, yb, 0, yb + fh);
      fg.addColorStop(0, mix(col, '#000000', 0.25));
      fg.addColorStop(1, mix(col, '#ffffff', 0.12));
      g.fillStyle = fg;
      g.fill();
      g.strokeStyle = '#e8b84a';
      g.lineWidth = Math.max(1, size * 0.04);
      g.stroke();
      ellipse(g, x + a * fh * 0.4, yb + fh * 0.35, size * 0.07, size * 0.07, '#fff3d0');
      bell(g, x + a * fh, yb + fh + size * 0.08, size * 0.11);
    } else {
      leafSimple(g, x - unit * 0.12, yb, size * 0.85, Math.PI / 2 + 0.25 + a, '#2f7a2c');
      leafSimple(g, x + unit * 0.12, yb, size * 0.85, Math.PI / 2 - 0.25 + a, '#3a8a30');
      genda(g, r, x, yb + size * 0.3, size * 0.17, '#ffb000');
      genda(g, r, x, yb + size * 0.6, size * 0.15, '#ff7a00');
      genda(g, r, x, yb + size * 0.86, size * 0.12, '#e2412b');
    }
  }
  // brocade band
  const bg = g.createLinearGradient(0, y - bh / 2, 0, y + bh / 2);
  bg.addColorStop(0, '#9a1030');
  bg.addColorStop(0.5, '#d42a3c');
  bg.addColorStop(1, '#7a0a26');
  g.fillStyle = bg;
  g.fillRect(x0, y - bh / 2, x1 - x0, bh);
  const gb = Math.max(1, bh * 0.16);
  g.fillStyle = '#e8b84a';
  g.fillRect(x0, y - bh / 2, x1 - x0, gb);
  g.fillRect(x0, y + bh / 2 - gb, x1 - x0, gb);
  // mirror work and embroidered diamonds
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * unit;
    ellipse(g, x, y, bh * 0.24, bh * 0.24, '#e8b84a');
    const mg = g.createRadialGradient(x - bh * 0.06, y - bh * 0.06, 0, x, y, bh * 0.18);
    mg.addColorStop(0, '#ffffff');
    mg.addColorStop(1, '#a8b0c0');
    ellipse(g, x, y, bh * 0.17, bh * 0.17, mg);
    const dx = x + unit / 2;
    g.beginPath();
    g.moveTo(dx, y - bh * 0.22);
    g.lineTo(dx + bh * 0.14, y);
    g.lineTo(dx, y + bh * 0.22);
    g.lineTo(dx - bh * 0.14, y);
    g.closePath();
    g.fillStyle = i % 2 ? '#ffc23d' : '#2fb5a8';
    g.fill();
  }
}

// ------------------------------------------------------------------ lantern
/**
 * Akash kandil: paper lantern with pyramid top and bottom, a cut-work band and
 * long paper tails. Body centred at (x, cy), width s, hung from (x, top).
 */
export function kandil(g: Ctx, rng: Rng, x: number, top: number, cy: number, s: number, c1: string, c2: string) {
  const r = fork(rng);
  g.strokeStyle = 'rgba(40,20,10,0.8)';
  g.lineWidth = Math.max(1, s * 0.015);
  g.beginPath();
  g.moveTo(x, top);
  g.lineTo(x, cy - s * 0.72);
  g.stroke();
  // tails
  const tails = 9;
  for (let i = 0; i < tails; i++) {
    const t = (i + 0.5) / tails;
    const tx = x + (t - 0.5) * s * 0.9;
    const L = s * (1.1 + 0.6 * Math.sin(t * Math.PI)) * (0.9 + r() * 0.2);
    const y0 = cy + s * 0.12;
    const wv = s * 0.05 * (r() - 0.5);
    g.beginPath();
    g.moveTo(tx - s * 0.035, y0);
    g.quadraticCurveTo(tx + wv, y0 + L * 0.5, tx + wv * 2 - s * 0.02, y0 + L);
    g.lineTo(tx + wv * 2 + s * 0.02, y0 + L);
    g.quadraticCurveTo(tx + wv + s * 0.04, y0 + L * 0.5, tx + s * 0.035, y0);
    g.closePath();
    g.fillStyle = i % 3 === 0 ? '#ffd166' : i % 2 ? c1 : c2;
    g.fill();
  }
  const lit = mix(c1, '#fff2c0', 0.4);
  const dark = mix(c1, '#2a0610', 0.4);
  const panel = (pts: number[][], fill: string | CanvasGradient) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = '#f2c860';
    g.lineWidth = Math.max(1, s * 0.022);
    g.stroke();
  };
  const yT = cy - s * 0.7;
  const yU = cy - s * 0.18;
  const yL = cy + s * 0.14;
  const yB = cy + s * 0.62;
  // upper pyramid: three visible faces
  panel([[x - s * 0.08, yT], [x - s * 0.5, yU], [x - s * 0.22, yU], [x - s * 0.03, yT]], dark);
  panel([[x + s * 0.08, yT], [x + s * 0.5, yU], [x + s * 0.22, yU], [x + s * 0.03, yT]], dark);
  panel([[x - s * 0.03, yT], [x - s * 0.22, yU], [x + s * 0.22, yU], [x + s * 0.03, yT]], lit);
  // middle band
  const mg = g.createLinearGradient(x - s * 0.5, 0, x + s * 0.5, 0);
  mg.addColorStop(0, mix(c2, '#000000', 0.35));
  mg.addColorStop(0.5, mix(c2, '#fff0c0', 0.35));
  mg.addColorStop(1, mix(c2, '#000000', 0.35));
  panel([[x - s * 0.5, yU], [x + s * 0.5, yU], [x + s * 0.5, yL], [x - s * 0.5, yL]], mg);
  // cut-work diamonds in the band
  for (let i = -2; i <= 2; i++) {
    const dx = x + i * s * 0.18;
    const dy = (yU + yL) / 2;
    g.beginPath();
    g.moveTo(dx, dy - s * 0.1);
    g.lineTo(dx + s * 0.06, dy);
    g.lineTo(dx, dy + s * 0.1);
    g.lineTo(dx - s * 0.06, dy);
    g.closePath();
    g.fillStyle = Math.abs(i) === 2 ? rgba('#ffe9a8', 0.5) : '#fff3c8';
    g.fill();
  }
  // lower pyramid
  panel([[x - s * 0.5, yL], [x - s * 0.22, yL], [x - s * 0.04, yB], [x - s * 0.1, yB]], dark);
  panel([[x + s * 0.5, yL], [x + s * 0.22, yL], [x + s * 0.04, yB], [x + s * 0.1, yB]], dark);
  panel([[x - s * 0.22, yL], [x + s * 0.22, yL], [x + s * 0.04, yB], [x - s * 0.04, yB]], lit);
  // cap and finial
  g.fillStyle = '#c8901e';
  g.fillRect(x - s * 0.1, yT - s * 0.05, s * 0.2, s * 0.06);
  ellipse(g, x, yB + s * 0.03, s * 0.05, s * 0.05, '#e8b84a');
}

// ------------------------------------------------------------------ urli arrangement
/**
 * Lotus arrangement in a brass urli on a turned brass stand, standing at
 * (x, baseY); W = urli width. Returns flames of the small diyas at its foot.
 */
export function flowerUrli(g: Ctx, rng: Rng, x: number, baseY: number, W: number, mirror = 1): Flame[] {
  const r = fork(rng);
  const T = 0.26;
  wash(g, x, baseY, W * 0.55, W * 0.08, '#000000', 0.55);
  const stand: [number, number][] = [
    [0, 0.22], [0.012, 0.23], [0.03, 0.2], [0.06, 0.13], [0.09, 0.08], [0.12, 0.065], [0.15, 0.085], [0.18, 0.06], [0.22, 0.06], [0.25, 0.1], [0.28, 0.16], [0.3, 0.18],
  ].map(([a, b]) => [a * W, b * W] as [number, number]);
  lathe(g, x, baseY, stand, brassH(g, x - W * 0.23, x + W * 0.23, 0.4), T);
  for (const [hh, rr] of [[0.012, 0.23], [0.15, 0.085], [0.3, 0.18]] as const) {
    g.strokeStyle = 'rgba(255,236,170,0.5)';
    g.lineWidth = Math.max(0.8, W * 0.006);
    g.beginPath();
    g.ellipse(x, baseY - hh * W, rr * W, rr * W * T, 0, 0.08 * Math.PI, 0.92 * Math.PI);
    g.stroke();
  }
  const bowlBase = 0.3;
  const bowl: [number, number][] = [[bowlBase, 0.14], [bowlBase + 0.04, 0.3], [bowlBase + 0.1, 0.44], [bowlBase + 0.16, 0.49], [bowlBase + 0.2, 0.5]].map(
    ([a, b]) => [a * W, b * W] as [number, number],
  );
  const yR = baseY - (bowlBase + 0.2) * W;
  const rx = W * 0.5;
  const ry = rx * T;
  // leaves and pads behind the rim
  const m = mirror;
  lotusPad(g, x - m * W * 0.36, yR - W * 0.1, W * 0.24, 0.5, -0.6 * m);
  lotusPad(g, x + m * W * 0.4, yR - W * 0.06, W * 0.2, 0.45, 2.2 * m);
  lotusPad(g, x + m * W * 0.05, yR - W * 0.14, W * 0.26, 0.42, 1.2);
  // stems
  const blooms: [number, number, number, string, number][] = [
    [0.04, -0.86, 0.15, '#e85590', 0.22],
    [-0.21, -0.52, 0.27, '#e0457f', 1],
    [0.23, -0.58, 0.28, '#ec5f97', 1],
    [-0.02, -0.28, 0.27, '#f07aa8', 1],
    [-0.4, -0.18, 0.21, '#e85590', 0.9],
    [0.42, -0.21, 0.2, '#e0457f', 0.9],
  ];
  g.strokeStyle = '#3a6a2a';
  g.lineWidth = Math.max(1, W * 0.014);
  for (const [bx, by] of blooms) {
    g.beginPath();
    g.moveTo(x + m * bx * W * 0.7, yR);
    g.quadraticCurveTo(x + m * bx * W * 0.9, yR + by * W * 0.5, x + m * bx * W, yR + by * W);
    g.stroke();
  }
  // bowl
  lathe(g, x, baseY, bowl, brassH(g, x - rx, x + rx, 0.38), T);
  ellipse(g, x, yR, rx, ry, brassH(g, x - rx, x + rx, 0.6, 0.2));
  ellipse(g, x, yR + ry * 0.1, rx * 0.88, ry * 0.7, '#2a1405');
  for (const [bx, by, bs, c, open] of blooms) lotusSide(g, x + m * bx * W, yR + by * W, bs * W, c, open);
  // marigolds and roses spilling over the front rim
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.05 + (0.9 * i) / 8);
    const px = x + Math.cos(a) * rx * 0.9;
    const py = yR + Math.sin(a) * ry * 0.75 - W * 0.02;
    if (i % 4 === 2) rose(g, r, px, py, W * 0.055, '#b0102a', 0.85);
    else genda(g, r, px, py, W * 0.062, i % 2 ? '#ffb000' : '#ff7a00', 0.9);
  }
  // jasmine strings draped over the front of the bowl
  g.fillStyle = '#fffaf0';
  for (let k = 0; k < 2; k++) {
    const a0 = { x: x - rx * (0.8 - k * 0.5), y: yR + ry * 0.6 };
    const a1 = { x: x + rx * (0.3 + k * 0.5), y: yR + ry * 0.6 };
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const px = lerp(a0.x, a1.x, t);
      const py = lerp(a0.y, a1.y, t) + W * (0.1 + k * 0.05) * 4 * t * (1 - t);
      ellipse(g, px, py, W * 0.016, W * 0.012, i % 5 === 2 ? '#ff9ab8' : '#fffaf0');
    }
  }
  // small diyas at the foot
  const flames: Flame[] = [];
  for (const [dx, dir] of [[-0.42, -1], [0.42, 1]] as const) {
    const s = W * 0.17;
    const p = clayDiya(g, x + dx * W, baseY - W * 0.01, s, { clay: '#b4532a', band: '#ffcf4a', dots: '#fff4d0', dir, shadow: 0.4 });
    flames.push({ x: p.x, y: p.y, h: s * 0.55, halo: 0.9 });
  }
  return flames;
}

// ------------------------------------------------------------------ rangoli
/**
 * Detailed powder rangoli in perspective with chalk-white outlines and a ring
 * of diyas. Returns the flames.
 */
export function powderRangoli(g: Ctx, rng: Rng, cx: number, cy: number, R: number, tilt: number, nDiyas: number): Flame[] {
  const r = fork(rng);
  const white = 'rgba(255,250,238,0.92)';
  const lw = R * 0.014;
  wash(g, cx, cy, R * 1.3, R * 1.3 * tilt, '#000000', 0.3);
  withState(g, () => {
    g.translate(cx, cy);
    g.scale(1, tilt);
    const circle = (rr: number, fill: string) => ellipse(g, 0, 0, rr, rr, fill);
    const ring = (rr: number) => {
      g.strokeStyle = white;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(0, 0, rr, 0, TAU);
      g.stroke();
    };
    const petal = (a: number, r0: number, r1: number, half: number, fill: string, bulge = 1) => {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -sa;
      const ny = ca;
      const mr = (r0 + r1) / 2;
      const wdt = mr * Math.sin(half) * bulge;
      g.beginPath();
      g.moveTo(Math.cos(a - half) * r0, Math.sin(a - half) * r0);
      g.quadraticCurveTo(ca * mr - nx * wdt * 1.3, sa * mr - ny * wdt * 1.3, ca * r1, sa * r1);
      g.quadraticCurveTo(ca * mr + nx * wdt * 1.3, sa * mr + ny * wdt * 1.3, Math.cos(a + half) * r0, Math.sin(a + half) * r0);
      g.closePath();
      g.fillStyle = fill;
      g.fill();
      g.strokeStyle = white;
      g.lineWidth = lw;
      g.stroke();
    };
    // outer petal crown
    circle(R * 0.74, '#4a1060');
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      petal(a, R * 0.7, R, Math.PI / N, i % 2 ? '#d6247b' : '#ff7a00');
      petal(a, R * 0.72, R * 0.9, (Math.PI / N) * 0.5, i % 2 ? '#ffc23d' : '#fff1d6', 0.8);
      ellipse(g, Math.cos(a) * R * 1.04, Math.sin(a) * R * 1.04, R * 0.026, R * 0.026, '#fff4e0');
      const b = a + Math.PI / N;
      ellipse(g, Math.cos(b) * R * 0.86, Math.sin(b) * R * 0.86, R * 0.03, R * 0.03, '#1fb5a8');
    }
    // peacock band with white dots
    circle(R * 0.72, '#0b7f86');
    circle(R * 0.6, '#ffc23d');
    ring(R * 0.72);
    g.fillStyle = white;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, R * 0.016, 0, TAU);
      g.fill();
    }
    ring(R * 0.6);
    // eight lotus petals
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      petal(a, R * 0.26, R * 0.6, Math.PI / 8, i % 2 ? '#e2412b' : '#d6247b', 0.9);
      petal(a, R * 0.3, R * 0.5, Math.PI / 16, '#ff9a1f', 0.8);
    }
    // violet ring and the centre flower
    circle(R * 0.28, '#5b2a86');
    ring(R * 0.28);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      petal(a, R * 0.04, R * 0.25, Math.PI / 9, i % 2 ? '#fff4e0' : '#e2412b', 1);
    }
    circle(R * 0.07, '#ffd23a');
    // powder grain
    for (let i = 0; i < 260; i++) {
      const a = r() * TAU;
      const d = R * Math.sqrt(r()) * 0.98;
      const lt = r() < 0.5;
      const al = 0.05 + r() * 0.1;
      g.fillStyle = lt ? `rgba(255,255,255,${al})` : `rgba(0,0,0,${al})`;
      g.fillRect(Math.cos(a) * d, Math.sin(a) * d, R * 0.008, R * 0.008);
    }
  });
  const flames: Flame[] = [];
  const ang = (i: number) => (i / nDiyas) * TAU + Math.PI / nDiyas;
  const order = Array.from({ length: nDiyas }, (_, i) => i).sort((a, b) => Math.sin(ang(a)) - Math.sin(ang(b)));
  const bands = ['#ffcf4a', '#2fa58f', '#e8402a', '#d6247b'];
  for (const i of order) {
    const a = ang(i);
    const s = R * 0.15 * (1 + Math.sin(a) * 0.1);
    const p: Pt = clayDiya(g, cx + Math.cos(a) * R * 1.17, cy + Math.sin(a) * R * 1.17 * tilt, s, {
      clay: i % 2 ? '#b4532a' : '#c2652f',
      band: bands[i % bands.length],
      dots: '#fff4d0',
      rim: '#ffd560',
      dir: Math.cos(a) > 0 ? 1 : -1,
      tilt: 0.36,
    });
    flames.push({ x: p.x, y: p.y, h: s * 0.52, halo: 1 });
  }
  return flames;
}
