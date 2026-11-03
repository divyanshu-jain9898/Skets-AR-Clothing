import type { NRect, SceneSpec } from '../scene';
import {
  type Bulb,
  type Ctx,
  type Pt,
  TAU,
  diya,
  diyaFlame,
  drawBulbs,
  ellipse,
  firework,
  glow,
  gradientSky,
  lantern,
  lanternGlow,
  marigoldGarland,
  marigoldStrand,
  mix,
  rand,
  rangoli,
  rgba,
  sagPath,
  smoke,
  sparkle,
  toran,
  vignette,
  wash,
  withState,
  withBlend,
  makeCanvas,
  ctx2d,
  anar,
  leaf,
  type BurstKind,
} from '../kit';
import {
  type Clump,
  type Flame,
  along,
  archPath,
  banglaPath,
  box,
  brass,
  bulbsOn,
  clipRect,
  clipTo,
  daubs,
  domePath,
  domePts,
  fillPoly,
  fork,
  kalash,
  leafyTree,
  lin,
  line,
  palmTree,
  pool,
  pottedPlant,
  scallops,
  shade,
  tulsi,
  band,
} from './house-parts';

const WARM = ['#ffd27a', '#ffe7a8', '#ffb547', '#ffd27a', '#fff0c8'] as const;
const FESTIVE = ['#ffcf6b', '#ff5fa2', '#ffcf6b', '#7fe0ff', '#ffcf6b', '#9dff8a', '#ffb347'] as const;
const TRIM = { lit: '#ecc796', mid: '#b98a66', shade: '#5e3a48', deep: '#2c1626' };

interface Lamp {
  x: number;
  y: number;
  s: number;
  color: string;
  i: number;
}

interface Opening {
  x: number;
  y: number;
  rx: number;
  ry: number;
  i: number;
}

interface Burst {
  x: number;
  y: number;
  r: number;
  color: string;
  kind: BurstKind;
}

/**
 * "Illuminated House": a two-storey haveli at night dressed for Diwali -
 * jharokhas with glowing interiors, a carved door under a toran, curtain and
 * scalloped fairy lights, akash kandils, rows of diyas, a rangoli at the
 * doorstep and fireworks in a moonless (amavasya) sky.
 */
