import type { NRect, SceneSpec } from '../scene';
import { TAU, ctx2d, diya, diyaFlame, ellipse, gauss, glow, gradientSky, leaf, makeCanvas, marigold, moon, pick, rand, rangoli, rgba, samai, vignette, wash, withBlend, withState, type Ctx, type Pt } from '../kit';
import {
  City,
  Envelope,
  burstBase,
  burstLights,
  chhatri,
  cityGlowBase,
  cityLayer,
  cityLights,
  domeHall,
  embers,
  flagsBase,
  fork,
  hazeBand,
  haveli,
  ledgesBase,
  litSmoke,
  palmTree,
  planBurst,
  shikharaTemple,
  starField,
  strandWires,
  tinyFlame,
  townHouse,
  tree,
  windowsBase,
  windowsLights,
  type Burst,
  type Kind,
} from './crackers-parts';
import { boat, deepstambh, ghatUmbrella, flameReflection, floatingDiya, lightPath, petalScatter, reflect, skyLanternBody, skyLanternGlow } from './night-parts';

function oglow(g: Ctx, x: number, y: number, rx: number, ry: number, color: string, a: number) {
  withState(g, () => {
    g.translate(x, y);
    g.scale(1, ry / rx);
    glow(g, 0, 0, rx, color, a);
  });
}

interface Shot {
  x: number;
  y: number;
  r: number;
  kind: Kind;
  c: string;
  c2: string;
  a: number;
}

const BANK_TONES = ['#1a0e2a', '#200f28', '#160d30', '#241226'];

/**
 * "Diwali Night Scene": Deepotsav on a river ghat. Stepped ghats lined with
 * thousands of diyas, light-outlined temples and chhatris, a moon, sky
 * lanterns and fireworks, all mirrored in the teal river; the viewer stands
 * on the near ghat among diyas, a lamp tower and marigolds.
 */
