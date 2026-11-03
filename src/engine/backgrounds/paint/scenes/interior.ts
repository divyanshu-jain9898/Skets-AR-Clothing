import type { NRect, SceneSpec } from '../scene';
import {
  type Bulb,
  type Ctx,
  type Pt,
  TAU,
  ctx2d,
  makeCanvas,
  diya,
  diyaFlame,
  drawBulbs,
  ellipse,
  firework,
  glow,
  marigoldGarland,
  marigoldStrand,
  petals,
  rand,
  rangoli,
  rgba,
  sagPath,
  samai,
  smoke,
  sparkle,
  toran,
  vignette,
  wash,
  withState,
  lotus,
  type BurstKind,
} from '../kit';
import { type Flame, archPath, along, band, box, bulbsOn, clipTo, daubs, fillPoly, fork, lin, line, pool, scallops, shade, domePath } from './house-parts';
import { bellStrand, bolster, brassLantern, buti, cushion, drape, rug, thali, urli } from './interior-parts';

interface Win {
  x: number;
  a: number;
}

/**
 * "Traditional Indian Interior": a warm haveli room on Diwali night. Cusped
 * arches open onto the night sky, an alcove frames the person, a brass samai
 * and a rangoli with diyas glow on one side, a divan with brocade bolsters
 * and a thali of sweets on the other.
 */