export const house: SceneSpec = {
  id: 'house',
  compose(w, h, rng) {
    const u = Math.min(w, h);
    const port = w / h < 1.2;
    const hz = h * 0.57;
    const vx = w / 2;
    const fw = port ? w * 1.1 : Math.min(w * 0.72, h * 1.3);
    const x0 = vx - fw / 2;
    const x1 = vx + fw / 2;
    const gy = h * 0.775;
    const pt = h * (port ? 0.745 : 0.737);
    const f1 = h * (port ? 0.53 : 0.45);
    const roof = h * (port ? 0.335 : 0.22);
    const parTop = h * (port ? 0.298 : 0.175);
    const sh = pt - f1;
    const sh2 = f1 - roof;
    const focal = 0.55 * Math.max(w, h);
    const P = (x: number, y: number, k: number): Pt => ({ x: vx + (x - vx) * k, y: hz + (y - hz) * k });

    // ---- facade grid
    const towerW = fw * (port ? 0.08 : 0.075);
    const cb = fw * (port ? 0.36 : 0.26);
    const nb = port ? 1 : 2;
    const bw = (fw - 2 * towerW - cb) / (2 * nb);
    const bays: number[] = [];
    for (let i = 0; i < nb; i++) bays.push(vx - cb / 2 - bw * (i + 0.5), vx + cb / 2 + bw * (i + 0.5));
    const towers = [x0 + towerW / 2, x1 - towerW / 2];
    const tk = 1.03; // tower projection
    const wa = Math.min(bw * 0.26, sh * 0.2);
    const winSill = pt - sh * 0.2;
    const winTop = pt - sh * 0.8;
    const jw = Math.min(bw * 0.62, sh2 * 0.62);
    const jyb = f1 - sh2 * 0.14;
    const jtop = roof + sh2 * 0.12;
    const da = cb * 0.2;
    const doorTop = pt - sh * 0.78;
    const pa = da * 1.6;
    const portalTop = pt - sh * 0.93;
    const ba = cb * 0.42;
    const byb = f1 - sh2 * 0.1;
    const btop = roof + sh2 * 0.05;
    const sw = pa * 1.02;
    const stepK = [1, 1.045, 1.09, 1.135];
    const riser = (gy - pt) / 3;
    const kandils = port
      ? [vx - cb / 2 - bw * 0.5, vx + cb / 2 + bw * 0.5].map((x, i) => ({ x, y: f1 + sh * 0.14, s: u * 0.085, color: i ? '#e2412b' : '#ff8a1f' }))
      : [vx - cb / 2 - bw, vx + cb / 2 + bw].map((x, i) => ({ x, y: f1 + sh * 0.24, s: u * 0.085, color: i ? '#e2412b' : '#ff8a1f' }));

    // ---- sky / fireworks
    const bursts: Burst[] = port
      ? [
          { x: w * 0.19, y: h * 0.1, r: u * 0.17, color: '#ffcf6b', kind: 'willow' },
          { x: w * 0.85, y: h * 0.065, r: u * 0.13, color: '#ff4fa3', kind: 'peony' },
          { x: w * 0.45, y: h * 0.055, r: u * 0.05, color: '#7fd6ff', kind: 'chrysanthemum' },
        ]
      : [
          { x: w * 0.075, y: h * 0.2, r: u * 0.15, color: '#ffcf6b', kind: 'willow' },
          { x: w * 0.915, y: h * 0.095, r: u * 0.12, color: '#ff4fa3', kind: 'peony' },
          { x: w * 0.235, y: h * 0.05, r: u * 0.06, color: '#7fd6ff', kind: 'chrysanthemum' },
        ];
    const skyRects: NRect[] = port
      ? [
          [0.04, 0.03, 0.34, 0.17],
          [0.66, 0.03, 0.96, 0.17],
        ]
      : [
          [0.02, 0.04, 0.17, 0.36],
          [0.84, 0.03, 0.99, 0.2],
          [0.2, 0.02, 0.36, 0.1],
        ];

    // random streams
    const R = { sky: fork(rng), far: fork(rng), trees: fork(rng), wall: fork(rng), house: fork(rng), deco: fork(rng), yard: fork(rng), fx: fork(rng) };

    // collected light sources
    const bulbs: Bulb[] = [];
    const smallBulbs: Bulb[] = [];
    const flames: Flame[] = [];
    const openings: Opening[] = [];
    const lamps: Lamp[] = [];
    const farWindows: { x: number; y: number; w: number; h: number; c: string }[] = [];
    let neem: Clump[] = [];
    const farShapes: { x: number; y: number; w: number; h: number }[] = [];

    const addDiya = (g: Ctx, x: number, y: number, s: number, dir: 1 | -1 = 1, i = 1) => {
      const f = diya(g, x, y, s, { dir });
      flames.push({ x: f.x, y: f.y, s, i });
    };

    // house outline (also used for the sky mask)
    const pedTop = parTop - sh2 * (port ? 0.24 : 0.32);
    const silhouette = (g: Ctx) => {
      g.rect(x0, parTop, fw, gy - parTop + 2);
      // central pediment
      g.moveTo(vx - cb * 0.42, parTop + 1);
      g.quadraticCurveTo(vx - cb * 0.3, pedTop + (parTop - pedTop) * 0.25, vx, pedTop);
      g.quadraticCurveTo(vx + cb * 0.3, pedTop + (parTop - pedTop) * 0.25, vx + cb * 0.42, parTop + 1);
      g.closePath();
      for (const tx of towers) {
        const c = P(tx, parTop, tk);
        g.rect(c.x - towerW * 0.5, c.y - towerW * 0.62, towerW, towerW * 0.66);
        g.moveTo(c.x - towerW * 0.42, c.y - towerW * 0.6);
        domePath(g, c.x, c.y - towerW * 0.6, towerW * 0.4, towerW * 0.62);
      }
    };

    // ------------------------------------------------------------ sky
    function paintSky(g: Ctx) {
      const r = R.sky;
      gradientSky(g, 0, 0, w, hz * 1.08, [
        [0, '#04051a'],
        [0.25, '#0a0c34'],
        [0.5, '#1b1650'],
        [0.68, '#3a1d5c'],
        [0.8, '#682a5e'],
        [0.9, '#9a3c55'],
        [1, '#c2603e'],
      ]);
      box(g, 0, hz * 1.08, w, gy - hz * 1.08 + 2, '#c2603e');
      // brushy sky
      daubs(g, r, 0, 0, w, hz * 0.9, 150, ['#22226a', '#2e1f62', '#121446', '#4a2368'], u * 0.07, 0.16, 0, 0.12);
      daubs(g, r, 0, hz * 0.55, w, hz * 1.02, 70, ['#8a3a62', '#b24e50', '#5a2462'], u * 0.08, 0.14, 0, 0.08);
      // glow of the city on the horizon and the firework smoke lit from within
      pool(g, vx, hz * 1.02, w * 0.75, h * 0.16, '#ff8a3a', 0.22);
      smoke(g, r, 0, hz * 0.35, w, hz * 0.85, 9, '#7a3a6a', 0.14);
      for (const b of bursts) {
        glow(g, b.x, b.y, b.r * 1.9, b.color, 0.13);
        wash(g, b.x + b.r * 0.2, b.y + b.r * 0.55, b.r * 1.3, b.r * 0.45, mix(b.color, '#6a3a6a', 0.6), 0.16);
      }
    }

    // distant rooftops at the horizon (landscape only)
    function paintFar(g: Ctx) {
      const r = R.far;
      const base = gy - h * 0.05;
      for (const [a, b] of [
        [0, x0 + fw * 0.02],
        [x1 - fw * 0.02, w],
      ] as const) {
        let x = a - u * 0.02;
        while (x < b) {
          const bwid = u * rand(r, 0.05, 0.12);
          const bh = h * rand(r, 0.06, 0.15);
          const col = mix('#1d1236', '#4a2248', rand(r, 0, 0.35));
          box(g, x, base - bh, bwid + 1, bh, col);
          farShapes.push({ x, y: base - bh, w: bwid, h: bh });
          if (r() < 0.35) {
            g.beginPath();
            domePath(g, x + bwid / 2, base - bh, bwid * 0.22, bwid * 0.3);
            g.fillStyle = col;
            g.fill();
          }
          const ww = u * 0.007;
          for (let wy = base - bh + ww * 2; wy < base - ww * 3; wy += ww * 3)
            for (let wx = x + ww * 1.5; wx < x + bwid - ww * 1.5; wx += ww * 2.6)
              if (r() < 0.3) farWindows.push({ x: wx, y: wy, w: ww, h: ww * 1.3, c: rand(r, 0, 1) < 0.5 ? '#ffcf73' : '#ffb347' });
          // a line of tiny lights along the roof
          if (r() < 0.6) {
            const n = 6;
            for (let i = 0; i < n; i++) smallBulbs.push({ x: x + (bwid * (i + 0.5)) / n, y: base - bh + u * 0.004, color: FESTIVE[(i + farShapes.length) % FESTIVE.length], r: u * 0.0028 });
          }
          x += bwid + u * rand(r, 0, 0.015);
        }
      }
      // atmospheric haze over the distant town
      band(g, 0, hz - h * 0.12, w, h * 0.2, '#a24a52', 0, 0.35);
    }

    // ------------------------------------------------------------ trees
    function paintTrees(g: Ctx) {
      const r = R.trees;
      const dark = '#0d0a1c';
      if (port) {
        palmTree(g, r, w * 0.02, gy, h * 0.56, 0.12, dark, '#7a7040', 1);
        neem = leafyTree(g, r, w * 1.0, gy, h * 0.62, 0.9, dark, '#1f1c30', '#b8643c', -1);
      } else {
        palmTree(g, r, x0 - fw * 0.12, gy - h * 0.02, h * 0.48, -0.06, '#140f26', '#5a5a3a', 1);
        palmTree(g, r, x0 - fw * 0.035, gy, h * 0.66, -0.1, dark, '#a08040', 1);
        neem = leafyTree(g, r, x1 + fw * 0.09, gy, h * 0.58, 1.25, dark, '#1f1c30', '#b8643c', -1);
      }
      // fairy lights draped through the neem canopy
      const top = neem.reduce((m, c) => Math.min(m, c.y - c.r), Infinity);
      const bot = neem.reduce((m, c) => Math.max(m, c.y + c.r * 0.6), -Infinity);
      const left = neem.reduce((m, c) => Math.min(m, c.x - c.r * 0.7), Infinity);
      const right = neem.reduce((m, c) => Math.max(m, c.x + c.r * 0.7), -Infinity);
      for (let i = 0; i < 5; i++) {
        const y = top + (bot - top) * (0.2 + i * 0.17);
        const a = { x: left + (right - left) * rand(r, 0, 0.15), y: y + rand(r, -1, 1) * u * 0.02 };
        const b = { x: right - (right - left) * rand(r, 0, 0.15), y: y + rand(r, -1, 1) * u * 0.03 };
        const pts = sagPath(a, b, u * 0.05, 30);
        bulbsOn(r, along(pts, 16), ['#ffd27a', '#ffe7a8', '#ffb547'], u * 0.0042, bulbs);
      }
    }

    // compound wall on both sides of the house (landscape)
    function paintBoundary(g: Ctx) {
      const r = R.far;
      const wy = gy - h * 0.075;
      for (const [a, b] of [
        [0, x0],
        [x1, w],
      ] as const) {
        box(g, a, wy, b - a, gy - wy + 1, lin(g, 0, wy, 0, gy, [[0, '#5a2e3c'], [1, '#8a4a3a']]));
        clipRect(g, a, wy, b - a, gy - wy, () => daubs(g, r, a, wy, b, gy, 40, ['#3a1a2c', '#a05a46', '#6a3040'], u * 0.03, 0.18));
        // coping
        box(g, a, wy - h * 0.012, b - a, h * 0.014, lin(g, 0, wy - h * 0.012, 0, wy + h * 0.002, [[0, '#d8a87a'], [1, '#7a4a44']]));
        band(g, a, wy + h * 0.002, b - a, h * 0.02, '#1a0a14', 0.45, 0);
        // diyas on the coping
        const n = Math.max(2, Math.round((b - a) / (u * 0.075)));
        for (let i = 0; i < n; i++) addDiya(g, a + ((b - a) * (i + 0.5)) / n, wy - h * 0.012, u * 0.02, i % 2 ? 1 : -1, 0.9);
      }
      // gate pillars at the frame edges
      for (const px of [w * 0.035, w * 0.965]) {
        const pw = u * 0.05;
        const top = gy - h * 0.15;
        box(g, px - pw / 2, top, pw, gy - top, lin(g, px - pw / 2, 0, px + pw / 2, 0, [[0, '#4a2632'], [px < vx ? 0.75 : 0.25, '#c08060'], [1, '#3a1a28']]));
        box(g, px - pw * 0.65, top - h * 0.015, pw * 1.3, h * 0.018, '#d8a87a');
        box(g, px - pw * 0.5, top - h * 0.03, pw, h * 0.016, '#b8805e');
        addDiya(g, px, top - h * 0.03, u * 0.034, px < vx ? 1 : -1, 1.3);
      }
    }

    // ------------------------------------------------------------ courtyard
    function paintYard(g: Ctx) {
      const r = R.yard;
      box(g, 0, gy, w, h - gy, lin(g, 0, gy, 0, h, [[0, '#6e4234'], [0.2, '#5a3530'], [0.55, '#3b2228'], [1, '#1e121a']]));
      // flagstones in perspective
      const kb = (h - hz) / (gy - hz);
      const tile = fw * 0.075;
      const rows: number[] = [1];
      for (let n = 1; n < 30; n++) {
        const k = focal / (focal - n * tile);
        if (k <= 0 || k > kb * 1.05 || focal - n * tile <= 0) break;
        rows.push(k);
      }
      rows.push(kb * 1.05);
      const cols = 24;
      for (let j = 0; j < rows.length - 1; j++) {
        for (let i = -cols; i < cols; i++) {
          const xa = vx + i * tile;
          const xb = xa + tile;
          const q = [P(xa, gy, rows[j]), P(xb, gy, rows[j]), P(xb, gy, rows[j + 1]), P(xa, gy, rows[j + 1])];
          if (q[1].x < -tile * 3 && q[2].x < 0) continue;
          if (q[0].x > w + tile * 3 && q[3].x > w) continue;
          const t = r();
          fillPoly(g, q, t < 0.5 ? rgba('#000000', 0.04 + t * 0.12) : rgba('#ffcf9a', (t - 0.5) * 0.09));
        }
      }
      g.strokeStyle = rgba('#140a10', 0.35);
      g.lineWidth = Math.max(1, u * 0.0035);
      g.beginPath();
      for (let i = -cols; i <= cols; i++) {
        const a = P(vx + i * tile, gy, 1);
        const b = P(vx + i * tile, gy, kb * 1.05);
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
      }
      for (const k of rows) {
        const y = hz + (gy - hz) * k;
        g.moveTo(0, y);
        g.lineTo(w, y);
      }
      g.stroke();
      daubs(g, r, 0, gy, w, h, 90, ['#8a5a40', '#2a161c', '#6a3a2e'], u * 0.05, 0.12, 0, 0.1);
      // warm light on the stone: from the house, the doorway and the lanterns
      pool(g, vx, gy + h * 0.02, fw * 0.55, h * 0.06, '#ff9a4a', 0.28);
      pool(g, vx, P(vx, gy, 1.4).y, cb * 1.3, h * 0.08, '#ffb060', 0.16);
      // glossy reflections of the lit openings and lanterns
      for (const k of kandils) pool(g, k.x, gy + (gy - k.y) * 0.9, u * 0.03, h * 0.12, '#ff9a40', 0.18);
      for (const bx of bays) pool(g, bx, gy + (gy - (winSill + winTop) / 2) * 0.85, wa * 0.9, h * 0.1, '#ffb050', 0.12);
    }

    // ------------------------------------------------------------ the house
    function wallLight(g: Ctx) {
      // warm light falling on the walls from windows, lanterns, diyas and the fairy lights
      for (const bx of bays) {
        pool(g, bx, (winSill + winTop) / 2, wa * 2.6, sh * 0.55, '#ff9040', 0.28);
        pool(g, bx, winSill, wa * 2.2, sh * 0.25, '#ffb060', 0.22);
        pool(g, bx, (jyb + jtop) / 2, jw * 1.3, sh2 * 0.5, '#ff8a3a', 0.22);
      }
      for (const k of kandils) pool(g, k.x, k.y, k.s * 3.2, k.s * 2.6, '#ff8a2a', 0.42);
      pool(g, vx, pt - sh * 0.35, cb * 0.8, sh * 0.6, '#ff9a4a', 0.22);
      pool(g, vx, (byb + btop) / 2, cb * 0.7, sh2 * 0.5, '#ff8a3a', 0.15);
      // uplight from the row of diyas on the plinth
      for (let i = 0; i < 9; i++) pool(g, x0 + (fw * (i + 0.5)) / 9, pt, fw * 0.09, sh * 0.35, '#ff8a30', 0.18);
      // the scalloped lights under the cornice wash the top of the wall
      band(g, x0, roof, fw, sh2 * 0.25, '#ff9a50', 0.2, 0);
    }

    function paintWall(g: Ctx) {
      const r = R.wall;
      box(g, x0, roof, fw, pt - roof, lin(g, 0, roof, 0, pt, [[0, '#3c2244'], [0.3, '#56294a'], [0.62, '#6e3246'], [1, '#86413e']]));
      clipRect(g, x0, roof, fw, pt - roof, () => {
        daubs(g, r, x0, roof, x1, pt, 240, ['#2a1634', '#a05a50', '#552640', '#c07a58', '#3a1d3a'], u * 0.035, 0.13, 0, 0.18);
        // weathering streaks under sills and corbels
        for (const bx of bays) {
          daubs(g, r, bx - wa, winSill, bx + wa, pt, 6, ['#2a1022'], u * 0.03, 0.18, Math.PI / 2, 0.05);
          daubs(g, r, bx - jw * 0.4, jyb + sh2 * 0.2, bx + jw * 0.4, f1, 5, ['#2a1022'], u * 0.03, 0.16, Math.PI / 2, 0.05);
        }
        wallLight(g);
        // the far ends of the facade fall into shadow
        g.fillStyle = lin(g, x0, 0, x1, 0, [[0, rgba('#0a0412', 0.35)], [0.22, rgba('#0a0412', 0)], [0.78, rgba('#0a0412', 0)], [1, rgba('#0a0412', 0.35)]]);
        g.fillRect(x0, roof, fw, pt - roof);
        // above the chhajja the wall sits in its shadow (light comes from below)
        band(g, x0, f1 - sh2 * 0.24, fw, sh2 * 0.24, '#12061a', 0, 0.35);
        // ambient occlusion along the plinth
        band(g, x0, pt - sh * 0.08, fw, sh * 0.08, '#12061a', 0, 0.35);
      });
      // Shekhawati-style painted frieze under the cornice
      const fbY = roof + u * 0.026;
      const fbH = u * 0.03;
      box(g, x0, fbY, fw, fbH, rgba('#22102a', 0.4));
      box(g, x0, fbY, fw, u * 0.003, rgba('#f2d0a0', 0.55));
      box(g, x0, fbY + fbH - u * 0.003, fw, u * 0.003, rgba('#f2d0a0', 0.55));
      const nm = Math.round(fw / (u * 0.05));
      for (let i = 0; i < nm; i++) {
        const cx = x0 + (fw * (i + 0.5)) / nm;
        const cy = fbY + fbH / 2;
        const pr = fbH * 0.3;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU;
          ellipse(g, cx + Math.cos(a) * pr * 0.6, cy + Math.sin(a) * pr * 0.6, pr * 0.45, pr * 0.22, rgba('#f0d2a0', 0.7), a);
        }
        ellipse(g, cx, cy, pr * 0.28, pr * 0.28, '#c43a3a');
        const lx = cx + fw / nm / 2;
        ellipse(g, lx - pr * 0.5, cy, pr * 0.55, pr * 0.2, rgba('#3a8a6a', 0.75), -0.4);
        ellipse(g, lx + pr * 0.5, cy, pr * 0.55, pr * 0.2, rgba('#3a8a6a', 0.75), 0.4);
      }
      // vertical pilasters between bays
      const edges: number[] = [];
      for (let i = 0; i <= nb; i++) edges.push(vx - cb / 2 - bw * i, vx + cb / 2 + bw * i);
      for (const ex of edges) {
        const pw = u * 0.016;
        for (const [ya, yb] of [
          [roof, f1],
          [f1, pt],
        ] as const) {
          box(g, ex - pw / 2, ya, pw, yb - ya, lin(g, ex - pw / 2, 0, ex + pw / 2, 0, [[0, rgba(TRIM.shade, 0.7)], [ex < vx ? 0.7 : 0.3, rgba(TRIM.lit, 0.45)], [1, rgba(TRIM.deep, 0.7)]]));
        }
      }
    }

    function paintPlinth(g: Ctx) {
      const r = R.house;
      box(g, x0 - u * 0.006, pt, fw + u * 0.012, gy - pt, lin(g, 0, pt, 0, gy, [[0, '#9a5a44'], [1, '#5a3030']]));
      const rows = 3;
      const bh = (gy - pt) / rows;
      for (let j = 0; j < rows; j++) {
        let x = x0 - u * 0.006 - (j % 2) * u * 0.02;
        while (x < x1) {
          const bl = u * rand(r, 0.035, 0.06);
          const t = r();
          box(g, x + 1, pt + j * bh + 1, bl - 2, bh - 2, t < 0.5 ? rgba('#2a1018', 0.08 + t * 0.2) : rgba('#ffc890', (t - 0.5) * 0.18));
          x += bl;
        }
      }
      // moulded top edge
      box(g, x0 - u * 0.01, pt - u * 0.004, fw + u * 0.02, u * 0.012, lin(g, 0, pt - u * 0.004, 0, pt + u * 0.008, [[0, '#f2c890'], [1, '#8a5040']]));
      pool(g, vx, pt + (gy - pt) * 0.5, fw * 0.5, (gy - pt) * 1.4, '#ff9a40', 0.18);
    }

    /** Projecting eave (chhajja) with brackets, lit from below. */
    function chhajja(g: Ctx, xa: number, xb: number, y: number, depth: number, brackets: number) {
      const ov = u * 0.012;
      // sloping top (terracotta tiles)
      fillPoly(g, [{ x: xa - ov * 0.4, y: y - depth * 0.55 }, { x: xb + ov * 0.4, y: y - depth * 0.55 }, { x: xb + ov, y }, { x: xa - ov, y }], lin(g, 0, y - depth * 0.55, 0, y, [[0, '#2e1626'], [1, '#6a2e2a']]));
      // lip
      box(g, xa - ov, y, xb - xa + ov * 2, depth * 0.45, lin(g, 0, y, 0, y + depth * 0.45, [[0, TRIM.mid], [1, TRIM.lit]]));
      // brackets
      const n = brackets;
      for (let i = 0; i <= n; i++) {
        const bx = lerpN(xa, xb, i / n);
        const bh = depth * 1.3;
        const bwd = depth * 0.5;
        g.beginPath();
        g.moveTo(bx - bwd / 2, y + depth * 0.45);
        g.lineTo(bx + bwd / 2, y + depth * 0.45);
        g.quadraticCurveTo(bx + bwd * 0.5, y + depth * 0.45 + bh * 0.6, bx + bwd * 0.1, y + depth * 0.45 + bh);
        g.quadraticCurveTo(bx - bwd * 0.25, y + depth * 0.45 + bh * 0.5, bx - bwd / 2, y + depth * 0.45);
        g.fillStyle = lin(g, 0, y, 0, y + depth * 0.45 + bh, [[0, TRIM.mid], [1, '#f5c98a']]);
        g.fill();
      }
      // cast shadow under the lip on the wall is lit warm from below instead
      band(g, xa, y + depth * 0.45, xb - xa, depth * 1.4, '#ffb070', 0.14, 0);
    }

    function paintCornice(g: Ctx) {
      const r = R.house;
      // parapet wall
      box(g, x0, parTop, fw, roof - parTop, lin(g, 0, parTop, 0, roof, [[0, '#3a2040'], [1, '#5e2e48']]));
      // blind arcade on the parapet
      const n = Math.round(fw / (u * 0.06));
      for (let i = 0; i < n; i++) {
        const cx = x0 + (fw * (i + 0.5)) / n;
        const a = (fw / n) * 0.3;
        g.beginPath();
        archPath(g, cx, roof - (roof - parTop) * 0.18, a, roof - (roof - parTop) * 0.55, a * 0.9, 0);
        g.fillStyle = rgba('#1a0a1c', 0.45);
        g.fill();
      }
      // merlons (kangura) along the top
      const m = Math.round(fw / (u * 0.034));
      const mw = fw / m;
      const mh = u * 0.03;
      g.beginPath();
      for (let i = 0; i < m; i++) {
        const cx = x0 + mw * (i + 0.5);
        g.moveTo(cx - mw * 0.36, parTop + 1);
        g.lineTo(cx - mw * 0.36, parTop - mh * 0.45);
        g.quadraticCurveTo(cx - mw * 0.36, parTop - mh * 0.85, cx, parTop - mh);
        g.quadraticCurveTo(cx + mw * 0.36, parTop - mh * 0.85, cx + mw * 0.36, parTop - mh * 0.45);
        g.lineTo(cx + mw * 0.36, parTop + 1);
        g.closePath();
        smallBulbs.push({ x: cx, y: parTop - mh * 1.05, color: WARM[i % WARM.length], r: u * 0.0038 });
      }
      g.fillStyle = lin(g, 0, parTop - mh, 0, parTop, [[0, '#4a2a46'], [1, '#6a3a4a']]);
      g.fill();
      // cornice moulding below the parapet, warm on its underside
      box(g, x0 - u * 0.012, roof - u * 0.008, fw + u * 0.024, u * 0.01, '#8a5a58');
      box(g, x0 - u * 0.008, roof + u * 0.002, fw + u * 0.016, u * 0.012, lin(g, 0, roof, 0, roof + u * 0.014, [[0, TRIM.mid], [1, '#f2c48a']]));
      // scalloped string lights under the cornice
      const k = Math.round(fw / (u * 0.07));
      const anchors: Pt[] = [];
      for (let i = 0; i <= k; i++) anchors.push({ x: x0 + (fw * i) / k, y: roof + u * 0.016 });
      const pts = scallops(g, anchors, u * 0.012, 5, rgba('#1a0c10', 0.7), Math.max(1, u * 0.002));
      bulbsOn(r, pts, FESTIVE, u * 0.0052, bulbs);
      // central pediment
      g.beginPath();
      g.moveTo(vx - cb * 0.42, parTop + 1);
      g.quadraticCurveTo(vx - cb * 0.3, pedTop + (parTop - pedTop) * 0.25, vx, pedTop);
      g.quadraticCurveTo(vx + cb * 0.3, pedTop + (parTop - pedTop) * 0.25, vx + cb * 0.42, parTop + 1);
      g.closePath();
      g.fillStyle = lin(g, 0, pedTop, 0, parTop, [[0, '#4a2a48'], [1, '#6e3a4c']]);
      g.fill();
      g.strokeStyle = TRIM.mid;
      g.lineWidth = u * 0.008;
      g.stroke();
      // medallion: a lotus rosette
      const my = parTop - (parTop - pedTop) * 0.38;
      const mr = (parTop - pedTop) * 0.3;
      ellipse(g, vx, my, mr, mr, lin(g, 0, my - mr, 0, my + mr, [[0, '#d9a45a'], [1, '#7a4a2a']]));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ellipse(g, vx + Math.cos(a) * mr * 0.55, my + Math.sin(a) * mr * 0.55, mr * 0.3, mr * 0.16, '#c2385a', a);
      }
      ellipse(g, vx, my, mr * 0.28, mr * 0.28, '#ffd27a');
      kalash(g, vx, pedTop + u * 0.004, u * 0.05, brass(g, vx - u * 0.02, vx + u * 0.02));
      const ped: Pt[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const sx = t < 0.5 ? -1 : 1;
        const tt = t < 0.5 ? t * 2 : (1 - t) * 2;
        // quadratic from base corner to apex
        const s = 1 - tt;
        ped.push({ x: vx + sx * (s * s * cb * 0.42 + 2 * s * tt * cb * 0.3), y: s * s * parTop + 2 * s * tt * (pedTop + (parTop - pedTop) * 0.25) + tt * tt * pedTop - u * 0.006 });
      }
      bulbsOn(r, along(ped, 17), ['#ffe7a8', '#ffcf6b'], u * 0.0045, smallBulbs);
    }

    function paintTowers(g: Ctx) {
      const r = R.house;
      for (const tx of towers) {
        const sx = tx < vx ? 1 : -1; // which side faces the centre
        const a0 = tx - towerW / 2;
        const a1 = tx + towerW / 2;
        const tl = P(a0, parTop, tk);
        const br = P(a1, gy, tk);
        // side face toward the centre
        const inner = sx > 0 ? a1 : a0;
        const fi = P(inner, parTop, tk);
        const fb = P(inner, gy, tk);
        fillPoly(g, [{ x: inner, y: parTop }, fi, fb, { x: inner, y: gy }], lin(g, 0, parTop, 0, gy, [[0, '#2a1630'], [0.7, '#5a2a36'], [1, '#6a3430']]));
        // front face
        box(g, tl.x, tl.y, br.x - tl.x, br.y - tl.y, lin(g, 0, tl.y, 0, br.y, [[0, '#4a2646'], [0.5, '#7a3a46'], [1, '#8e4a40']]));
        clipRect(g, tl.x, tl.y, br.x - tl.x, br.y - tl.y, () => {
          daubs(g, r, tl.x, tl.y, br.x, br.y, 40, ['#2a1634', '#b06a50', '#5a2a40'], u * 0.03, 0.14, Math.PI / 2, 0.15);
          // stacked niches
          const tw = br.x - tl.x;
          const cx = (tl.x + br.x) / 2;
          for (const [ya, yb] of [
            [P(0, roof, tk).y, P(0, f1, tk).y],
            [P(0, f1, tk).y, P(0, pt, tk).y],
          ] as const) {
            const hh = yb - ya;
            g.beginPath();
            archPath(g, cx, yb - hh * 0.12, tw * 0.26, ya + hh * 0.38, tw * 0.3, 5);
            g.fillStyle = lin(g, 0, ya, 0, yb, [[0, '#24102a'], [1, '#4a1c2c']]);
            g.fill();
            g.strokeStyle = rgba(TRIM.lit, 0.5);
            g.lineWidth = u * 0.005;
            g.stroke();
          }
          // curtain lights cascading down the tower
          const cols = 7;
          for (let c = 0; c < cols; c++) {
            const x = tl.x + tw * (0.08 + (0.84 * c) / (cols - 1));
            const len = (br.y - tl.y) * (0.94 - ((c * 5) % 3) * 0.03);
            const n = 34;
            line(g, x, tl.y + u * 0.02, x, tl.y + len, rgba('#1a0c10', 0.3), Math.max(0.8, u * 0.0015));
            for (let i = 0; i < n; i++) bulbs.push({ x: x + rand(r, -0.5, 0.5) * u * 0.002, y: tl.y + u * 0.02 + (len * (i + rand(r, 0.3, 0.7))) / n, color: (i * 3 + c) % 7 === 0 ? '#ffb347' : (i + c) % 5 === 0 ? '#fff4d8' : '#ffe2a0', r: u * 0.0034 * rand(r, 0.8, 1.2) });
          }
          pool(g, cx, (tl.y + br.y) / 2, tw * 0.9, (br.y - tl.y) * 0.55, '#ffb050', 0.25);
        });
        // cornice of the tower
        box(g, tl.x - u * 0.008, tl.y - u * 0.006, br.x - tl.x + u * 0.016, u * 0.014, lin(g, 0, tl.y, 0, tl.y + u * 0.01, [[0, TRIM.mid], [1, '#f2c48a']]));
        // chhatri on top
        chhatri(g, (tl.x + br.x) / 2, tl.y - u * 0.006, towerW * 0.98);
      }
    }

    function chhatri(g: Ctx, cx: number, base: number, cw: number) {
      const ph = cw * 0.5;
      // platform
      box(g, cx - cw * 0.55, base - cw * 0.06, cw * 1.1, cw * 0.07, lin(g, 0, base - cw * 0.06, 0, base, [[0, TRIM.lit], [1, TRIM.shade]]));
      // dark interior with a lamp
      box(g, cx - cw * 0.44, base - cw * 0.06 - ph, cw * 0.88, ph, lin(g, 0, base - ph, 0, base, [[0, '#2a1020'], [1, '#8a3a20']]));
      lamps.push({ x: cx, y: base - cw * 0.06 - ph * 0.3, s: cw * 0.5, color: '#ff9a3a', i: 0.8 });
      // pillars
      for (const f of [-0.42, -0.14, 0.14, 0.42]) {
        const px = cx + f * cw;
        box(g, px - cw * 0.04, base - cw * 0.06 - ph, cw * 0.08, ph, lin(g, px - cw * 0.04, 0, px + cw * 0.04, 0, [[0, TRIM.shade], [0.5, TRIM.lit], [1, TRIM.shade]]));
      }
      // little arches between the pillars
      for (const f of [-0.28, 0, 0.28]) {
        g.beginPath();
        archPath(g, cx + f * cw, base - cw * 0.06 - ph * 0.55, cw * 0.1, base - cw * 0.06 - ph * 0.7, cw * 0.12, 0);
        g.strokeStyle = rgba(TRIM.lit, 0.6);
        g.lineWidth = cw * 0.025;
        g.stroke();
      }
      // chhajja
      const cy = base - cw * 0.06 - ph;
      fillPoly(g, [{ x: cx - cw * 0.5, y: cy - cw * 0.06 }, { x: cx + cw * 0.5, y: cy - cw * 0.06 }, { x: cx + cw * 0.64, y: cy + cw * 0.03 }, { x: cx - cw * 0.64, y: cy + cw * 0.03 }], lin(g, 0, cy - cw * 0.06, 0, cy + cw * 0.03, [[0, '#4a2440'], [1, '#e8b880']]));
      // drum and dome
      box(g, cx - cw * 0.36, cy - cw * 0.14, cw * 0.72, cw * 0.09, TRIM.mid);
      g.beginPath();
      domePath(g, cx, cy - cw * 0.13, cw * 0.38, cw * 0.55);
      g.fillStyle = lin(g, cx - cw * 0.4, 0, cx + cw * 0.4, 0, [[0, '#3a2040'], [0.35, '#8a5a6a'], [0.6, '#c09078'], [1, '#2a1630']]);
      g.fill();
      kalash(g, cx, cy - cw * 0.66, cw * 0.28, brass(g, cx - cw * 0.08, cx + cw * 0.08));
      bulbsOn(R.house, domePts(cx, cy - cw * 0.13, cw * 0.39, cw * 0.56, 12).slice(1, 12), ['#ffe7a8', '#ffcf6b'], u * 0.0042, smallBulbs);
    }

    function groundWindow(g: Ctx, cx: number) {
      const r = R.deco;
      const a = wa;
      const ys = winTop + a * 1.05;
      const fr = a * 0.22;
      // shutters (open, painted peacock teal)
      for (const sx of [-1, 1]) {
        const x = cx + sx * (a + fr * 1.6);
        const sw2 = a * 0.62;
        const xa = sx < 0 ? x - sw2 : x;
        box(g, xa, ys - a * 0.25, sw2, winSill - ys + a * 0.2, lin(g, xa, 0, xa + sw2, 0, [[0, '#0f3a3a'], [0.5, '#1f6a64'], [1, '#0c3030']]));
        for (let j = 0; j < 3; j++) {
          const py = ys - a * 0.18 + j * (winSill - ys + a * 0.1) / 3;
          g.strokeStyle = rgba('#e8c070', 0.45);
          g.lineWidth = Math.max(1, u * 0.002);
          g.strokeRect(xa + sw2 * 0.15, py + a * 0.05, sw2 * 0.7, (winSill - ys) / 3 - a * 0.08);
        }
      }
      // frame (alfiz)
      box(g, cx - a - fr * 1.6, winTop - fr * 1.6, (a + fr * 1.6) * 2, winSill - winTop + fr * 1.6, lin(g, 0, winTop, 0, winSill, [[0, '#c49470'], [1, '#e8b880']]));
      g.beginPath();
      archPath(g, cx, winSill, a + fr, ys, a * 1.05 + fr * 0.6, 0);
      g.fillStyle = lin(g, 0, winTop, 0, winSill, [[0, '#7a4a48'], [1, '#a0644e']]);
      g.fill();
      // spandrel rosettes
      for (const sx of [-1, 1]) ellipse(g, cx + sx * a * 0.95, winTop + fr * 0.4, fr * 0.6, fr * 0.6, '#b8304a');
      // opening with warm interior
      g.beginPath();
      archPath(g, cx, winSill, a, ys, a * 1.05, 7, 0.35);
      g.fillStyle = lin(g, 0, winTop, 0, winSill, [[0, '#ffd890'], [0.45, '#ffb050'], [1, '#c8582a']]);
      g.fill();
      clipTo(
        g,
        () => archPath(g, cx, winSill, a, ys, a * 1.05, 7, 0.35),
        () => {
          // drapes inside
          for (const sx of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx + sx * a, winTop);
            g.quadraticCurveTo(cx + sx * a * 0.2, ys, cx + sx * a * 0.55, winSill);
            g.lineTo(cx + sx * a, winSill);
            g.closePath();
            g.fillStyle = lin(g, cx + sx * a, 0, cx + sx * a * 0.3, 0, [[0, '#6a0c28'], [1, '#c8284a']]);
            g.fill();
          }
          // a hanging brass lamp silhouette inside
          line(g, cx, winTop, cx, ys + a * 0.1, rgba('#3a1a0a', 0.8), Math.max(1, u * 0.002));
          ellipse(g, cx, ys + a * 0.2, a * 0.2, a * 0.12, '#6a3a12');
          // grille
          g.strokeStyle = rgba('#2a1206', 0.75);
          g.lineWidth = Math.max(1, a * 0.07);
          g.beginPath();
          for (const f of [-0.5, 0, 0.5]) {
            g.moveTo(cx + f * a, ys + a * 0.45);
            g.lineTo(cx + f * a, winSill);
          }
          g.moveTo(cx - a, ys + a * 0.45);
          g.lineTo(cx + a, ys + a * 0.45);
          g.stroke();
        },
      );
      openings.push({ x: cx, y: (ys + winSill) / 2, rx: a * 1.1, ry: (winSill - winTop) * 0.55, i: 1 });
      // hood
      chhajjaSmall(g, cx, winTop - fr * 1.6, a + fr * 2.4);
      // sill with diyas
      box(g, cx - a - fr * 2, winSill, (a + fr * 2) * 2, u * 0.012, lin(g, 0, winSill, 0, winSill + u * 0.012, [[0, '#f5d0a0'], [1, '#8a5040']]));
      for (const f of [-0.75, 0, 0.75]) addDiya(g, cx + f * a, winSill - u * 0.002, u * 0.022, f > 0 ? -1 : 1, 0.9);
      // marigold swag
      marigoldGarland(g, fork(r), sagPath({ x: cx - a - fr * 1.4, y: winTop - fr }, { x: cx + a + fr * 1.4, y: winTop - fr }, a * 0.35, 18), u * 0.0085);
    }

    function chhajjaSmall(g: Ctx, cx: number, y: number, a: number) {
      fillPoly(g, [{ x: cx - a * 0.92, y: y - u * 0.016 }, { x: cx + a * 0.92, y: y - u * 0.016 }, { x: cx + a, y }, { x: cx - a, y }], lin(g, 0, y - u * 0.016, 0, y, [[0, '#3a1a2a'], [1, '#7a3a30']]));
      box(g, cx - a, y, a * 2, u * 0.007, lin(g, 0, y, 0, y + u * 0.007, [[0, TRIM.mid], [1, '#f5c98a']]));
    }

    function jharokha(g: Ctx, cx: number) {
      const r = R.deco;
      const jh = jyb - jtop;
      const rb = jtop + jh * 0.2;
      shade(g, cx, jyb + jh * 0.12, jw * 0.75, jh * 0.3, 0.35);
      // corbelled base
      const tiers = [
        [1.1, 0.06],
        [0.92, 0.06],
        [0.72, 0.06],
        [0.46, 0.07],
      ] as const;
      let y = jyb;
      for (const [k, t] of tiers) {
        const hh = jh * t;
        box(g, cx - (jw * k) / 2, y, jw * k, hh, lin(g, 0, y, 0, y + hh, [[0, TRIM.shade], [1, '#e8b47c']]));
        y += hh;
      }
      g.beginPath();
      g.moveTo(cx - jw * 0.2, y);
      g.quadraticCurveTo(cx, y + jh * 0.14, cx + jw * 0.2, y);
      g.fillStyle = '#d8a070';
      g.fill();
      // back panel
      box(g, cx - jw * 0.5, rb, jw, jyb - rb, lin(g, 0, rb, 0, jyb, [[0, '#6a4050'], [1, '#a26a58']]));
      // opening
      const a = jw * 0.36;
      const ys = rb + jh * 0.24;
      g.beginPath();
      archPath(g, cx, jyb, a, ys, a * 0.85, 7, 0.38);
      g.fillStyle = lin(g, 0, rb, 0, jyb, [[0, '#ffd68a'], [0.55, '#ffa848'], [1, '#c45a28']]);
      g.fill();
      clipTo(
        g,
        () => archPath(g, cx, jyb, a, ys, a * 0.85, 7, 0.38),
        () => {
          for (const sx of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx + sx * a, rb);
            g.quadraticCurveTo(cx + sx * a * 0.35, ys + a * 0.4, cx + sx * a * 0.7, jyb);
            g.lineTo(cx + sx * a, jyb);
            g.closePath();
            g.fillStyle = sx < 0 ? '#8a1a40' : '#7a1236';
            g.fill();
          }
        },
      );
      openings.push({ x: cx, y: (ys + jyb) / 2, rx: a * 1.15, ry: (jyb - rb) * 0.5, i: 0.9 });
      // jaali balustrade
      const bh = jh * 0.17;
      box(g, cx - jw * 0.48, jyb - bh, jw * 0.96, bh, lin(g, 0, jyb - bh, 0, jyb, [[0, '#f0c890'], [1, '#a87050']]));
      const holes = 6;
      for (let i = 0; i < holes; i++) {
        const hx = cx - jw * 0.4 + (jw * 0.8 * (i + 0.5)) / holes;
        g.beginPath();
        archPath(g, hx, jyb - bh * 0.18, (jw * 0.8) / holes / 3.2, jyb - bh * 0.62, bh * 0.2, 0);
        g.fillStyle = '#ff9a40';
        g.fill();
      }
      // columns
      for (const sx of [-1, 1]) {
        const px = cx + sx * jw * 0.43;
        box(g, px - jw * 0.035, rb, jw * 0.07, jyb - rb, lin(g, px - jw * 0.035, 0, px + jw * 0.035, 0, [[0, TRIM.shade], [0.5, TRIM.lit], [1, TRIM.shade]]));
        box(g, px - jw * 0.055, jyb - bh - jh * 0.03, jw * 0.11, jh * 0.03, TRIM.lit);
        box(g, px - jw * 0.055, rb, jw * 0.11, jh * 0.03, TRIM.lit);
      }
      // floor slab
      box(g, cx - jw * 0.56, jyb - jh * 0.015, jw * 1.12, jh * 0.04, lin(g, 0, jyb, 0, jyb + jh * 0.04, [[0, TRIM.lit], [1, TRIM.mid]]));
      // bangaldar roof
      g.beginPath();
      banglaPath(g, cx, rb, jw * 0.64, jh * 0.22);
      g.fillStyle = lin(g, 0, rb - jh * 0.22, 0, rb + jh * 0.04, [[0, '#4e2a44'], [0.6, '#8a4e50'], [1, '#e2a878']]);
      g.fill();
      g.strokeStyle = rgba('#2a1424', 0.5);
      g.lineWidth = Math.max(1, u * 0.0025);
      g.beginPath();
      for (let i = -3; i <= 3; i++) {
        g.moveTo(cx + i * jw * 0.08, rb - jh * 0.2 * (1 - Math.abs(i) * 0.09));
        g.quadraticCurveTo(cx + i * jw * 0.12, rb - jh * 0.1, cx + i * jw * 0.17, rb + jh * 0.01);
      }
      g.stroke();
      kalash(g, cx, rb - jh * 0.215, jh * 0.12, brass(g, cx - jh * 0.04, cx + jh * 0.04));
      // marigold swag and two strands
      marigoldGarland(g, fork(r), sagPath({ x: cx - a, y: rb + jh * 0.06 }, { x: cx + a, y: rb + jh * 0.06 }, a * 0.3, 16), u * 0.008);
      for (const sx of [-1, 1]) marigoldStrand(g, fork(r), cx + sx * jw * 0.5, rb + jh * 0.04, jh * 0.42, u * 0.0075);
      // diyas on the ledge
      for (const sx of [-1, 1]) addDiya(g, cx + sx * jw * 0.36, jyb - jh * 0.015, u * 0.018, sx > 0 ? -1 : 1, 0.85);
    }

    function balcony(g: Ctx) {
      const r = R.deco;
      const bh = byb - btop;
      const rb = btop + bh * 0.2;
      shade(g, vx, byb + bh * 0.1, ba * 1.25, bh * 0.25, 0.4);
      // corbels
      for (let i = 0; i < 5; i++) {
        const bx = vx - ba + (ba * 2 * i) / 4;
        g.beginPath();
        g.moveTo(bx - u * 0.012, byb + bh * 0.04);
        g.lineTo(bx + u * 0.012, byb + bh * 0.04);
        g.quadraticCurveTo(bx + u * 0.01, byb + bh * 0.2, bx, byb + bh * 0.26);
        g.quadraticCurveTo(bx - u * 0.01, byb + bh * 0.2, bx - u * 0.012, byb + bh * 0.04);
        g.fillStyle = lin(g, 0, byb, 0, byb + bh * 0.26, [[0, TRIM.mid], [1, '#f2c48a']]);
        g.fill();
      }
      // back wall and three arches (softly lit - this sits behind the person's head)
      box(g, vx - ba, rb, ba * 2, byb - rb, lin(g, 0, rb, 0, byb, [[0, '#5a3448'], [1, '#8a5050']]));
      const a = (ba * 2) / 3 / 2 - u * 0.01;
      for (let i = -1; i <= 1; i++) {
        const cx = vx + i * (ba * 2) / 3;
        g.beginPath();
        archPath(g, cx, byb, a, rb + bh * 0.3, a * 0.8, 5, 0.38);
        g.fillStyle = lin(g, 0, rb, 0, byb, [[0, '#8a4a3a'], [0.6, '#c06a3a'], [1, '#a04a2a']]);
        g.fill();
        // carved jaali shutters (calm texture)
        clipTo(
          g,
          () => archPath(g, cx, byb, a, rb + bh * 0.3, a * 0.8, 5, 0.38),
          () => {
            g.strokeStyle = rgba('#3a1a1a', 0.55);
            g.lineWidth = Math.max(1, u * 0.004);
            g.beginPath();
            const st = a * 0.42;
            for (let d = -6; d <= 6; d++) {
              g.moveTo(cx + d * st - bh, rb);
              g.lineTo(cx + d * st + bh, rb + bh * 2);
              g.moveTo(cx + d * st + bh, rb);
              g.lineTo(cx + d * st - bh, rb + bh * 2);
            }
            g.stroke();
          },
        );
        openings.push({ x: cx, y: (rb + byb) / 2 + bh * 0.1, rx: a * 1.1, ry: bh * 0.4, i: 0.35 });
      }
      // columns
      for (let i = 0; i <= 3; i++) {
        const px = vx - ba + (ba * 2 * i) / 3;
        box(g, px - u * 0.007, rb, u * 0.014, byb - rb, lin(g, px - u * 0.007, 0, px + u * 0.007, 0, [[0, TRIM.shade], [0.5, TRIM.lit], [1, TRIM.shade]]));
      }
      // balustrade and slab
      const rh = bh * 0.2;
      box(g, vx - ba * 1.04, byb - rh, ba * 2.08, rh, lin(g, 0, byb - rh, 0, byb, [[0, '#e8bc88'], [1, '#9a6248']]));
      g.fillStyle = rgba('#5a2a2a', 0.7);
      const nbal = 14;
      for (let i = 0; i < nbal; i++) {
        const bx = vx - ba + (ba * 2 * (i + 0.5)) / nbal;
        g.beginPath();
        g.ellipse(bx, byb - rh * 0.45, (ba / nbal) * 0.38, rh * 0.28, 0, 0, TAU);
        g.fill();
      }
      box(g, vx - ba * 1.1, byb, ba * 2.2, bh * 0.05, lin(g, 0, byb, 0, byb + bh * 0.05, [[0, TRIM.lit], [1, TRIM.mid]]));
      box(g, vx - ba * 1.06, byb - rh - bh * 0.03, ba * 2.12, bh * 0.035, TRIM.lit);
      // roof
      g.beginPath();
      banglaPath(g, vx, rb, ba * 1.15, bh * 0.2);
      g.fillStyle = lin(g, 0, rb - bh * 0.2, 0, rb + bh * 0.04, [[0, '#4a2842'], [0.6, '#844a4e'], [1, '#dca476']]);
      g.fill();
      for (const f of [-0.7, 0, 0.7]) kalash(g, vx + f * ba, rb - bh * 0.2 * (f === 0 ? 1 : 0.62), bh * 0.11, brass(g, vx + f * ba - bh * 0.04, vx + f * ba + bh * 0.04));
      // garland drapes
      marigoldGarland(g, fork(r), sagPath({ x: vx - ba * 1.04, y: byb - rh * 0.4 }, { x: vx + ba * 1.04, y: byb - rh * 0.4 }, bh * 0.08, 24), u * 0.0085);
      for (const f of [-1, -1 / 3, 1 / 3, 1]) marigoldStrand(g, fork(r), vx + f * ba, rb + bh * 0.03, bh * 0.25, u * 0.007);
    }

    function door(g: Ctx) {
      const r = R.deco;
      const ys = doorTop + da * 1.05;
      // portal frame
      box(g, vx - pa, portalTop, pa * 2, pt - portalTop, lin(g, 0, portalTop, 0, pt, [[0, '#b88a66'], [1, '#e2b07c']]));
      clipRect(g, vx - pa, portalTop, pa * 2, pt - portalTop, () => daubs(g, r, vx - pa, portalTop, vx + pa, pt, 30, ['#7a4a40', '#f5d0a0'], u * 0.02, 0.2));
      // carved border band
      g.strokeStyle = rgba('#6a3a32', 0.55);
      g.lineWidth = u * 0.006;
      g.strokeRect(vx - pa * 0.9, portalTop + pa * 0.1, pa * 1.8, pt - portalTop - pa * 0.1);
      const beads = 9;
      for (let i = 0; i < beads; i++) {
        const y = portalTop + pa * 0.18 + ((pt - portalTop - pa * 0.25) * i) / (beads - 1);
        for (const sx of [-1, 1]) ellipse(g, vx + sx * pa * 0.9, y, u * 0.006, u * 0.006, '#f8dca8');
      }
      // spandrels
      for (const sx of [-1, 1]) {
        ellipse(g, vx + sx * pa * 0.6, portalTop + (doorTop - portalTop) * 0.75, u * 0.018, u * 0.018, '#c2385a');
        ellipse(g, vx + sx * pa * 0.6, portalTop + (doorTop - portalTop) * 0.75, u * 0.009, u * 0.009, '#ffd27a');
      }
      // arch reveal
      g.beginPath();
      archPath(g, vx, pt, da * 1.12, ys, da * 1.12, 9, 0.32);
      g.fillStyle = lin(g, 0, doorTop, 0, pt, [[0, '#3a1810'], [1, '#6a3020']]);
      g.fill();
      // tympanum jaali glowing softly from inside
      const lintel = ys + da * 0.1;
      clipTo(
        g,
        () => archPath(g, vx, pt, da, ys, da * 1.05, 9, 0.32),
        () => {
          box(g, vx - da, doorTop - da, da * 2, lintel - doorTop + da, lin(g, 0, doorTop, 0, lintel, [[0, '#e88a40'], [1, '#a04a20']]));
          g.strokeStyle = rgba('#3a1608', 0.8);
          g.lineWidth = Math.max(1, u * 0.004);
          g.beginPath();
          for (let i = 0; i < 7; i++) {
            const rr = da * (0.2 + i * 0.16);
            g.moveTo(vx + rr, lintel);
            g.arc(vx, lintel, rr, 0, Math.PI, true);
          }
          for (let i = 0; i <= 8; i++) {
            const an = Math.PI + (i / 8) * Math.PI;
            g.moveTo(vx, lintel);
            g.lineTo(vx + Math.cos(an) * da * 1.4, lintel + Math.sin(an) * da * 1.4);
          }
          g.stroke();
          // wooden door leaves
          box(g, vx - da, lintel, da * 2, pt - lintel, lin(g, vx - da, 0, vx + da, 0, [[0, '#2a1006'], [0.3, '#6a3214'], [0.5, '#4a200c'], [0.7, '#6a3214'], [1, '#2a1006']]));
          for (const sx of [-1, 1]) {
            const lx = sx < 0 ? vx - da : vx;
            for (let j = 0; j < 3; j++) {
              const py = lintel + (pt - lintel) * (0.06 + j * 0.31);
              const ph = (pt - lintel) * 0.26;
              box(g, lx + da * 0.14, py, da * 0.72, ph, lin(g, 0, py, 0, py + ph, [[0, '#7a3a18'], [1, '#3a1608']]));
              g.strokeStyle = rgba('#e0a050', 0.45);
              g.lineWidth = Math.max(1, u * 0.0025);
              g.strokeRect(lx + da * 0.14, py, da * 0.72, ph);
              for (const [qx, qy] of [
                [0.14, 0],
                [0.86, 0],
                [0.14, 1],
                [0.86, 1],
              ] as const)
                ellipse(g, lx + da * qx, py + ph * qy, u * 0.0045, u * 0.0045, '#f2c060');
            }
          }
          line(g, vx, lintel, vx, pt, '#1a0804', Math.max(1, u * 0.003));
          for (const sx of [-1, 1]) {
            g.strokeStyle = '#e8b048';
            g.lineWidth = Math.max(1, u * 0.003);
            g.beginPath();
            g.arc(vx + sx * da * 0.12, lintel + (pt - lintel) * 0.5, u * 0.01, 0, TAU);
            g.stroke();
          }
          box(g, vx - da, lintel - u * 0.004, da * 2, u * 0.01, '#8a5a2a');
        },
      );
      g.beginPath();
      archPath(g, vx, pt, da * 1.12, ys, da * 1.12, 9, 0.32);
      g.strokeStyle = rgba(TRIM.lit, 0.9);
      g.lineWidth = u * 0.006;
      g.stroke();
      openings.push({ x: vx, y: (doorTop + lintel) / 2 + da * 0.2, rx: da * 0.9, ry: da * 0.5, i: 0.4 });
      // threshold
      box(g, vx - da * 1.15, pt - u * 0.008, da * 2.3, u * 0.012, '#d8a070');
      // toran over the door
      toran(g, fork(r), vx - da * 1.15, vx + da * 1.15, lintel - u * 0.004, u * 0.042);
      // garland swags on the portal and strands at its sides
      marigoldGarland(g, fork(r), sagPath({ x: vx - pa, y: portalTop + u * 0.006 }, { x: vx + pa, y: portalTop + u * 0.006 }, (doorTop - portalTop) * 0.55, 30), u * 0.011);
      for (const sx of [-1, 1]) marigoldStrand(g, fork(r), vx + sx * pa * 0.98, portalTop + u * 0.01, sh * 0.5, u * 0.01);
      // purna kalash (brass pots with coconut and mango leaves) beside the door
      for (const sx of [-1, 1]) {
        const kx = vx + sx * da * 1.45;
        const ks = u * 0.04;
        const ky = pt - u * 0.004;
        for (let i = 0; i < 5; i++) leaf(g, kx, ky - ks * 0.95, ks * 0.75, -Math.PI / 2 + (i - 2) * 0.5, '#2f7d32');
        ellipse(g, kx, ky - ks * 1.05, ks * 0.26, ks * 0.3, '#8a5a2a');
        g.beginPath();
        g.moveTo(kx - ks * 0.2, ky - ks * 0.8);
        g.bezierCurveTo(kx - ks * 0.6, ky - ks * 0.7, kx - ks * 0.55, ky, kx - ks * 0.15, ky);
        g.lineTo(kx + ks * 0.15, ky);
        g.bezierCurveTo(kx + ks * 0.55, ky, kx + ks * 0.6, ky - ks * 0.7, kx + ks * 0.2, ky - ks * 0.8);
        g.closePath();
        g.fillStyle = brass(g, kx - ks * 0.5, kx + ks * 0.5);
        g.fill();
      }
    }

    function steps(g: Ctx) {
      for (let i = 0; i < 3; i++) {
        const yt = pt + i * riser;
        const kb = stepK[i];
        const kf = stepK[i + 1];
        const t = [P(vx - sw, yt, kb), P(vx + sw, yt, kb), P(vx + sw, yt, kf), P(vx - sw, yt, kf)];
        fillPoly(g, t, lin(g, 0, t[0].y, 0, t[2].y, [[0, '#a87050'], [1, '#e2b080']]));
        const f = [P(vx - sw, yt, kf), P(vx + sw, yt, kf), P(vx + sw, yt + riser, kf), P(vx - sw, yt + riser, kf)];
        fillPoly(g, f, lin(g, 0, f[0].y, 0, f[2].y, [[0, '#c48a62'], [1, '#6a3a30']]));
        // side faces toward the viewer's centre are hidden; mark the step edges
        line(g, f[0].x, f[0].y, f[1].x, f[1].y, rgba('#ffe0b0', 0.55), Math.max(1, u * 0.003));
        for (const sx of [-1, 1]) {
          const p = P(vx + sx * sw * 0.86, yt, (kb + kf) / 2);
          addDiya(g, p.x, p.y, u * 0.022 * kf, sx > 0 ? -1 : 1, 1);
        }
      }
    }

    function yardProps(g: Ctx) {
      const r = R.yard;
      const kEnd = stepK[3];
      // rangoli at the foot of the steps
      const rk = kEnd + 0.13;
      const rc = P(vx, gy, rk);
      const RR = fw * (port ? 0.12 : 0.08) * rk;
      const tilt = Math.max(0.22, Math.min(0.5, (rc.y - hz) / focal));
      const rf = rangoli(g, fork(r), rc.x, rc.y, RR, { tilt, petals: 12, rings: 4, diyas: 10, palette: ['#e2412b', '#ffb000', '#d6247b', '#13a08c', '#5b2a86', '#fff4e0', '#ff7a00'] });
      for (const f of rf) flames.push({ x: f.x, y: f.y, s: RR * 0.16, i: 0.9 });
      // pots beside the steps
      for (const sx of [-1, 1]) {
        const p = P(vx + sx * (sw + cb * 0.12), gy, 1.03);
        pottedPlant(g, r, p.x, p.y, h * (port ? 0.05 : 0.065), 'fern', sx > 0 ? -1 : 1);
      }
      // a path lined with diyas
      const n = 6;
      for (let i = 0; i < n; i++) {
        const k = 1.3 * Math.pow(2.1 / 1.3, i / (n - 1));
        for (const sx of [-1, 1]) {
          const p = P(vx + sx * sw * (port ? 1.12 : 1.25), gy, k);
          addDiya(g, p.x, p.y, u * 0.022 * k, sx > 0 ? -1 : 1, 1);
          pool(g, p.x, p.y, u * 0.06 * k, u * 0.02 * k, '#ff9a40', 0.22);
        }
      }
      // tulsi vrindavan and an anar fountain on the sides
      const tp = port ? { x: w * 0.9, y: h * 0.83, s: h * 0.1 } : { x: w * 0.165, y: h * 0.875, s: h * 0.19 };
      pool(g, tp.x, tp.y, tp.s * 0.9, tp.s * 0.18, '#ff9a40', 0.25);
      const tf = tulsi(g, fork(r), tp.x, tp.y, tp.s, port ? -1 : 1);
      addDiya(g, tf.x, tf.y + tp.s * 0.06, tp.s * 0.13, 1, 1);
    }

    function foreground(g: Ctx) {
      const r = R.yard;
      if (port) {
        pottedPlant(g, r, w * 0.03, h * 1.01, h * 0.11, 'banana', 1, 0.8);
        pottedPlant(g, r, w * 0.98, h * 1.01, h * 0.09, 'croton', -1, 0.8);
      } else {
        pottedPlant(g, r, w * 0.035, h * 1.02, h * 0.2, 'banana', 1, 0.8);
        pottedPlant(g, r, w * 0.975, h * 1.02, h * 0.17, 'croton', -1, 0.8);
      }
    }

    function finish(g: Ctx) {
      // warm haze hanging over the courtyard and a little firework smoke
      pool(g, vx, gy, w * 0.7, h * 0.1, '#ff9a50', 0.1);
      wash(g, vx, h * 0.98, w * 0.8, h * 0.12, '#0a0410', 0.35);
      vignette(g, w, h, 0.42, '#06020c');
    }

    return {
      skyRects,
      painterly: { radiusScale: 1.2, strokes: 0.8, saturation: 1.1, warmth: 0.25, contrast: 1.05 },
      base(g) {
        paintSky(g);
        if (!port) paintFar(g);
        paintTrees(g);
        if (!port) paintBoundary(g);
        paintYard(g);
        paintWall(g);
        chhajja(g, x0, x1, f1 - sh2 * 0.02, u * 0.03, Math.round(fw / (u * 0.07)));
        paintCornice(g);
        for (const bx of bays) groundWindow(g, bx);
        for (const bx of bays) jharokha(g, bx);
        balcony(g);
        door(g);
        paintTowers(g);
        paintPlinth(g);
        // diyas along the plinth ledge (not on the steps)
        const n = 22;
        for (let i = 0; i < n; i++) {
          const x = x0 + (fw * (i + 0.5)) / n;
          if (Math.abs(x - vx) < sw * 1.1) continue;
          addDiya(g, x, pt - u * 0.004, u * 0.019, x < vx ? 1 : -1, 0.85);
        }
        // lanterns hanging from the chhajja
        for (const k of kandils) lantern(g, R.deco, k.x, f1 + u * 0.02, k.y, k.s, k.color, 'kandil');
        // scalloped lights on the chhajja lip (both wings)
        for (const [a, b] of [
          [x0, vx - cb / 2],
          [vx + cb / 2, x1],
        ] as const) {
          const k = Math.max(2, Math.round((b - a) / (u * 0.07)));
          const anchors: Pt[] = [];
          for (let i = 0; i <= k; i++) anchors.push({ x: a + ((b - a) * i) / k, y: f1 + u * 0.004 });
          bulbsOn(R.house, scallops(g, anchors, u * 0.012, 5, rgba('#1a0c10', 0.7), Math.max(1, u * 0.002)), FESTIVE, u * 0.005, bulbs);
        }
        steps(g);
        yardProps(g);
        foreground(g);
        finish(g);
      },
      lights(g) {
        const r = R.fx;
        // stars (crisp) and fireworks on their own layer, cut out where the house and trees stand
        const layer = makeCanvas(w, h);
        const lg = ctx2d(layer);
        withState(lg, () => {
          lg.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 90; i++) {
            const x = rand(r, 0, w);
            const y = hz * 0.75 * Math.pow(r(), 1.5);
            const s = u * rand(r, 0.0012, 0.003);
            lg.fillStyle = `rgba(255,${Math.round(rand(r, 225, 255))},${Math.round(rand(r, 200, 255))},${rand(r, 0.35, 0.95).toFixed(2)})`;
            lg.beginPath();
            lg.arc(x, y, s, 0, TAU);
            lg.fill();
          }
        });
        for (const b of bursts) firework(lg, r, b.x, b.y, b.r, b.color, b.kind, 0.95);
        for (let i = 0; i < 6; i++) sparkle(lg, rand(r, 0, w), rand(r, 0, hz * 0.6), u * rand(r, 0.004, 0.009), '#fff4d8', rand(r, 0.5, 0.9));
        withState(lg, () => {
          lg.globalCompositeOperation = 'destination-out';
          lg.fillStyle = '#000';
          lg.beginPath();
          silhouette(lg);
          lg.fill();
          lg.beginPath();
          for (const c of neem) {
            lg.moveTo(c.x + c.r * 0.9, c.y);
            lg.arc(c.x, c.y, c.r * 0.9, 0, TAU);
          }
          lg.fill();
        });
        withBlend(g, 'lighter', () => g.drawImage(layer as CanvasImageSource, 0, 0));
        for (const fwn of farWindows) {
          g.fillStyle = fwn.c;
          g.fillRect(fwn.x, fwn.y, fwn.w, fwn.h);
        }
        drawBulbs(g, smallBulbs, 0.8);
        // lit openings
        for (const o of openings) {
          pool(g, o.x, o.y, o.rx, o.ry, '#ffb050', 0.32 * o.i);
          glow(g, o.x, o.y, Math.max(o.rx, o.ry) * 2.2, '#ff8a30', 0.12 * o.i);
        }
        for (const l of lamps) glow(g, l.x, l.y, l.s * 1.4, l.color, 0.5 * l.i);
        drawBulbs(g, bulbs, 0.95);
        for (const k of kandils) lanternGlow(g, k.x, k.y, k.s, k.color === '#e2412b' ? '#ff6a3a' : '#ff9a2a', 1.1);
        for (const f of flames) diyaFlame(g, r, f.x, f.y, f.s, f.i);
        // an anar fountain on the courtyard
        if (!port) anar(g, r, w * 0.84, h * 0.87, h * 0.22, 220);
        else anar(g, r, w * 0.84, h * 0.955, h * 0.12, 160);
      },
      sky(g) {
        g.fillStyle = '#fff';
        g.fillRect(0, 0, w, gy);
        g.fillStyle = '#000';
        g.beginPath();
        silhouette(g);
        g.fill();
        for (const s of farShapes) g.fillRect(s.x, s.y, s.w, s.h + h);
        g.beginPath();
        for (const c of neem) {
          g.moveTo(c.x + c.r, c.y);
          g.arc(c.x, c.y, c.r, 0, TAU);
        }
        g.fill();
        g.fillRect(0, gy - h * 0.09, w, h);
        // the tall foreground banana leaves (landscape) stand in front of the sky
        if (!port) g.fillRect(0, h * 0.45, w * 0.12, h);
      },
    };
  },
};

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