export const night: SceneSpec = {
  id: 'night',
  compose(w, h, rng) {
    const u = Math.min(w, h);
    const P = h > w * 1.05;
    const X = (f: number) => f * w;
    const Y = (f: number) => f * h;

    // ---------------------------------------------------------------- layout
    const WL = Y(P ? 0.565 : 0.612); // far waterline
    const stepH = u * (P ? 0.068 : 0.078);
    const stepTop = WL - stepH;
    const NE = Y(P ? 0.8 : 0.795); // near ghat edge
    const env = new Envelope(w, h);
    env.addRect(-w, 2 * w, stepTop);
    const moonP = { x: X(P ? 0.77 : 0.79), y: Y(P ? 0.12 : 0.15), r: u * (P ? 0.05 : 0.043) };

    // fireworks
    const shots: Shot[] = P
      ? [
          { x: 0.17, y: 0.12, r: 0.27, kind: 'peony', c: '#ff4fa3', c2: '#ffd27a', a: 1 },
          { x: 0.47, y: 0.04, r: 0.11, kind: 'chrys', c: '#4dffd2', c2: '#d6ff6a', a: 0.75 },
          { x: 0.9, y: 0.3, r: 0.13, kind: 'willow', c: '#ffc35a', c2: '#fff0c0', a: 0.9 },
          { x: 0.08, y: 0.34, r: 0.09, kind: 'crossette', c: '#b88cff', c2: '#ff8ad8', a: 0.85 },
        ]
      : [
          { x: 0.14, y: 0.17, r: 0.22, kind: 'peony', c: '#ff4fa3', c2: '#ffd27a', a: 1 },
          { x: 0.335, y: 0.075, r: 0.11, kind: 'chrys', c: '#4dffd2', c2: '#d6ff6a', a: 0.85 },
          { x: 0.935, y: 0.32, r: 0.12, kind: 'willow', c: '#ffc35a', c2: '#fff0c0', a: 0.9 },
          { x: 0.6, y: 0.06, r: 0.075, kind: 'peony', c: '#ffcf5a', c2: '#ff6ad5', a: 0.7 },
          { x: 0.04, y: 0.42, r: 0.08, kind: 'crossette', c: '#ffcf6b', c2: '#ff8ad8', a: 0.85 },
        ];
    const rb = fork(rng);
    const near: Burst[] = shots.map((s) => planBurst(rb, X(s.x), Y(s.y), s.r * u, s.kind, s.c, s.c2, s.a));
    const far: Burst[] = [];
    for (const fx of P ? [0.1, 0.92] : [0.06, 0.27, 0.71, 0.97]) {
      far.push(planBurst(rb, X(fx + rand(rb, -0.02, 0.02)), stepTop - u * rand(rb, 0.2, 0.27), u * rand(rb, 0.03, 0.05), pick<Kind>(rb, ['peony', 'chrys', 'willow']), pick(rb, ['#ff4fa3', '#ffcf5a', '#4dffd2', '#9b7bff', '#ff8a3d']), '#ffffff', 0.55));
    }

    // sky lanterns: two drifting streams plus distant specks
    const lanterns: { x: number; y: number; s: number; k: number }[] = [];
    {
      const rl = fork(rng);
      const stream = (x0: number, y0: number, x1: number, y1: number, n: number, s0: number, s1: number) => {
        for (let i = 0; i < n; i++) {
          const t = Math.pow(rl(), 0.85);
          lanterns.push({
            x: X(x0 + (x1 - x0) * t + gauss(rl) * 0.035),
            y: Y(y0 + (y1 - y0) * t + gauss(rl) * 0.025),
            s: u * (s0 + (s1 - s0) * t) * rand(rl, 0.7, 1.25),
            k: rand(rl, 0.7, 1),
          });
        }
      };
      if (P) {
        stream(0.7, 0.42, 0.97, 0.05, 12, 0.04, 0.012);
        stream(0.28, 0.42, 0.04, 0.2, 9, 0.034, 0.012);
      } else {
        stream(0.7, 0.5, 0.985, 0.05, 15, 0.034, 0.01);
        stream(0.3, 0.5, 0.05, 0.08, 11, 0.03, 0.01);
      }
      for (let i = 0; i < 34; i++) {
        let fx = rand(rl, 0.02, 0.98);
        if (fx > 0.38 && fx < 0.62 && rl() < 0.6) fx = fx < 0.5 ? fx - 0.24 : fx + 0.24;
        lanterns.push({ x: X(fx), y: Y(rand(rl, 0.04, P ? 0.44 : 0.48)), s: u * rand(rl, 0.004, 0.009), k: rand(rl, 0.5, 0.9) });
      }
      lanterns.sort((a, b) => a.s - b.s);
    }

    // ---------------------------------------------------------------- far ghat
    const rc = fork(rng);
    const bank = new City(env, u);
    const templeC = new City(env, u);
    const palaceC = new City(env, u);
    const temple = { x: X(P ? 0.17 : 0.15), tw: u * (P ? 0.13 : 0.11), th: u * (P ? 0.36 : 0.31) };
    const temple2 = { x: X(0.715), tw: u * 0.065, th: u * 0.19 };
    const palace = { x: X(P ? 0.84 : 0.875), dw: u * (P ? 0.22 : 0.18), dh: u * (P ? 0.3 : 0.26) };
    shikharaTemple(rc, templeC, temple.x, stepTop, temple.tw, temple.th, { outline: '#ffd27a' });
    if (!P) shikharaTemple(rc, templeC, temple2.x, stepTop, temple2.tw, temple2.th, { outline: '#ffd27a', flip: true });
    domeHall(palaceC, palace.x, stepTop, palace.dw, palace.dh, { outline: '#ffc2ec' });
    {
      const n = P ? 9 : 15;
      const ws: number[] = [];
      for (let i = 0; i < n; i++) ws.push(rand(rc, 0.7, 1.3));
      const sum = ws.reduce((a, b) => a + b, 0);
      let x = -0.02 * w;
      const fH = u * 0.034;
      for (let i = 0; i < n; i++) {
        const bw = (ws[i] / sum) * w * 1.04;
        const cx = x + bw / 2;
        const xc = cx / w;
        const byLandmark = Math.abs(cx - temple.x) < temple.tw * 1.1 || Math.abs(cx - palace.x) < palace.dw * 0.55 || (!P && Math.abs(cx - temple2.x) < temple2.tw * 0.9);
        const centre = xc > 0.36 && xc < 0.64;
        const floors = byLandmark ? 1 : centre ? 1 + (rc() < 0.4 ? 1 : 0) : rc() < 0.5 ? 2 : 3;
        const roll = rc();
        const rB = fork(rc);
        if (!byLandmark && !centre && roll < 0.1) tree(rB, bank, cx, stepTop, u * rand(rB, 0.13, 0.17));
        else if (!byLandmark && roll < 0.55) haveli(rB, bank, x, stepTop, bw * 0.97, floors, fH, { lamps: 0.9, lights: centre ? 0.3 : 0.6 });
        else townHouse(rB, bank, x, stepTop, bw * 0.97, floors, fH, { lights: 0.6, lamps: 0.9, pLit: 0.6 });
        x += bw;
      }
      // chhatris projecting over the steps
      for (const cxf of P ? [0.36, 0.64] : [0.29, 0.42, 0.58, 0.79]) chhatri(bank, X(cxf), stepTop, u * 0.045, true, '#ffe08a');
      palmTree(rc, bank, X(P ? 0.03 : 0.025), stepTop, u * 0.2);
      if (!P) palmTree(rc, bank, X(0.985), stepTop, u * 0.17);
    }

    // diyas lining every step of the far ghat
    const steps = 7;
    // stone platforms (with niches) that interrupt the upper steps
    const platRows = 4;
    const platBottom = stepTop + (stepH * platRows) / steps;
    const plats: [number, number][] = [];
    const platC = new City(null, u);
    {
      const rp = fork(rng);
      for (const f of P ? [0.03, 0.6] : [0.0, 0.265, 0.6, 0.79]) {
        const x0 = X(f + rand(rp, 0, 0.025));
        const x1 = x0 + X(rand(rp, 0.065, 0.1) * (P ? 1.4 : 1));
        plats.push([x0, x1]);
        const n = Math.max(1, Math.round((x1 - x0) / (u * 0.05)));
        for (let i = 0; i < n; i++) {
          const nx = x0 + ((x1 - x0) * (i + 0.5)) / n;
          platC.wins.push({ x: nx - u * 0.008, y: stepTop + stepH * 0.14, w: u * 0.016, h: (platBottom - stepTop) * 0.62, arch: true, c: '#ffb347', on: rand(rp, 0.6, 1) });
        }
      }
    }
    const inPlat = (x: number) => plats.some(([a, b]) => x > a && x < b);
    const stepFlames: number[] = [];
    {
      const rs = fork(rng);
      const per = P ? 58 : 92;
      for (let k = 0; k < steps; k++) {
        const y = stepTop + (stepH * (k + 1)) / steps - stepH * 0.02;
        const fh = u * (0.0075 + 0.0035 * (k / steps));
        const ph = rand(rs, 0, TAU);
        const fr = rand(rs, 5, 11);
        for (let i = 0; i < per; i++) {
          const f = (i + rand(rs, 0.1, 0.9)) / per;
          const dens = 0.45 + 0.4 * Math.sin(f * fr + ph) + (Math.abs(f - 0.5) < 0.13 ? -0.25 : 0.1);
          if (rs() > dens) continue;
          if (k < platRows && inPlat(X(f))) continue;
          stepFlames.push(X(f), y, fh * rand(rs, 0.75, 1.15));
        }
      }
      // diyas along the platforms' coping
      for (const [a, b] of plats) {
        const n = Math.max(3, Math.round((b - a) / (u * 0.012)));
        for (let i = 0; i < n; i++) stepFlames.push(a + ((b - a) * (i + 0.5)) / n, stepTop + stepH * 0.04, u * 0.0085 * rand(rs, 0.8, 1.1));
      }
    }
    const umbrellas: [number, number, number][] = P
      ? [
          [0.08, 3, -0.04],
          [0.93, 2, 0.05],
        ]
      : [
          [0.06, 3, -0.04],
          [0.33, 2, 0.03],
          [0.67, 3, -0.03],
          [0.83, 2, 0.04],
        ];
    const aarti = (P ? [0.27, 0.73] : [0.235, 0.765]).map((f) => ({ x: X(f), y: stepTop + stepH * 0.15 }));

    // ---------------------------------------------------------------- river
    const rw = fork(rng);
    const floats: { x: number; y: number; s: number }[] = [];
    for (let i = 0; i < (P ? 22 : 30); i++) {
      const t = Math.pow(rw(), 0.8);
      let fx = rand(rw, 0.02, 0.98);
      if (fx > 0.4 && fx < 0.6 && rw() < 0.65) fx += fx < 0.5 ? -0.2 : 0.2;
      const y = WL + (NE - WL) * (0.08 + 0.84 * t);
      floats.push({ x: X(fx), y, s: u * (0.012 + 0.028 * t) });
    }
    floats.sort((a, b) => a.y - b.y);
    const boatP = { x: X(P ? 0.2 : 0.17), y: WL + (NE - WL) * 0.5, L: u * (P ? 0.34 : 0.3) };

    // ---------------------------------------------------------------- near ghat
    const edgeDiyas: { x: number; y: number; s: number }[] = [];
    {
      const rd = fork(rng);
      const n = P ? 9 : 14;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        if (f > 0.38 && f < 0.62) continue;
        edgeDiyas.push({ x: X(f + rand(rd, -0.01, 0.01)), y: NE + u * 0.012, s: u * 0.034 });
      }
      const cl: [number, number, number][] = P
        ? [
            [0.66, 0.975, 0.055],
            [0.72, 0.9, 0.045],
          ]
        : [
            [0.255, 0.905, 0.042],
            [0.29, 0.97, 0.05],
            [0.7, 0.975, 0.05],
            [0.765, 0.915, 0.045],
          ];
      for (const [fx, fy, fs] of cl) edgeDiyas.push({ x: X(fx), y: Y(fy), s: u * fs });
    }
    const stambh = { x: X(P ? 0.86 : 0.905), base: Y(P ? 0.965 : 0.97), H: P ? Y(0.28) : Y(0.46) };
    const rangoliP = { x: X(P ? 0.16 : 0.1), y: Y(P ? 0.955 : 0.955), R: u * (P ? 0.17 : 0.15) };
    const samaiP = { x: X(P ? 0.25 : 0.2), y: Y(P ? 0.9 : 0.885), h: u * (P ? 0.19 : 0.2) };

    const rSky = fork(rng);
    const rL = fork(rng);
    const rP = fork(rng);
    const skyRects: NRect[] = P
      ? [
          [0.05, 0.04, 0.35, 0.3],
          [0.64, 0.04, 0.95, 0.3],
        ]
      : [
          [0.03, 0.04, 0.3, 0.36],
          [0.66, 0.04, 0.97, 0.34],
        ];

    let stambhFlames: Pt[] = [];
    let samaiFlames: Pt[] = [];
    let boatLamps: Pt[] = [];
    let rangoliFlames: Pt[] = [];
    const floatFlames: Pt[] = [];
    const edgeFlames: { x: number; y: number; s: number }[] = [];

    return {
      skyRects,
      painterly: { saturation: 1.1, warmth: 0.15, contrast: 1.05 },

      base(g) {
        // ---- sky
        gradientSky(g, 0, 0, w, WL, [
          [0, '#060a26'],
          [0.28, '#121650'],
          [0.52, '#2c1a66'],
          [0.72, '#5c2272'],
          [0.88, '#a83a70'],
          [1, '#f0905a'],
        ]);
        for (let i = 0; i < 24; i++) {
          wash(g, rand(rSky, -0.1, 1.1) * w, rand(rSky, 0, 0.85) * stepTop, u * rand(rSky, 0.2, 0.45), u * rand(rSky, 0.06, 0.14), pick(rSky, ['#1a2a70', '#0a0a2a', '#4a1a6a', '#22105a', '#6a1a5a']), rand(rSky, 0.12, 0.24));
        }
        // moon, halo and moonlit cloud wisps
        glow(g, moonP.x, moonP.y, moonP.r * 9, '#b8a8ff', 0.16);
        litSmoke(g, rSky, moonP.x - moonP.r * 2, moonP.y + moonP.r * 2.2, moonP.r * 6, moonP.r * 1.2, 14, moonP.r * 2.2, '#1c1648', '#c8b8f0', moonP.x, moonP.y, 0.28);
        moon(g, moonP.x, moonP.y, moonP.r);
        litSmoke(g, rSky, moonP.x + moonP.r * 1.5, moonP.y + moonP.r * 0.9, moonP.r * 3.5, moonP.r * 0.5, 6, moonP.r * 1.3, '#2a2058', '#e8dcff', moonP.x, moonP.y, 0.22);
        // drifting smoke of the bursts
        for (const b of far) burstBase(g, b, 0.8);
        for (const b of near) litSmoke(g, rSky, b.x, b.y + b.r * 0.35, b.r * 0.9, b.r * 0.55, b.r > u * 0.15 ? 14 : 7, b.r * 0.42, '#1c1440', '#d8b8ff', b.x, b.y, b.r > u * 0.15 ? 0.3 : 0.2);
        for (const b of near) burstBase(g, b);
        // the ghat's glow on the low haze
        oglow(g, X(0.5), stepTop, w * 0.8, u * 0.2, '#ff9a4a', 0.32);
        oglow(g, temple.x, stepTop - temple.th * 0.4, u * 0.35, u * 0.25, '#ff7a5a', 0.16);
        oglow(g, palace.x, stepTop - palace.dh * 0.4, u * 0.3, u * 0.22, '#ff6ab0', 0.14);
        litSmoke(g, rSky, X(0.5), stepTop - u * 0.12, w * 0.5, u * 0.05, 22, u * 0.1, '#4a1e50', '#ffa070', X(0.5), WL, 0.24);
        // sky lantern bodies
        for (const l of lanterns) skyLanternBody(g, l.x, l.y, l.s);

        // ---- far ghat buildings
        cityLayer(g, w, h, bank, BANK_TONES, (lg) => {
          const grd = lg.createLinearGradient(0, stepTop - u * 0.16, 0, stepTop);
          grd.addColorStop(0, 'rgba(30,14,50,0.2)');
          grd.addColorStop(0.6, 'rgba(90,30,50,0.45)');
          grd.addColorStop(1, 'rgba(210,100,60,0.75)');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
        });
        ledgesBase(g, bank, 'rgba(255,170,110,0.32)', 'rgba(10,2,14,0.4)');
        cityLayer(g, w, h, templeC, ['#4a2232'], (lg) => {
          const t0 = stepTop - temple.th;
          const grd = lg.createLinearGradient(0, t0, 0, stepTop);
          grd.addColorStop(0, 'rgba(60,24,60,0.92)');
          grd.addColorStop(0.5, 'rgba(160,70,62,0.92)');
          grd.addColorStop(1, 'rgba(250,150,80,0.95)');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
          for (const t of P ? [temple] : [temple, temple2]) {
            const hx = lg.createLinearGradient(t.x - t.tw * 1.1, 0, t.x + t.tw * 1.1, 0);
            hx.addColorStop(0, 'rgba(20,6,20,0.6)');
            hx.addColorStop(0.5, 'rgba(255,200,130,0.16)');
            hx.addColorStop(1, 'rgba(20,6,20,0.65)');
            lg.fillStyle = hx;
            lg.fillRect(t.x - t.tw * 1.2, 0, t.tw * 2.4, h);
            lg.strokeStyle = 'rgba(40,10,20,0.45)';
            lg.lineWidth = Math.max(2, t.th * 0.009);
            lg.beginPath();
            for (let y = stepTop - t.th * 0.12; y > stepTop - t.th; y -= t.th * 0.05) {
              lg.moveTo(t.x - t.tw * 1.2, y);
              lg.lineTo(t.x + t.tw * 1.2, y);
            }
            lg.stroke();
          }
        });
        cityLayer(g, w, h, palaceC, ['#2a1438'], (lg) => {
          const t0 = stepTop - palace.dh * 1.02;
          const grd = lg.createLinearGradient(0, t0, 0, stepTop);
          grd.addColorStop(0, '#1c0c30');
          grd.addColorStop(0.3, '#3a1848');
          grd.addColorStop(0.55, '#7a2c5a');
          grd.addColorStop(1, '#f0a070');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
          const hx = lg.createLinearGradient(palace.x - palace.dw * 0.55, 0, palace.x + palace.dw * 0.55, 0);
          hx.addColorStop(0, 'rgba(8,2,16,0.75)');
          hx.addColorStop(0.4, 'rgba(255,190,220,0.14)');
          hx.addColorStop(1, 'rgba(8,2,16,0.8)');
          lg.fillStyle = hx;
          lg.fillRect(0, 0, w, h);
        });
        for (const c of [bank, templeC, palaceC]) {
          windowsBase(g, c, 0.7);
          strandWires(g, c);
          cityGlowBase(g, c, 1.1);
        }
        flagsBase(g, templeC);

        // ---- the stepped ghat
        for (let k = 0; k < steps; k++) {
          const y0 = stepTop + (stepH * k) / steps;
          const y1 = stepTop + (stepH * (k + 1)) / steps;
          const grd = g.createLinearGradient(0, y0, 0, y1);
          grd.addColorStop(0, '#3a1e26');
          grd.addColorStop(0.55, '#5a3030');
          grd.addColorStop(0.8, '#b8704a');
          grd.addColorStop(1, '#e0a060');
          g.fillStyle = grd;
          g.fillRect(0, y0, w, y1 - y0 + 0.5);
        }
        // stone platforms over the upper steps
        for (const [a, b] of plats) {
          const pg = g.createLinearGradient(0, stepTop, 0, platBottom);
          pg.addColorStop(0, '#5a3430');
          pg.addColorStop(0.5, '#3a1e22');
          pg.addColorStop(1, '#4a2a26');
          g.fillStyle = pg;
          g.fillRect(a, stepTop, b - a, platBottom - stepTop);
          const sg = g.createLinearGradient(a, 0, b, 0);
          sg.addColorStop(0, 'rgba(10,2,8,0.5)');
          sg.addColorStop(0.15, 'rgba(10,2,8,0)');
          sg.addColorStop(0.85, 'rgba(10,2,8,0)');
          sg.addColorStop(1, 'rgba(10,2,8,0.5)');
          g.fillStyle = sg;
          g.fillRect(a, stepTop, b - a, platBottom - stepTop);
          g.fillStyle = '#d09060';
          g.fillRect(a - u * 0.003, stepTop, b - a + u * 0.006, Math.max(2, u * 0.005));
          g.fillStyle = 'rgba(255,170,100,0.5)';
          g.fillRect(a, platBottom - Math.max(2, u * 0.004), b - a, Math.max(2, u * 0.004));
        }
        windowsBase(g, platC, 0.75);
        // landings and side walls break up the long steps
        for (let i = 0; i < (P ? 5 : 9); i++) {
          const x = X(rand(rc, 0.03, 0.97));
          const ww = u * rand(rc, 0.008, 0.016);
          const grd = g.createLinearGradient(x - ww, 0, x + ww, 0);
          grd.addColorStop(0, 'rgba(20,6,14,0.55)');
          grd.addColorStop(1, 'rgba(140,70,50,0.35)');
          g.fillStyle = grd;
          g.fillRect(x - ww, stepTop, ww * 2, stepH * rand(rc, 0.4, 1));
        }
        for (const [f, k, lean] of umbrellas) ghatUmbrella(g, X(f), stepTop + (stepH * (k + 1)) / steps, u * 0.1, lean);
        // warm glow of the diya rows
        for (let k = 0; k < steps; k++) hazeBand(g, stepTop + (stepH * (k + 0.3)) / steps, stepTop + (stepH * (k + 1.3)) / steps, w, '#ffb050', 0.14);
        for (const a of aarti) {
          g.fillStyle = '#3a2410';
          g.fillRect(a.x - u * 0.004, a.y - u * 0.05, u * 0.008, u * 0.05);
          oglow(g, a.x, a.y - u * 0.05, u * 0.08, u * 0.08, '#ffb050', 0.35);
        }

        // ---- river
        const water = g.createLinearGradient(0, WL, 0, NE);
        water.addColorStop(0, '#5a2a5a');
        water.addColorStop(0.25, '#2a2450');
        water.addColorStop(0.6, '#0e2c42');
        water.addColorStop(1, '#061822');
        g.fillStyle = water;
        g.fillRect(0, WL, w, NE - WL);
        reflect(g, g.canvas, w, WL, NE, { stretch: 1.5, alpha: 0.6, amp: u * 0.012, strips: 60, phase: 0.7, blur: 3 });
        // water body colour over the reflection (deeper teal toward the viewer)
        const tint = g.createLinearGradient(0, WL, 0, NE);
        tint.addColorStop(0, 'rgba(40,30,80,0.12)');
        tint.addColorStop(0.35, 'rgba(10,50,70,0.32)');
        tint.addColorStop(1, 'rgba(4,24,34,0.62)');
        g.fillStyle = tint;
        g.fillRect(0, WL, w, NE - WL);
        // soft horizontal ripple strokes
        withBlend(g, 'source-over', () => {
          g.lineCap = 'round';
          for (let i = 0; i < 160; i++) {
            const t = Math.pow(rw(), 0.9);
            const y = WL + (NE - WL) * t;
            const x = rand(rw, -0.05, 1.05) * w;
            const L = u * rand(rw, 0.02, 0.09) * (0.4 + t);
            g.strokeStyle = rw() < 0.5 ? rgba('#7ac8d0', rand(rw, 0.05, 0.13)) : rgba('#02080e', rand(rw, 0.1, 0.25));
            g.lineWidth = Math.max(1.5, u * 0.003 * (0.5 + t));
            g.beginPath();
            g.moveTo(x - L / 2, y);
            g.lineTo(x + L / 2, y);
            g.stroke();
          }
        });
        // the shoreline: a thin bright edge where the lit steps meet the water
        hazeBand(g, WL - u * 0.004, WL + u * 0.008, w, '#ffcf8a', 0.35);
        // boat and floating diyas
        boatLamps = boat(g, boatP.x, boatP.y, boatP.L, 1);
        for (const f of floats) floatFlames.push(floatingDiya(g, rP, f.x, f.y, f.s));

        // ---- near ghat platform
        const stone = g.createLinearGradient(0, NE, 0, h);
        stone.addColorStop(0, '#6a4038');
        stone.addColorStop(0.08, '#4a2c2c');
        stone.addColorStop(0.5, '#2e1a1e');
        stone.addColorStop(1, '#170c10');
        g.fillStyle = stone;
        g.fillRect(0, NE, w, h - NE);
        withState(g, () => {
          g.beginPath();
          g.rect(0, NE, w, h - NE);
          g.clip();
          // big stone slabs in perspective
          const vx = X(0.5);
          const vy = NE - (h - NE) * 1.8;
          g.strokeStyle = 'rgba(8,2,6,0.4)';
          g.lineWidth = Math.max(1.5, u * 0.0025);
          g.beginPath();
          for (let i = -8; i <= 8; i++) {
            const bx = X(0.5 + i * 0.14);
            g.moveTo(vx + (bx - vx) * ((NE - vy) / (h - vy)), NE);
            g.lineTo(bx, h);
          }
          for (let k = 1; k < 5; k++) {
            const y = NE + (h - NE) * Math.pow(k / 5, 1.4);
            g.moveTo(0, y);
            g.lineTo(w, y);
          }
          g.stroke();
          for (let i = 0; i < 22; i++) wash(g, rand(rP, 0, w), rand(rP, NE, h), u * rand(rP, 0.05, 0.12), u * rand(rP, 0.015, 0.03), pick(rP, ['#5a3a34', '#1a0c10', '#3a2024']), 0.3);
        });
        // coping stone along the edge, lit by the diyas
        const cg = g.createLinearGradient(0, NE - u * 0.004, 0, NE + u * 0.02);
        cg.addColorStop(0, '#e0a070');
        cg.addColorStop(0.4, '#8a5040');
        cg.addColorStop(1, 'rgba(60,30,30,0)');
        g.fillStyle = cg;
        g.fillRect(0, NE - u * 0.004, w, u * 0.024);
        for (const d of edgeDiyas) oglow(g, d.x, d.y, d.s * 3.2, d.s * 1.2, '#ff9a40', 0.4);
        oglow(g, stambh.x, stambh.base, u * 0.3, u * 0.08, '#ff9a40', 0.45);
        oglow(g, samaiP.x, samaiP.y, u * 0.22, u * 0.06, '#ffb050', 0.4);
        rangoliFlames = rangoli(g, fork(rP), rangoliP.x, rangoliP.y, rangoliP.R, { tilt: 0.32, diyas: 10, petals: 12, palette: ['#e2412b', '#ffb000', '#d6247b', '#1f9e89', '#5b2a86', '#ffffff', '#ff7a00'] });
        petalScatter(g, rP, 0, NE + u * 0.02, X(0.34), h, 60, u * 0.007);
        petalScatter(g, rP, X(0.66), NE + u * 0.02, w, h, 60, u * 0.007);
        // marigold heaps and a kalash beside the samai
        const rm = fork(rP);
        for (let i = 0; i < 9; i++) marigold(g, rm, samaiP.x - u * 0.07 + gauss(rP) * u * 0.018, samaiP.y + u * 0.005 + rand(rP, -0.01, 0.01) * u, u * rand(rP, 0.009, 0.013), i % 3 ? '#ff8a00' : '#ffc23d');
        {
          const kx = samaiP.x + u * 0.085;
          const ky = samaiP.y + u * 0.01;
          const ks = u * 0.05;
          wash(g, kx, ky, ks * 0.9, ks * 0.15, '#000000', 0.5);
          const kg = g.createLinearGradient(kx - ks * 0.5, 0, kx + ks * 0.5, 0);
          kg.addColorStop(0, '#5c3a0c');
          kg.addColorStop(0.4, '#f0c050');
          kg.addColorStop(0.6, '#fff0b0');
          kg.addColorStop(1, '#6a4410');
          g.beginPath();
          g.moveTo(kx - ks * 0.2, ky - ks * 0.85);
          g.bezierCurveTo(kx - ks * 0.62, ky - ks * 0.7, kx - ks * 0.6, ky, kx, ky);
          g.bezierCurveTo(kx + ks * 0.6, ky, kx + ks * 0.62, ky - ks * 0.7, kx + ks * 0.2, ky - ks * 0.85);
          g.closePath();
          g.fillStyle = kg;
          g.fill();
          for (let i = 0; i < 5; i++) leaf(g, kx, ky - ks * 0.88, ks * 0.55, -Math.PI / 2 + (i - 2) * 0.45, '#2f7d32');
          const cc = g.createRadialGradient(kx - ks * 0.08, ky - ks * 1.12, ks * 0.02, kx, ky - ks * 1.02, ks * 0.26);
          cc.addColorStop(0, '#c08040');
          cc.addColorStop(1, '#4a2410');
          ellipse(g, kx, ky - ks * 1.02, ks * 0.22, ks * 0.25, cc);
          g.strokeStyle = '#e2412b';
          g.lineWidth = Math.max(1.5, ks * 0.05);
          g.beginPath();
          g.ellipse(kx, ky - ks * 0.62, ks * 0.42, ks * 0.07, 0, 0.1, Math.PI - 0.1);
          g.stroke();
        }
        samaiFlames = samai(g, samaiP.x, samaiP.y, samaiP.h);
        stambhFlames = deepstambh(g, rP, stambh.x, stambh.base, stambh.H);
        for (const d of edgeDiyas) edgeFlames.push({ ...diya(g, d.x, d.y, d.s, { dir: d.x < X(0.5) ? 1 : -1 }), s: d.s });
        vignette(g, w, h, 0.38, '#04020c');
      },

      lights(g) {
        // everything beyond the water goes on its own layer so it can be mirrored
        const L = makeCanvas(w, h);
        const lg = ctx2d(L);
        withState(lg, () => {
          env.skyPath(lg);
          lg.clip();
          starField(lg, rL, 0, 0, w, stepTop - u * 0.1, 120, u * 0.0018);
          for (const b of far) burstLights(lg, b, 0.75);
          for (const b of near) burstLights(lg, b);
          for (const b of near) if (b.r > u * 0.15) embers(lg, rL, b.x - b.r, b.y, b.x + b.r, b.y + b.r * 1.2, 50, u * 0.002);
          glow(lg, moonP.x, moonP.y, moonP.r * 2.2, '#fff4d8', 0.35);
        });
        for (const l of lanterns) skyLanternGlow(lg, l.x, l.y, l.s, l.k);
        windowsLights(lg, platC, 1);
        for (const c of [bank, templeC, palaceC]) {
          windowsLights(lg, c, 1);
          cityLights(lg, fork(rL), c, 1);
        }
        for (let i = 0; i < stepFlames.length; i += 3) {
          const x = stepFlames[i];
          const calm = Math.abs(x / w - 0.5) < 0.15 ? 0.6 : 0.9;
          tinyFlame(lg, x, stepFlames[i + 1], stepFlames[i + 2], calm * rand(rL, 0.7, 1));
        }
        for (const a of aarti) {
          glow(lg, a.x, a.y - u * 0.06, u * 0.06, '#ffb050', 0.45);
          for (let r = 0; r < 3; r++) for (let k = -r; k <= r; k++) tinyFlame(lg, a.x + k * u * 0.009, a.y - u * (0.075 - r * 0.012), u * 0.012, 1);
        }
        withBlend(g, 'lighter', () => g.drawImage(L as CanvasImageSource, 0, 0));
        // mirrored in the river
        reflect(g, L, w, WL, NE, { stretch: 1.8, alpha: 0.55, amp: u * 0.012, strips: 70, op: 'lighter', phase: 1.3, blur: 4 });
        lightPath(g, rL, moonP.x, WL + u * 0.01, NE, u * 0.03, u * 0.16, '#fff0d0', 0.55, 150, Math.max(1, u * 0.0022));
        for (const b of near) if (b.r > u * 0.1) lightPath(g, rL, b.x, WL + u * 0.01, NE, b.r * 0.35, b.r * 0.9, b.c, 0.4, 90, Math.max(1, u * 0.0024));
        for (const a of aarti) lightPath(g, rL, a.x, WL + u * 0.005, NE, u * 0.01, u * 0.05, '#ffc060', 0.6, 50, Math.max(1, u * 0.0025));
        // boat and floating lamps
        for (const p of boatLamps) {
          tinyFlame(g, p.x, p.y, boatP.L * 0.06, 1);
          flameReflection(g, rL, p.x, boatP.y + boatP.L * 0.08, boatP.L * 0.04, boatP.L * 0.15);
        }
        for (let i = 0; i < floatFlames.length; i++) {
          const f = floatFlames[i];
          const s = floats[i].s;
          flameReflection(g, rL, f.x, floats[i].y + s * 0.12, s * 0.5, s * 1.6);
          tinyFlame(g, f.x, f.y, s * 0.55, 1);
          glow(g, f.x, f.y - s * 0.1, s * 1.6, '#ff9a40', 0.25);
        }
        // near ghat
        for (const f of edgeFlames) diyaFlame(g, rL, f.x, f.y, f.s, 1);
        for (const f of rangoliFlames) diyaFlame(g, rL, f.x, f.y, rangoliP.R * 0.16, 1);
        for (const f of samaiFlames) diyaFlame(g, rL, f.x, f.y, samaiP.h * 0.13, 1);
        glow(g, stambh.x, stambh.base - stambh.H * 0.5, stambh.H * 0.5, '#ff9a40', 0.2);
        for (const f of stambhFlames) {
          glow(g, f.x, f.y - stambh.H * 0.01, stambh.H * 0.045, '#ffa040', 0.22);
          tinyFlame(g, f.x, f.y, stambh.H * 0.034, 1);
        }
      },

      sky(g) {
        g.fillStyle = '#fff';
        env.skyPath(g);
        g.fill();
      },
    };
  },
};