export const interior: SceneSpec = {
  id: 'interior',
  compose(w, h, rng) {
    const u = Math.min(w, h);
    const port = w / h < 1.2;
    const hz = h * 0.57;
    const vx = w / 2;
    const fy = h * 0.78;
    const focal = 0.55 * Math.max(w, h);
    const P = (x: number, y: number, k: number): Pt => ({ x: vx + (x - vx) * k, y: hz + (y - hz) * k });
    const bx0 = port ? -w * 0.02 : w * 0.075;
    const bx1 = w - bx0;
    const frieze = h * (port ? 0.06 : 0.075);
    // central alcove
    const ca = port ? w * 0.27 : w * 0.135;
    const cSpring = h * (port ? 0.36 : 0.34);
    const cRise = h * (port ? 0.2 : 0.2);
    const ck = 0.84;
    const cStep = h * 0.03;
    // side windows
    const wins: Win[] = port
      ? [
          { x: w * 0.06, a: w * 0.115 },
          { x: w * 0.94, a: w * 0.115 },
        ]
      : [
          { x: w * 0.205, a: w * 0.072 },
          { x: w * 0.795, a: w * 0.072 },
        ];
    const wSpring = h * (port ? 0.34 : 0.33);
    const wRise = h * (port ? 0.14 : 0.16);
    const wSill = h * 0.62;
    const rail = h * 0.06;
    const wk = 0.93;
    const dado = fy - h * 0.1;

    const R = { wall: fork(rng), sky: fork(rng), deco: fork(rng), floor: fork(rng), props: fork(rng), fx: fork(rng) };
    const flames: Flame[] = [];
    const bulbs: Bulb[] = [];
    const lamps: { x: number; y: number; s: number; c: string; i: number }[] = [];
    const glints: Pt[] = [];

    const addDiya = (g: Ctx, x: number, y: number, s: number, dir: 1 | -1 = 1, i = 1) => {
      const f = diya(g, x, y, s, { dir });
      flames.push({ x: f.x, y: f.y, s, i });
    };

    const bursts: { x: number; y: number; r: number; color: string; kind: BurstKind }[] = [];
    for (const [i, wn] of wins.entries()) {
      const top = wSpring - wRise;
      bursts.push({ x: wn.x + (i ? -1 : 1) * wn.a * 0.25, y: top + (wSill - top) * 0.32, r: wn.a * 0.62, color: i ? '#ff4fa3' : '#ffcf6b', kind: i ? 'peony' : 'willow' });
      bursts.push({ x: wn.x + (i ? 1 : -1) * wn.a * 0.45, y: top + (wSill - top) * 0.6, r: wn.a * 0.3, color: i ? '#7fd6ff' : '#9dff8a', kind: 'chrysanthemum' });
    }
    const skyRects: NRect[] = wins.map((wn) => {
      const a = P(wn.x - wn.a * 0.85, 0, wk).x / w;
      const b = P(wn.x + wn.a * 0.85, 0, wk).x / w;
      return [Math.max(0.005, a), (wSpring - wRise * 0.4) / h, Math.min(0.995, b), (wSill - rail - h * 0.06) / h] as NRect;
    });

    const winPath = (g: Ctx, wn: Win, k: number) => {
      const b = P(wn.x, wSill, k);
      const s = P(wn.x, wSpring, k);
      archPath(g, b.x, b.y, wn.a * k, s.y, wRise * k, 7, 0.32);
    };
    const skyPath = (g: Ctx, wn: Win) => {
      const b = P(wn.x, wSill - rail * 0.6, wk);
      const s = P(wn.x, wSpring, wk);
      archPath(g, b.x, b.y, wn.a * wk, s.y, wRise * wk, 7, 0.32);
    };
    const alcovePath = (g: Ctx, k: number, lift = 0) => {
      const b = P(vx, fy - lift, k);
      const s = P(vx, cSpring, k);
      archPath(g, b.x, b.y, ca * k, s.y, cRise * k, 9, 0.3);
    };

    // light sources that also light the walls (computed up front)
    const samaiPos = port ? { x: w * 0.13, y: h * 0.86, s: h * 0.3 } : { x: w * 0.105, y: h * 0.85, s: h * 0.42 };
    const thaliPos = port ? { x: w * 0.8, y: h * 0.885, r: w * 0.13 } : { x: w * 0.765, y: h * 0.855, r: w * 0.07 };
    const lanternPos = port
      ? [
          { x: w * 0.12, y: h * 0.17, s: u * 0.11 },
          { x: w * 0.88, y: h * 0.17, s: u * 0.11 },
        ]
      : [
          { x: w * 0.04, y: h * 0.27, s: u * 0.11 },
          { x: w * 0.96, y: h * 0.27, s: u * 0.11 },
        ];

    // ------------------------------------------------------------ walls
    function paintWall(g: Ctx) {
      const r = R.wall;
      box(g, 0, 0, w, fy + 2, lin(g, 0, 0, 0, fy, [[0, '#3a160e'], [0.25, '#6a2a14'], [0.6, '#9a4a1e'], [1, '#7a3416']]));
      daubs(g, r, 0, 0, w, fy, 300, ['#4a1a0c', '#b8622a', '#7a3014', '#d0803a', '#5a2410'], u * 0.04, 0.13, 0, 0.25);
      // painted floral lattice (Rajasthani buti on a diamond grid), as a pattern tile
      const ts = Math.max(6, Math.round(u * 0.075));
      const tile = makeCanvas(ts, ts);
      const tg = ctx2d(tile);
      for (const [bx, by] of [
        [0.5, 0.25],
        [0, 0.75],
        [1, 0.75],
      ] as const) {
        buti(tg, bx * ts, by * ts, ts * 0.22, '#f2d6a0', '#c8283a', 0.32);
        tg.fillStyle = rgba('#e8b448', 0.3);
        tg.fillRect(bx * ts - ts * 0.015, (by + 0.5) * ts - ts * 0.06 - (by > 0.5 ? ts : 0), ts * 0.03, ts * 0.12);
      }
      const pat = g.createPattern(tile as CanvasImageSource, 'repeat');
      if (pat) {
        withState(g, () => {
          g.translate(vx % ts, frieze);
          g.fillStyle = pat;
          g.fillRect(-ts, 0, w + ts * 2, dado - frieze);
        });
      }
      // light on the walls
      pool(g, samaiPos.x + w * 0.02, samaiPos.y - samaiPos.s * 0.8, u * 0.4, u * 0.36, '#ff9a3a', 0.45);
      pool(g, thaliPos.x, thaliPos.y - h * 0.12, u * 0.36, u * 0.2, '#ff9a3a', 0.25);
      for (const l of lanternPos) pool(g, l.x, l.y, u * 0.28, u * 0.3, '#ff9a3a', 0.35);
      pool(g, vx, fy - h * 0.05, ca * 1.8, h * 0.2, '#ff8a3a', 0.2);
      // dado band
      box(g, 0, dado, w, fy - dado, lin(g, 0, dado, 0, fy, [[0, '#5a1e10'], [1, '#3a120a']]));
      box(g, 0, dado - h * 0.008, w, h * 0.01, lin(g, 0, dado - h * 0.008, 0, dado + h * 0.002, [[0, '#f8d898'], [1, '#a06a30']]));
      const panels = port ? 6 : 12;
      for (let i = 0; i < panels; i++) {
        const cx = (w * (i + 0.5)) / panels;
        const pa = (w / panels) * 0.32;
        g.beginPath();
        archPath(g, cx, fy - h * 0.012, pa, dado + h * 0.04, h * 0.025, 5, 0.35);
        g.fillStyle = rgba('#200806', 0.45);
        g.fill();
        g.strokeStyle = rgba('#e8b448', 0.55);
        g.lineWidth = Math.max(1, u * 0.003);
        g.stroke();
        // a painted vase with flowers in each panel
        ellipse(g, cx, fy - h * 0.03, pa * 0.28, h * 0.012, rgba('#2a8a84', 0.7));
        buti(g, cx, fy - h * 0.055, pa * 0.4, '#e2412b', '#ffd27a', 0.7);
      }
      band(g, 0, fy - h * 0.03, w, h * 0.03, '#000000', 0, 0.35);
    }

    function sideWalls(g: Ctx) {
      if (port) return;
      const r = R.wall;
      for (const sx of [-1, 1]) {
        const edge = sx < 0 ? bx0 : bx1;
        const fx = sx < 0 ? 0 : w;
        const k0 = (vx - fx) / (vx - edge);
        const yb = hz + (fy - hz) * k0;
        const yt = hz + (0 - hz) * k0;
        const quad = [{ x: edge, y: 0 }, { x: fx, y: yt }, { x: fx, y: yb }, { x: edge, y: fy }];
        fillPoly(g, quad, lin(g, edge, 0, fx, 0, [[0, '#5a2210'], [1, '#2a0c06']]));
        clipTo(
          g,
          () => quad.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))),
          () => {
            daubs(g, r, Math.min(edge, fx), 0, Math.max(edge, fx), yb, 40, ['#3a120a', '#9a4a1e', '#6a2a12'], u * 0.03, 0.15, Math.PI / 2, 0.2);
            // dado continues on the side wall
            const dk = (y: number, k: number) => hz + (y - hz) * k;
            fillPoly(g, [{ x: edge, y: dado }, { x: fx, y: dk(dado, k0) }, { x: fx, y: yb }, { x: edge, y: fy }], rgba('#2a0a06', 0.7));
            // a niche with a lamp on the side wall
            const nk = (k0 + 1) / 2;
            const nx = vx + (edge - vx) * nk;
            const ny = dk(h * 0.5, nk);
            g.beginPath();
            archPath(g, nx, ny, u * 0.03 * nk, ny - u * 0.06 * nk, u * 0.04 * nk, 0);
            g.fillStyle = '#2a0c06';
            g.fill();
            addDiya(g, nx, ny - u * 0.008, u * 0.03 * nk, sx < 0 ? 1 : -1, 1);
          },
        );
        // corner pilaster
        box(g, edge - u * 0.012, 0, u * 0.024, fy, lin(g, edge - u * 0.012, 0, edge + u * 0.012, 0, [[0, '#6a3010'], [0.5, '#f2c880'], [1, '#5a2410']]));
      }
    }

    // arch frame: carved cream band with gold edges
    function archFrame(g: Ctx, path: () => void, width: number) {
      g.beginPath();
      path();
      g.strokeStyle = '#3a1408';
      g.lineWidth = width * 1.9;
      g.stroke();
      g.strokeStyle = lin(g, 0, 0, 0, fy, [[0, '#c89a68'], [0.5, '#f2d0a0'], [1, '#d8a878']]);
      g.lineWidth = width * 1.4;
      g.stroke();
      g.strokeStyle = '#e8b448';
      g.lineWidth = width * 0.35;
      g.stroke();
      g.setLineDash([width * 0.25, width * 0.55]);
      g.strokeStyle = rgba('#7a2a10', 0.7);
      g.lineWidth = width * 0.22;
      g.stroke();
      g.setLineDash([]);
    }

    function alcove(g: Ctx) {
      const r = R.deco;
      // reveal (deep jambs and soffit)
      g.beginPath();
      alcovePath(g, 1);
      g.fillStyle = lin(g, 0, cSpring - cRise, 0, fy, [[0, '#2a0e08'], [1, '#5a2410']]);
      g.fill();
      // back wall of the alcove: deep peacock teal, warmly lit from below
      const back = () => alcovePath(g, ck, cStep);
      g.beginPath();
      back();
      g.fillStyle = lin(g, 0, P(0, cSpring - cRise, ck).y, 0, P(0, fy, ck).y, [[0, '#071c22'], [0.45, '#0e3a3c'], [0.8, '#1d5248'], [1, '#6a4a2a']]);
      g.fill();
      clipTo(g, back, () => {
        const bt = P(vx, cSpring - cRise, ck).y;
        const bb = P(vx, fy - cStep, ck).y;
        daubs(g, r, vx - ca, bt, vx + ca, bb, 70, ['#0a2a30', '#2a6a60', '#123c40', '#3a5a48'], u * 0.04, 0.16, Math.PI / 2, 0.3);
        // faded gold stencil: inner arch border and sparse butis
        g.beginPath();
        archPath(g, vx, bb, ca * ck * 0.86, P(0, cSpring, ck).y + h * 0.02, cRise * ck * 0.85, 9, 0.3);
        g.strokeStyle = rgba('#d8a848', 0.28);
        g.lineWidth = u * 0.006;
        g.stroke();
        for (let j = 0; j < 6; j++)
          for (let i = -2; i <= 2; i++) {
            const x = vx + (i + (j % 2) * 0.5) * ca * 0.38;
            const y = bt + (bb - bt) * (0.28 + j * 0.12);
            buti(g, x, y, u * 0.022, '#d8a848', '#c8283a', 0.22);
          }
        pool(g, vx, bb, ca * 1.1, (bb - bt) * 0.35, '#ff9a3a', 0.3);
        band(g, vx - ca, bt, ca * 2, (bb - bt) * 0.3, '#000000', 0.35, 0);
      });
      // raised floor of the alcove and its step
      const fl = [P(vx - ca, fy - cStep, 1), P(vx + ca, fy - cStep, 1), P(vx + ca, fy - cStep, ck), P(vx - ca, fy - cStep, ck)];
      fillPoly(g, [fl[3], fl[2], fl[1], fl[0]], lin(g, 0, fl[2].y, 0, fl[0].y, [[0, '#6a4028'], [1, '#b07a50']]));
      box(g, vx - ca, fy - cStep, ca * 2, cStep, lin(g, 0, fy - cStep, 0, fy, [[0, '#e8c090'], [1, '#8a5a3a']]));
      // a row of small diyas on the step
      for (let i = 0; i < 9; i++) {
        const x = vx - ca * 0.88 + (ca * 1.76 * i) / 8;
        addDiya(g, x, fy - cStep - u * 0.002, u * 0.022, i < 4 ? 1 : -1, 0.75);
      }
      archFrame(g, () => alcovePath(g, 1), u * 0.016);
    }

    function windows(g: Ctx) {
      const r = R.sky;
      for (const [i, wn] of wins.entries()) {
        const side = i ? 1 : -1;
        // reveal
        g.beginPath();
        winPath(g, wn, 1);
        g.fillStyle = lin(g, 0, wSpring - wRise, 0, wSill, [[0, '#2a0e08'], [1, '#4a1a0c']]);
        g.fill();
        // sky
        const top = wSpring - wRise;
        clipTo(
          g,
          () => skyPath(g, wn),
          () => {
            box(g, wn.x - wn.a * 1.2, top - h * 0.02, wn.a * 2.4, wSill - top + h * 0.02, lin(g, 0, top, 0, wSill, [[0, '#050722'], [0.35, '#141448'], [0.62, '#3a1d5c'], [0.82, '#8a3858'], [1, '#c8603e']]));
            daubs(g, r, wn.x - wn.a, top, wn.x + wn.a, wSill, 40, ['#22226a', '#4a2368', '#121446'], u * 0.05, 0.16, 0, 0.1);
            smoke(g, r, wn.x - wn.a, top + (wSill - top) * 0.3, wn.x + wn.a, top + (wSill - top) * 0.7, 3, '#8a4a7a', 0.18);
            for (const b of bursts) if (Math.abs(b.x - wn.x) < wn.a * 1.2) glow(g, b.x, b.y, b.r * 1.6, b.color, 0.14);
            // distant rooftops and a temple spire above the railing
            const base = P(0, wSill - rail * 0.6, wk).y;
            g.fillStyle = '#1a1030';
            let x = wn.x - wn.a * 1.1;
            while (x < wn.x + wn.a * 1.1) {
              const bw = wn.a * rand(r, 0.25, 0.5);
              const bh = h * rand(r, 0.03, 0.07);
              g.fillRect(x, base - bh, bw + 1, bh + 2);
              x += bw;
            }
            const tx = wn.x + side * wn.a * 0.3;
            g.beginPath();
            domePath(g, tx, base - h * 0.06, wn.a * 0.12, h * 0.07);
            g.fill();
            g.fillRect(tx - wn.a * 0.14, base - h * 0.06, wn.a * 0.28, h * 0.06);
            pool(g, wn.x, base, wn.a * 1.4, h * 0.05, '#ff8a40', 0.25);
          },
        );
        // jaali railing at the outer face
        const rb = P(wn.x, wSill, wk);
        const rt = P(wn.x, wSill - rail, wk);
        const ra = wn.a * wk;
        box(g, rb.x - ra, rt.y, ra * 2, rb.y - rt.y, lin(g, 0, rt.y, 0, rb.y, [[0, '#f2d6a6'], [1, '#a87048']]));
        const holes = 7;
        for (let k = 0; k < holes; k++) {
          const hx = rb.x - ra * 0.86 + (ra * 1.72 * (k + 0.5)) / holes;
          g.beginPath();
          archPath(g, hx, rb.y - (rb.y - rt.y) * 0.2, (ra * 1.72) / holes / 3.4, rt.y + (rb.y - rt.y) * 0.45, (rb.y - rt.y) * 0.18, 0);
          g.fillStyle = '#2a1a48';
          g.fill();
        }
        box(g, rb.x - ra * 1.02, rt.y - h * 0.008, ra * 2.04, h * 0.01, '#f8dcae');
        // sill (top surface visible below eye level)
        const s0 = P(wn.x - wn.a, wSill, 1);
        const s1 = P(wn.x + wn.a, wSill, 1);
        const s2 = P(wn.x + wn.a, wSill, wk);
        const s3 = P(wn.x - wn.a, wSill, wk);
        fillPoly(g, [s0, s1, s2, s3], '#c89060');
        archFrame(g, () => winPath(g, wn, 1), u * 0.014);
        // diyas on the sill
        for (const f of [-0.6, 0, 0.6]) addDiya(g, wn.x + f * wn.a, wSill - u * 0.002, u * 0.024, f > 0 ? -1 : 1, 0.95);
        // cool firework light spilling in, and the drapes' shadows on the wall
        pool(g, wn.x, wSill, wn.a * 1.8, h * 0.14, '#7a6ad0', 0.12);
        const dTop = wSpring - wRise * 0.55;
        for (const sd of [-1, 1]) shade(g, wn.x + sd * wn.a * 1.25 + w * 0.006, (dTop + fy) / 2, wn.a * 0.45, (fy - dTop) * 0.55, 0.3);
        drape(g, r, wn.x - wn.a * 0.98, dTop, fy + h * 0.005, wn.a * 0.5, h * 0.47, -1, i ? '#a0104a' : '#a0104a');
        drape(g, r, wn.x + wn.a * 0.98, dTop, fy + h * 0.005, wn.a * 0.5, h * 0.47, 1, '#a0104a');
        // pelmet: marigold swag across the arch
        marigoldGarland(g, fork(r), sagPath({ x: wn.x - wn.a * 1.05, y: dTop - h * 0.005 }, { x: wn.x + wn.a * 1.05, y: dTop - h * 0.005 }, h * 0.025, 18), u * 0.011);
      }
    }

    function pilasters(g: Ctx) {
      const r = R.deco;
      const cols: { x: number; wd: number }[] = [];
      for (const sx of [-1, 1]) {
        const wn = wins[sx < 0 ? 0 : 1];
        const inner = vx + sx * ca;
        const outer = wn.x - sx * wn.a;
        cols.push({ x: (inner + outer) / 2, wd: Math.abs(outer - inner) - u * 0.035 });
        if (!port) {
          const o2 = wn.x + sx * wn.a;
          const edge = sx < 0 ? bx0 : bx1;
          cols.push({ x: (o2 + edge) / 2, wd: Math.abs(edge - o2) - u * 0.03 });
        }
      }
      for (const c of cols) {
        if (c.wd < u * 0.015) continue;
        const x0 = c.x - c.wd / 2;
        box(g, x0, frieze + h * 0.02, c.wd, dado - frieze - h * 0.02, lin(g, x0, 0, x0 + c.wd, 0, [[0, '#7a3416'], [0.5, '#b05a24'], [1, '#6a2a12']]));
        g.strokeStyle = rgba('#e8b448', 0.7);
        g.lineWidth = Math.max(1, u * 0.004);
        g.strokeRect(x0 + c.wd * 0.12, frieze + h * 0.04, c.wd * 0.76, dado - frieze - h * 0.06);
        // capital
        box(g, x0 - c.wd * 0.08, cSpring - h * 0.02, c.wd * 1.16, h * 0.02, lin(g, 0, cSpring - h * 0.02, 0, cSpring, [[0, '#f8d898'], [1, '#9a6028']]));
        // niche (taaq) with a diya
        const ny = h * 0.5;
        const na = Math.min(c.wd * 0.3, u * 0.035);
        g.beginPath();
        archPath(g, c.x, ny, na, ny - na * 1.3, na * 1.1, 5, 0.35);
        g.fillStyle = lin(g, 0, ny - na * 2.4, 0, ny, [[0, '#2a0c06'], [1, '#6a2a10']]);
        g.fill();
        g.strokeStyle = '#f2c880';
        g.lineWidth = Math.max(1, u * 0.004);
        g.stroke();
        box(g, c.x - na * 1.3, ny, na * 2.6, u * 0.01, '#f2c880');
        addDiya(g, c.x, ny - u * 0.003, na * 1.1, c.x < vx ? 1 : -1, 0.9);
        lamps.push({ x: c.x, y: ny - na, s: na * 2.5, c: '#ff9a3a', i: 0.6 });
        // mirror inlay glints above the niche
        for (let k = 0; k < 5; k++) glints.push({ x: c.x + rand(r, -0.3, 0.3) * c.wd, y: ny - na * rand(r, 3, 7) });
        // hanging bells and marigold strand from the frieze
        marigoldStrand(g, fork(r), c.x, frieze + h * 0.03, h * 0.15, u * 0.011);
      }
    }

    function topFrieze(g: Ctx) {
      const r = R.deco;
      box(g, 0, 0, w, frieze, lin(g, 0, 0, 0, frieze, [[0, '#1a0804'], [0.6, '#4a1e0a'], [1, '#6a3010']]));
      g.strokeStyle = rgba('#e8b448', 0.75);
      g.lineWidth = Math.max(1, u * 0.004);
      g.beginPath();
      g.moveTo(0, frieze * 0.25);
      g.lineTo(w, frieze * 0.25);
      g.moveTo(0, frieze * 0.95);
      g.lineTo(w, frieze * 0.95);
      g.stroke();
      // carved lotus-petal band with gilded beads
      const n = Math.round(w / (u * 0.04));
      for (let i = 0; i < n; i++) {
        const x = (w * (i + 0.5)) / n;
        const pw = w / n;
        g.beginPath();
        archPath(g, x, frieze * 0.88, pw * 0.34, frieze * 0.62, frieze * 0.26, 0, 0.38, 0.6);
        g.fillStyle = lin(g, 0, frieze * 0.36, 0, frieze * 0.88, [[0, '#f2c46a'], [1, '#8a4a14']]);
        g.fill();
        ellipse(g, x + pw / 2, frieze * 0.14, u * 0.004, u * 0.004, '#f2c46a');
      }
      // toran across the top
      toran(g, fork(r), -u * 0.02, w + u * 0.02, frieze + u * 0.012, u * 0.05);
      // scalloped fairy lights under the toran
      const k = Math.round(w / (u * 0.12));
      const anchors: Pt[] = [];
      for (let i = 0; i <= k; i++) anchors.push({ x: (w * i) / k, y: frieze + u * 0.045 });
      bulbsOn(r, scallops(g, anchors, u * 0.02, 6, rgba('#1a0804', 0.6), Math.max(1, u * 0.002)), ['#ffd27a', '#ffe7a8', '#ffb547'], u * 0.0055, bulbs);
    }

    function archLights(g: Ctx) {
      const r = R.deco;
      // fairy lights tracing the alcove arch
      const pts: Pt[] = [];
      const dense = 40;
      for (let i = 0; i <= dense; i++) {
        const t = i / dense;
        // sample the pointed arch outline just outside the frame
        const a = ca * 1.09;
        const c = 0.3 * a;
        const Rr = a + c;
        const nat = Math.sqrt(Rr * Rr - c * c);
        const phi = Math.acos(-c / Rr);
        const left = t < 0.5;
        const tt = left ? t * 2 : (1 - t) * 2;
        const th = Math.PI + (phi - Math.PI) * tt;
        const px = vx + c + Rr * Math.cos(th);
        pts.push({ x: left ? px : 2 * vx - px, y: cSpring - Rr * Math.sin(th) * ((cRise * 1.06) / nat) });
      }
      const lp = [{ x: vx - ca * 1.09, y: h * 0.64 }, ...pts, { x: vx + ca * 1.09, y: h * 0.64 }];
      bulbsOn(r, along(lp, port ? 46 : 40), ['#ffe7a8', '#ffcf6b'], u * 0.0048, bulbs);
      // marigold garlands draped up the alcove arch, strands and bells at its sides
      for (const sx of [-1, 1]) {
        const a = { x: vx + sx * ca * 1.12, y: cSpring };
        const m = { x: vx + sx * ca * 0.55, y: cSpring - cRise * 0.72 };
        marigoldGarland(g, fork(r), sagPath(a, m, h * 0.03, 16), u * 0.012);
        marigoldStrand(g, fork(r), a.x, a.y, h * 0.2, u * 0.012);
        bellStrand(g, a.x + sx * u * 0.03, cSpring + h * 0.01, h * 0.08, u * 0.02);
      }
    }

    // ------------------------------------------------------------ floor
    function paintFloor(g: Ctx) {
      const r = R.floor;
      box(g, 0, fy, w, h - fy, lin(g, 0, fy, 0, h, [[0, '#8a5a3a'], [0.3, '#6a3e28'], [0.7, '#3e2218'], [1, '#22120c']]));
      // big marble tiles in perspective
      const kb = (h - hz) / (fy - hz);
      const tile = u * 0.16;
      const rows: number[] = [1];
      for (let n = 1; n < 30; n++) {
        if (focal - n * tile <= 0) break;
        const k = focal / (focal - n * tile);
        if (k > kb * 1.05) break;
        rows.push(k);
      }
      rows.push(kb * 1.05);
      const cols = 12;
      for (let j = 0; j < rows.length - 1; j++)
        for (let i = -cols; i < cols; i++) {
          const q = [P(vx + i * tile, fy, rows[j]), P(vx + (i + 1) * tile, fy, rows[j]), P(vx + (i + 1) * tile, fy, rows[j + 1]), P(vx + i * tile, fy, rows[j + 1])];
          if (q[2].x < 0 || q[3].x > w) continue;
          const t = r();
          fillPoly(g, q, (i + j) % 2 ? rgba('#f0d0a0', 0.06 + t * 0.06) : rgba('#000000', 0.05 + t * 0.08));
        }
      g.strokeStyle = rgba('#1a0a06', 0.35);
      g.lineWidth = Math.max(1, u * 0.003);
      g.beginPath();
      for (let i = -cols; i <= cols; i++) {
        const a = P(vx + i * tile, fy, 1);
        const b = P(vx + i * tile, fy, kb * 1.05);
        g.moveTo(a.x, a.y);
        g.lineTo(b.x, b.y);
      }
      for (const k of rows) {
        const y = hz + (fy - hz) * k;
        g.moveTo(0, y);
        g.lineTo(w, y);
      }
      g.stroke();
      // inlay border along the wall
      const ib = hz + (fy - hz) * 1.04;
      box(g, 0, fy, w, ib - fy, lin(g, 0, fy, 0, ib, [[0, '#3a1a0c'], [1, '#7a4a2a']]));
      line(g, 0, ib, w, ib, rgba('#e8b448', 0.5), Math.max(1, u * 0.003));
      daubs(g, r, 0, fy, w, h, 80, ['#a07050', '#2a140c', '#7a4a30'], u * 0.06, 0.12, 0, 0.08);
      // reflections: the glowing alcove, windows and lamps on polished stone
      for (const wn of wins) pool(g, wn.x, fy + h * 0.07, wn.a * 0.9, h * 0.06, '#7a4aa0', 0.18);
      pool(g, samaiPos.x, samaiPos.y + h * 0.03, u * 0.2, h * 0.05, '#ff9a3a', 0.35);
      pool(g, vx, fy + h * 0.04, ca * 1.2, h * 0.05, '#ff9a4a', 0.2);
    }

    function floorProps(g: Ctx) {
      const r = R.props;
      // rug under the person
      if (!port) {
        const rw = w * 0.17;
        const k0 = 1.12;
        const k1 = (h * 1.05 - hz) / (fy - hz);
        const q = [P(vx - rw, fy, k0), P(vx + rw, fy, k0), P(vx + rw, fy, k1), P(vx - rw, fy, k1)];
        rug(g, r, q, '#6a1020', '#1e1838', '#d0983a');
        clipTo(
          g,
          () => q.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))),
          () => {
            daubs(g, r, q[3].x, q[0].y, q[2].x, h, 60, ['#2a0610', '#c04a3a', '#3a1030'], u * 0.05, 0.14, 0, 0.1);
            g.fillStyle = lin(g, 0, q[0].y, 0, h, [[0, rgba('#ff9a50', 0.12)], [0.5, rgba('#000000', 0)], [1, rgba('#000000', 0.4)]]);
            g.fillRect(0, q[0].y, w, h - q[0].y);
          },
        );
      }
      // samai on the left with its light pool
      pool(g, samaiPos.x, samaiPos.y, u * 0.24, u * 0.06, '#ffb050', 0.4);
      const sf = samai(g, samaiPos.x, samaiPos.y, samaiPos.s);
      for (const f of sf) flames.push({ x: f.x, y: f.y, s: samaiPos.s * 0.07, i: 1.1 });
      // big rangoli with diyas, front left
      const rc = port ? { x: w * 0.3, y: h * 0.945 } : { x: w * 0.2, y: h * 0.915 };
      const RR = port ? w * 0.2 : w * 0.105;
      const tilt = Math.max(0.24, Math.min(0.48, (rc.y - hz) / focal));
      pool(g, rc.x, rc.y, RR * 1.6, RR * tilt * 1.6, '#ff9a3a', 0.25);
      const rf = rangoli(g, fork(r), rc.x, rc.y, RR, { tilt, petals: 16, rings: 5, diyas: 12, palette: ['#e2412b', '#ffb000', '#d6247b', '#13a08c', '#5b2a86', '#fff4e0', '#ff7a00'] });
      for (const f of rf) flames.push({ x: f.x, y: f.y, s: RR * 0.16, i: 1 });
      // divan along the right wall section
      if (!port) divan(g);
      // low chowki with a thali
      chowki(g, thaliPos.x, thaliPos.y, thaliPos.r);
      // urli in the right front corner
      const ur = port ? { x: w * 0.83, y: h * 0.975, r: w * 0.16 } : { x: w * 0.92, y: h * 0.95, r: w * 0.085 };
      const uf = urli(g, r, ur.x, ur.y, ur.r, 0.36);
      flames.push(...uf);
      // petals scattered
      petals(g, r, w * 0.05, fy + h * 0.05, w * 0.35, h * 0.99, 40, u * 0.006);
      petals(g, r, w * 0.62, fy + h * 0.08, w * 0.95, h * 0.99, 30, u * 0.006);
      // a few lotus blooms at the alcove step
      for (const sx of [-1, 1]) lotus(g, vx + sx * ca * 1.25, fy + h * 0.01, u * 0.05, '#f06292');
    }

    function divan(g: Ctx) {
      const r = R.props;
      const xa = w * 0.64;
      const xb = w * 1.02;
      const top = fy - h * 0.085;
      const kf = 1.22;
      // seat top surface and front face: a mattress on a carved teak base
      const mid = top + (fy - top) * 0.42;
      const t = [P(xa, top, 1), P(xb, top, 1), P(xb, top, kf), P(xa, top, kf)];
      const fm = [P(xa, top, kf), P(xb, top, kf), P(xb, mid, kf), P(xa, mid, kf)];
      const fw2 = [P(xa, mid, kf), P(xb, mid, kf), P(xb, fy, kf), P(xa, fy, kf)];
      shade(g, P((xa + xb) / 2, 0, kf).x, P(0, fy, kf).y, (xb - xa) * 0.6, h * 0.03, 0.5);
      // left side faces (they face the centre, so they are visible)
      fillPoly(g, [P(xa, top, 1), P(xa, top, kf), P(xa, mid, kf), P(xa, mid, 1)], '#5a0a1a');
      fillPoly(g, [P(xa, mid, 1), P(xa, mid, kf), P(xa, fy, kf), P(xa, fy, 1)], lin(g, 0, mid, 0, fy, [[0, '#3a1a0a'], [1, '#1a0804']]));
      fillPoly(g, t, lin(g, 0, t[0].y, 0, t[2].y, [[0, '#a8243a'], [1, '#d03848']]));
      fillPoly(g, fm, lin(g, 0, fm[0].y, 0, fm[2].y, [[0, '#a01c34'], [1, '#5a0a1a']]));
      line(g, fm[0].x, fm[0].y, fm[1].x, fm[1].y, '#f8ecd8', u * 0.007);
      box(g, fm[0].x, fm[2].y - (fm[2].y - fm[0].y) * 0.3, fm[1].x - fm[0].x, (fm[2].y - fm[0].y) * 0.14, '#e8b448');
      // wooden base with a scalloped apron, brass studs and short turned legs
      fillPoly(g, fw2, lin(g, 0, fw2[0].y, 0, fw2[2].y, [[0, '#7a3a16'], [0.5, '#4a200c'], [1, '#2a1006']]));
      const bw2 = fw2[1].x - fw2[0].x;
      const bh2 = fw2[2].y - fw2[0].y;
      const sc = 9;
      g.beginPath();
      for (let i = 0; i < sc; i++) {
        const sx0 = fw2[0].x + (bw2 * i) / sc;
        g.moveTo(sx0, fw2[0].y + bh2 * 0.55);
        g.quadraticCurveTo(sx0 + bw2 / sc / 2, fw2[0].y + bh2 * 0.95, sx0 + bw2 / sc, fw2[0].y + bh2 * 0.55);
      }
      g.strokeStyle = rgba('#e0a050', 0.6);
      g.lineWidth = Math.max(1, u * 0.003);
      g.stroke();
      for (let i = 0; i < sc; i++) ellipse(g, fw2[0].x + (bw2 * (i + 0.5)) / sc, fw2[0].y + bh2 * 0.3, u * 0.005, u * 0.005, '#f2c060');
      box(g, fw2[0].x, fw2[0].y, bw2, bh2 * 0.12, '#8a4a1c');
      // bolsters along the back and cushions
      const by = P(xa, top - h * 0.025, 1.03).y;
      bolster(g, P((xa + xb) / 2, 0, 1.03).x, by, (xb - xa) * 0.7, h * 0.03, '#c8701a');
      cushion(g, P(xa + (xb - xa) * 0.12, 0, 1.06).x, by + h * 0.005, h * 0.075, '#1f6a64', -0.12);
      cushion(g, P(xa + (xb - xa) * 0.42, 0, 1.06).x, by + h * 0.008, h * 0.07, '#e07a1a', 0.08);
      cushion(g, P(xa + (xb - xa) * 0.7, 0, 1.06).x, by + h * 0.006, h * 0.075, '#5b2a86', -0.05);
      bolster(g, P(xa + (xb - xa) * 0.08, 0, 1.15).x, P(xa, top - h * 0.02, 1.15).y, h * 0.09, h * 0.026, '#1f6a64');
      for (let i = 0; i < 4; i++) glints.push({ x: P(xa + (xb - xa) * rand(r, 0.1, 0.9), 0, 1.05).x, y: by + rand(r, -1, 1) * h * 0.02 });
    }

    function chowki(g: Ctx, x: number, y: number, tr: number) {
      const r = R.props;
      const legH = tr * 0.55;
      const ty = y - legH;
      shade(g, x, y, tr * 1.3, tr * 0.18, 0.5);
      // legs
      for (const sx of [-0.8, 0.8]) box(g, x + sx * tr - tr * 0.05, ty, tr * 0.1, legH, lin(g, 0, ty, 0, y, [[0, '#6a3212'], [1, '#2a1006']]));
      // top: carved wooden slab seen from above
      fillPoly(g, [{ x: x - tr * 1.02, y: ty - tr * 0.2 }, { x: x + tr * 1.02, y: ty - tr * 0.2 }, { x: x + tr * 1.1, y: ty + tr * 0.04 }, { x: x - tr * 1.1, y: ty + tr * 0.04 }], lin(g, 0, ty - tr * 0.2, 0, ty, [[0, '#7a3a14'], [1, '#a85a24']]));
      box(g, x - tr * 1.1, ty + tr * 0.04, tr * 2.2, tr * 0.12, lin(g, 0, ty, 0, ty + tr * 0.16, [[0, '#8a4418'], [1, '#3a1608']]));
      for (let i = 0; i < 9; i++) ellipse(g, x - tr * 1.0 + (tr * 2 * i) / 8, ty + tr * 0.1, tr * 0.025, tr * 0.025, '#e8b448');
      const tf = thali(g, fork(r), x, ty - tr * 0.1, tr * 0.88, 0.36);
      flames.push(...tf);
      glints.push({ x: x - tr * 0.5, y: ty - tr * 0.12 }, { x: x + tr * 0.6, y: ty - tr * 0.05 });
    }

    function lanterns(g: Ctx) {
      for (const l of lanternPos) {
        const c = brassLantern(g, l.x, -2, l.y, l.s);
        lamps.push({ x: c.x, y: c.y, s: l.s * 1.6, c: '#ffb050', i: 1 });
      }
    }

    function finish(g: Ctx) {
      // warm haze, darker floor front and a vignette
      pool(g, vx, h * 0.45, w * 0.6, h * 0.5, '#ff8a3a', 0.06);
      wash(g, vx, h, w * 0.75, h * 0.1, '#0a0204', 0.4);
      vignette(g, w, h, 0.5, '#0a0204');
    }

    return {
      skyRects,
      painterly: { radiusScale: 1.2, strokes: 0.8, saturation: 1.08, warmth: 0.28, contrast: 1.05 },
      base(g) {
        paintWall(g);
        sideWalls(g);
        pilasters(g);
        alcove(g);
        windows(g);
        paintFloor(g);
        archLights(g);
        topFrieze(g);
        floorProps(g);
        lanterns(g);
        finish(g);
      },
      lights(g) {
        const r = R.fx;
        // stars and static bursts in the open windows
        for (const wn of wins) {
          withState(g, () => {
            g.beginPath();
            skyPath(g, wn);
            g.clip();
            withState(g, () => {
              g.globalCompositeOperation = 'lighter';
              for (let i = 0; i < 14; i++) {
                g.fillStyle = rgba('#fff4e0', rand(r, 0.4, 0.9));
                g.beginPath();
                g.arc(wn.x + rand(r, -1, 1) * wn.a, wSpring - wRise + rand(r, 0, 0.5) * (wSill - wSpring + wRise), u * rand(r, 0.0012, 0.0028), 0, TAU);
                g.fill();
              }
            });
            for (const b of bursts) if (Math.abs(b.x - wn.x) < wn.a * 1.2) firework(g, r, b.x, b.y, b.r, b.color, b.kind, 0.95);
          });
        }
        for (const l of lamps) glow(g, l.x, l.y, l.s, l.c, 0.55 * l.i);
        for (const l of lanternPos) {
          glow(g, l.x, l.y, l.s * 3, '#ff9a3a', 0.25);
          glow(g, l.x, l.y, l.s * 0.8, '#ffd27a', 0.5);
          // light escaping through the pierced metal
          withState(g, () => {
            g.globalCompositeOperation = 'lighter';
            g.fillStyle = rgba('#fff0c0', 0.85);
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * TAU;
              g.beginPath();
              g.arc(l.x + Math.cos(a) * l.s * 0.3, l.y - l.s * 0.32, l.s * 0.018, 0, TAU);
              g.fill();
            }
          });
        }
        drawBulbs(g, bulbs, 0.95);
        for (const f of flames) diyaFlame(g, r, f.x, f.y, f.s, f.i);
        for (const p of glints) sparkle(g, p.x, p.y, u * rand(r, 0.004, 0.008), '#fff2c8', rand(r, 0.4, 0.8));
        // the samai lights the room most
        glow(g, samaiPos.x, samaiPos.y - samaiPos.s * 0.8, u * 0.3, '#ff9a3a', 0.18);
      },
      sky(g) {
        g.fillStyle = '#fff';
        for (const wn of wins) {
          g.beginPath();
          skyPath(g, wn);
          g.fill();
        }
        // drapes and the railing cover the edges of the openings
        g.fillStyle = '#000';
        for (const wn of wins) {
          g.fillRect(wn.x - wn.a * 1.5, wSpring - wRise * 0.55, wn.a * 0.48 * 1.5 * 0.9, h);
          g.fillRect(wn.x + wn.a * 1.5 - wn.a * 0.48 * 1.5 * 0.9, wSpring - wRise * 0.55, wn.a * 0.48 * 1.5 * 0.9, h);
          g.fillRect(wn.x - wn.a * 1.2, P(0, wSill - rail * 0.6, wk).y - h * 0.07, wn.a * 2.4, h);
        }
      },
    };
  },
};

