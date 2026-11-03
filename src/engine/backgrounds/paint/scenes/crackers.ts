import type { NRect, SceneSpec } from '../scene';
import { TAU, diya, diyaFlame, glow, gradientSky, marigoldGarland, mix, pick, rand, rgba, sagPath, vignette, wash, withState, type Ctx, type Pt } from '../kit';
import {
  City,
  Envelope,
  anarPot,
  anarSpray,
  burstBase,
  burstLights,
  chakriSpin,
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
  rocketTrail,
  shikharaTemple,
  smokeTrail,
  sparklerBurn,
  starField,
  strandWires,
  townHouse,
  tree,
  windowsBase,
  windowsLights,
  type Burst,
  type Kind,
} from './crackers-parts';

/** Elliptical additive glow. */
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

const BURST_COLORS = ['#ff4fa3', '#ffcf5a', '#4dffd2', '#ff5a3c', '#9b7bff', '#7dff6a', '#ff8a3d', '#5ad1ff'];
const NEAR_TONES = ['#170c26', '#1e0f24', '#140d2c', '#24101e', '#1a1030'];
const FAR_TONES = ['#2e1d55', '#36205a', '#3a1f50', '#2a1c58'];

/**
 * "Diwali Crackers": a smoky festive night sky full of bursts over an old
 * town, seen from a rooftop terrace lined with diyas, with anars, a chakri
 * and sparklers on the floor.
 */
export const crackers: SceneSpec = {
  id: 'crackers',
  compose(w, h, rng) {
    const u = Math.min(w, h);
    const P = h > w * 1.05;
    const X = (f: number) => f * w;
    const Y = (f: number) => f * h;

    // ---------------------------------------------------------------- layout
    const pTop = Y(P ? 0.79 : 0.752); // parapet coping
    const cope = u * 0.018;
    const pBot = Y(P ? 0.835 : 0.812); // floor starts
    const env = new Envelope(w, h);
    env.addRect(-w, 2 * w, pTop);

    // fireworks
    const shots: Shot[] = P
      ? [
          { x: 0.12, y: 0.11, r: 0.34, kind: 'chrys', c: '#ff3d9a', c2: '#ffd27a', a: 1 },
          { x: 0.89, y: 0.07, r: 0.35, kind: 'willow', c: '#ffc35a', c2: '#fff0c0', a: 0.85 },
          { x: 0.5, y: 0.035, r: 0.13, kind: 'peony', c: '#4dffc8', c2: '#d6ff6a', a: 0.75 },
          { x: 0.83, y: 0.33, r: 0.14, kind: 'ring', c: '#9b86ff', c2: '#ff6ad5', a: 0.95 },
          { x: 0.18, y: 0.41, r: 0.13, kind: 'crossette', c: '#eef4ff', c2: '#ff8ad8', a: 0.9 },
          { x: 0.92, y: 0.52, r: 0.11, kind: 'palm', c: '#ffcf6b', c2: '#ffe2a0', a: 0.9 },
          { x: 0.07, y: 0.56, r: 0.09, kind: 'peony', c: '#7dff6a', c2: '#ffffff', a: 0.75 },
        ]
      : [
          { x: 0.13, y: 0.2, r: 0.34, kind: 'chrys', c: '#ff3d9a', c2: '#ffd27a', a: 1 },
          { x: 0.85, y: 0.13, r: 0.36, kind: 'willow', c: '#ffc35a', c2: '#fff0c0', a: 0.85 },
          { x: 0.33, y: 0.065, r: 0.14, kind: 'peony', c: '#4dffc8', c2: '#d6ff6a', a: 0.85 },
          { x: 0.74, y: 0.37, r: 0.12, kind: 'ring', c: '#9b86ff', c2: '#ff6ad5', a: 0.95 },
          { x: 0.27, y: 0.45, r: 0.105, kind: 'crossette', c: '#eef4ff', c2: '#ff8ad8', a: 0.9 },
          { x: 0.615, y: 0.06, r: 0.1, kind: 'peony', c: '#ff5a3c', c2: '#ffd27a', a: 0.7 },
          { x: 0.955, y: 0.5, r: 0.1, kind: 'palm', c: '#ffcf6b', c2: '#ffe2a0', a: 0.9 },
          { x: 0.045, y: 0.52, r: 0.085, kind: 'peony', c: '#7dff6a', c2: '#ffffff', a: 0.75 },
        ];
    const rb = fork(rng);
    const near: Burst[] = shots.map((s) => planBurst(rb, X(s.x), Y(s.y), s.r * u, s.kind, s.c, s.c2, s.a));
    const big = near.filter((b) => b.r > u * 0.2);
    // small, hazy far bursts low over the town
    const far: Burst[] = [];
    const farXs = P ? [0.06, 0.24, 0.5, 0.76, 0.95] : [0.04, 0.15, 0.24, 0.33, 0.52, 0.68, 0.77, 0.9];
    for (const fx of farXs) {
      const central = fx > 0.36 && fx < 0.64;
      const kind = pick<Kind>(rb, ['peony', 'peony', 'chrys', 'willow']);
      const c = pick(rb, BURST_COLORS);
      far.push(planBurst(rb, X(fx + rand(rb, -0.02, 0.02)), Y((P ? 0.6 : 0.5) + rand(rb, -0.03, 0.05)), u * rand(rb, 0.035, 0.065) * (central ? 0.7 : 1), kind, c, pick(rb, BURST_COLORS), central ? 0.3 : 0.6));
    }
    const rockets: [number, number, number, number][] = P
      ? [
          [0.05, 0.7, 0.08, 0.42],
          [0.3, 0.7, 0.29, 0.47],
          [0.7, 0.7, 0.72, 0.44],
          [0.95, 0.68, 0.96, 0.27],
        ]
      : [
          [0.06, 0.64, 0.09, 0.33],
          [0.3, 0.63, 0.285, 0.3],
          [0.69, 0.64, 0.7, 0.24],
          [0.93, 0.62, 0.94, 0.3],
        ];

    // ---------------------------------------------------------------- town
    const rc = fork(rng);
    const farCity = new City(env, u);
    {
      const n = P ? 14 : 22;
      const ws: number[] = [];
      for (let i = 0; i < n; i++) ws.push(rand(rc, 0.5, 1.5));
      const sum = ws.reduce((a, b) => a + b, 0);
      let x = -0.04 * w;
      const fH = u * 0.024;
      for (let i = 0; i < n; i++) {
        const bw = (ws[i] / sum) * w * 1.08;
        const xc = (x + bw / 2) / w;
        const side = Math.abs(xc - 0.5) * 2;
        const floors = Math.round(rand(rc, 2, 5) + side * 3);
        const roll = rc();
        const rB = fork(rc);
        if (roll < 0.12) palmTree(rB, farCity, x + bw / 2, pTop, u * rand(rB, 0.1, 0.15));
        else if (roll < 0.3) haveli(rB, farCity, x, pTop, bw * 0.95, floors, fH, { lamps: 0.25, lights: 0 });
        else townHouse(rB, farCity, x, pTop, bw * 0.95, floors, fH, { lights: 0, lamps: 0.12, pLit: 0.22 });
        x += bw;
      }
      shikharaTemple(rc, farCity, X(P ? 0.63 : 0.575), pTop, u * 0.045, u * 0.16);
      domeHall(farCity, X(P ? 0.36 : 0.42), pTop, u * 0.08, u * 0.14);
    }
    const templeC = new City(env, u);
    const palaceC = new City(env, u);
    const nearCity = new City(env, u);
    const temple = { x: X(P ? 0.2 : 0.17), tw: u * 0.125, th: u * (P ? 0.44 : 0.36) };
    const palace = { x: X(P ? 0.8 : 0.82), dw: u * (P ? 0.23 : 0.2), dh: u * (P ? 0.36 : 0.3) };
    const nb = pTop + u * 0.01;
    {
      shikharaTemple(rc, templeC, temple.x, nb, temple.tw, temple.th, { outline: '#ffd27a' });
      domeHall(palaceC, palace.x, nb, palace.dw, palace.dh, { outline: '#ffc2ec' });
      const n = P ? 9 : 14;
      const ws: number[] = [];
      for (let i = 0; i < n; i++) ws.push(rand(rc, 0.7, 1.3));
      const sum = ws.reduce((a, b) => a + b, 0);
      let x = -0.03 * w;
      const fH = u * 0.04;
      for (let i = 0; i < n; i++) {
        const bw = (ws[i] / sum) * w * 1.06;
        const xc = (x + bw / 2) / w;
        const nearLandmark = Math.abs(x + bw / 2 - temple.x) < temple.tw * 1.3 || Math.abs(x + bw / 2 - palace.x) < palace.dw * 0.6;
        const centre = xc > 0.36 && xc < 0.64;
        const floors = nearLandmark ? 1 : centre ? (rc() < 0.5 ? 2 : 1) : rc() < 0.5 ? 2 : 3;
        const roll = rc();
        const rB = fork(rc);
        if (!nearLandmark && !centre && roll < 0.12) tree(rB, nearCity, x + bw / 2, nb, u * rand(rB, 0.16, 0.2));
        else if (!nearLandmark && !centre && roll < 0.42) haveli(rB, nearCity, x, nb, bw * 0.96, floors, fH);
        else townHouse(rB, nearCity, x, nb, bw * 0.96, floors, fH, { lights: centre ? 0.4 : 0.75, lamps: 0.6, pLit: 0.55 });
        x += bw;
      }
      if (!P) palmTree(rc, nearCity, X(0.655), nb, u * 0.2);
      palmTree(rc, nearCity, X(P ? 0.06 : 0.035), nb, u * 0.25);
    }

    // ---------------------------------------------------------------- terrace
    const posts = P ? [0.04, 0.29, 0.71, 0.96] : [0.02, 0.18, 0.33, 0.67, 0.82, 0.98];
    const postW = u * 0.05;
    const postH = u * 0.035;
    const anars = P
      ? [
          { x: 0.13, y: 0.935, s: 0.075, H: 0.27 },
          { x: 0.87, y: 0.925, s: 0.08, H: 0.3 },
          { x: 0.69, y: 0.865, s: 0.05, H: 0.15 },
        ]
      : [
          { x: 0.12, y: 0.93, s: 0.085, H: 0.38 },
          { x: 0.875, y: 0.915, s: 0.09, H: 0.41 },
          { x: 0.715, y: 0.855, s: 0.055, H: 0.24 },
        ];
    const chakri = { x: X(P ? 0.3 : 0.28), y: Y(P ? 0.955 : 0.945), R: u * (P ? 0.055 : 0.05) };
    const sparkPot = { x: X(P ? 0.93 : 0.955), y: Y(0.995), s: u * 0.09 };
    const sparkTips: Pt[] = [];
    const sparkBases: Pt[] = [];
    {
      const rs = fork(rng);
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + (i - 1) * 0.32 + rand(rs, -0.06, 0.06);
        const L = sparkPot.s * rand(rs, 1.6, 2.1);
        const bx = sparkPot.x + (i - 1) * sparkPot.s * 0.12;
        const by = sparkPot.y - sparkPot.s * 0.7;
        sparkBases.push({ x: bx, y: by });
        sparkTips.push({ x: bx + Math.cos(ang) * L, y: by + Math.sin(ang) * L });
      }
    }
    const flames: { x: number; y: number; s: number }[] = [];
    const rDiya = fork(rng);
    const rGarl = fork(rng);
    const rSmoke = fork(rng);
    const rFloor = fork(rng);
    const rLights = fork(rng);
    const rStars = fork(rng);
    const rAnar = fork(rng);

    const skyRects: NRect[] = P
      ? [
          [0.06, 0.04, 0.36, 0.3],
          [0.64, 0.04, 0.94, 0.3],
        ]
      : [
          [0.04, 0.05, 0.3, 0.42],
          [0.7, 0.05, 0.96, 0.42],
        ];

    const skyClip = (g: Ctx, fn: () => void) =>
      withState(g, () => {
        env.skyPath(g);
        g.clip();
        fn();
      });

    /** Colours buildings with light from the bursts above. */
    const burstTint = (lg: Ctx, k: number) => {
      for (const b of near) {
        const rg = lg.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.6);
        rg.addColorStop(0, rgba(b.c, k * b.a));
        rg.addColorStop(1, rgba(b.c, 0));
        lg.fillStyle = rg;
        lg.fillRect(0, 0, w, h);
      }
    };

    return {
      skyRects,
      painterly: { saturation: 1.12, warmth: 0.2, contrast: 1.06 },

      base(g) {
        // ---- sky
        gradientSky(g, 0, 0, w, h, [
          [0, '#080620'],
          [0.16, '#130f3e'],
          [0.36, '#25155a'],
          [0.52, '#42196a'],
          [0.63, '#6a2170'],
          [0.71, '#9a3266'],
          [0.77, '#c95544'],
          [0.85, '#3a1824'],
        ]);
        // broad colour variation so the sky is never a flat fill
        const rv = rSmoke;
        for (let i = 0; i < 26; i++) {
          const x = rand(rv, -0.1, 1.1) * w;
          const y = rand(rv, 0, 0.62) * h;
          wash(g, x, y, u * rand(rv, 0.2, 0.45), u * rand(rv, 0.08, 0.16), pick(rv, ['#2a1a6a', '#0a0822', '#4a1a66', '#1a2a6a', '#5a1a5a']), rand(rv, 0.12, 0.25));
        }
        // town glow on the horizon and the haze it lights
        oglow(g, X(0.5), pTop, w * 0.75, h * 0.22, '#ff7a3a', 0.26);
        oglow(g, X(0.18), pTop - h * 0.05, w * 0.3, h * 0.14, '#ff5a8a', 0.18);
        oglow(g, X(0.82), pTop - h * 0.05, w * 0.3, h * 0.14, '#ffa040', 0.2);
        // high drifting smoke (dark, gives the sky texture)
        litSmoke(g, rSmoke, X(0.5), Y(P ? 0.22 : 0.24), w * 0.62, h * 0.17, 26, u * 0.18, '#120c30', '#3e2c72', X(0.5), Y(0.7), 0.32);
        // smoke left by earlier rockets
        smokeTrail(g, rSmoke, X(0.06), Y(0.66), X(0.1), Y(0.45), X(0.2), Y(0.3), 16, u * 0.025, u * 0.07, '#2a1a40', '#b56a9a', X(0.13), Y(0.2), 0.3);
        smokeTrail(g, rSmoke, X(0.94), Y(0.64), X(0.92), Y(0.42), X(0.8), Y(0.25), 16, u * 0.025, u * 0.07, '#2a1a40', '#c9965a', X(0.85), Y(0.13), 0.3);
        smokeTrail(g, rSmoke, X(0.36), Y(0.66), X(0.4), Y(0.42), X(0.5), Y(0.3), 12, u * 0.02, u * 0.06, '#24163a', '#6a4a8a', X(0.5), Y(0.7), 0.22);
        // far bursts, then haze over them
        for (const b of far) burstBase(g, b, 0.8);
        hazeBand(g, Y(P ? 0.52 : 0.4), pTop, w, '#9a3a78', 0.22);
        // smoke clouds lit by the bursts
        for (const b of near) {
          if (b.r < u * 0.1) continue;
          const k = b.r > u * 0.2 ? 1 : 0.6;
          litSmoke(g, rSmoke, b.x, b.y + b.r * 0.3, b.r * 0.95, b.r * 0.6, Math.round(14 * k) + 4, b.r * 0.42, '#1e1438', mix(b.c, '#e8d8ff', 0.3), b.x, b.y, 0.34 * k);
        }
        for (const b of near) burstBase(g, b);
        // low smoke bank over the town, lit from below
        const lowY = pTop - u * (P ? 0.16 : 0.2);
        litSmoke(g, rSmoke, X(0.16), lowY, w * 0.2, h * 0.07, 16, u * 0.13, '#3a1d4a', '#ff9a6a', X(0.16), pTop + h * 0.1, 0.4);
        litSmoke(g, rSmoke, X(0.84), lowY, w * 0.2, h * 0.07, 16, u * 0.13, '#3a1d4a', '#ffb070', X(0.84), pTop + h * 0.1, 0.4);
        litSmoke(g, rSmoke, X(0.5), lowY + u * 0.04, w * 0.2, h * 0.05, 10, u * 0.1, '#3a1d4a', '#c8607a', X(0.5), pTop + h * 0.1, 0.24);

        // ---- far town (hazy)
        cityLayer(g, w, h, farCity, FAR_TONES, (lg) => {
          const grd = lg.createLinearGradient(0, pTop - u * 0.25, 0, pTop);
          grd.addColorStop(0, 'rgba(70,40,110,0.25)');
          grd.addColorStop(0.6, 'rgba(110,45,110,0.45)');
          grd.addColorStop(1, 'rgba(170,70,100,0.75)');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
          burstTint(lg, 0.3);
        });
        ledgesBase(g, farCity, 'rgba(190,110,150,0.18)', 'rgba(20,8,30,0.15)');
        windowsBase(g, farCity, 0.32, 'rgba(30,14,50,0.25)');
        hazeBand(g, pTop - u * 0.15, pTop + u * 0.02, w, '#c0507a', 0.32);

        // ---- floodlit landmarks
        cityLayer(g, w, h, templeC, ['#4a2232'], (lg) => {
          const t0 = nb - temple.th;
          const grd = lg.createLinearGradient(0, t0, 0, nb);
          grd.addColorStop(0, 'rgba(70,30,60,0.9)');
          grd.addColorStop(0.5, 'rgba(160,70,60,0.9)');
          grd.addColorStop(1, 'rgba(240,140,70,0.95)');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
          // roundness: dark flanks, lit middle
          const hx = lg.createLinearGradient(temple.x - temple.tw * 1.1, 0, temple.x + temple.tw * 0.8, 0);
          hx.addColorStop(0, 'rgba(20,6,20,0.65)');
          hx.addColorStop(0.55, 'rgba(255,190,120,0.18)');
          hx.addColorStop(0.75, 'rgba(255,190,120,0.1)');
          hx.addColorStop(1, 'rgba(20,6,20,0.7)');
          lg.fillStyle = hx;
          lg.fillRect(0, 0, w, h);
          // horizontal courses of the tower
          lg.strokeStyle = 'rgba(40,10,20,0.45)';
          lg.lineWidth = Math.max(2, temple.th * 0.009);
          lg.beginPath();
          for (let y = nb - temple.th * 0.12; y > t0; y -= temple.th * 0.05) {
            lg.moveTo(temple.x - temple.tw * 1.2, y);
            lg.lineTo(temple.x + temple.tw * 1.2, y);
          }
          lg.stroke();
          burstTint(lg, 0.25);
        });
        cityLayer(g, w, h, palaceC, ['#3a2040'], (lg) => {
          const t0 = nb - palace.dh * 1.02;
          const grd = lg.createLinearGradient(0, t0, 0, nb);
          grd.addColorStop(0, '#120822');
          grd.addColorStop(0.3, '#2a1236');
          grd.addColorStop(0.52, '#5a2248');
          grd.addColorStop(0.62, '#8a3450');
          grd.addColorStop(1, '#e08a5a');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
          const hx = lg.createLinearGradient(palace.x - palace.dw * 0.55, 0, palace.x + palace.dw * 0.55, 0);
          hx.addColorStop(0, 'rgba(8,2,16,0.8)');
          hx.addColorStop(0.38, 'rgba(255,170,200,0.14)');
          hx.addColorStop(0.5, 'rgba(255,170,200,0.06)');
          hx.addColorStop(1, 'rgba(8,2,16,0.85)');
          lg.fillStyle = hx;
          lg.fillRect(0, 0, w, h);
          burstTint(lg, 0.15);
        });
        windowsBase(g, templeC, 0.8);
        windowsBase(g, palaceC, 0.7);
        flagsBase(g, templeC);
        cityGlowBase(g, templeC, 1.2);
        cityGlowBase(g, palaceC, 1.2);

        // ---- near town
        cityLayer(g, w, h, nearCity, NEAR_TONES, (lg) => {
          const top = pTop - u * 0.2;
          const grd = lg.createLinearGradient(0, top, 0, pTop);
          grd.addColorStop(0, 'rgba(20,10,40,0.2)');
          grd.addColorStop(0.7, 'rgba(60,20,40,0.35)');
          grd.addColorStop(1, 'rgba(120,45,40,0.6)');
          lg.fillStyle = grd;
          lg.fillRect(0, 0, w, h);
          burstTint(lg, 0.2);
        });
        ledgesBase(g, nearCity, 'rgba(200,110,90,0.3)', 'rgba(8,2,12,0.4)');
        windowsBase(g, nearCity, 0.6);
        strandWires(g, nearCity);
        cityGlowBase(g, nearCity, 1);
        // smoke drifting in front of the town's feet
        litSmoke(g, rSmoke, X(0.5), pTop - u * 0.02, w * 0.55, h * 0.02, 18, u * 0.08, '#4a2030', '#ff9060', X(0.5), pTop + h * 0.2, 0.2);

        // ---- terrace parapet
        {
          const faceGrd = g.createLinearGradient(0, pTop, 0, pBot);
          faceGrd.addColorStop(0, '#6a3030');
          faceGrd.addColorStop(0.25, '#4a1f28');
          faceGrd.addColorStop(1, '#2a1018');
          g.fillStyle = faceGrd;
          g.fillRect(0, pTop, w, pBot - pTop + 1);
          // plaster texture: soft blotches
          for (let i = 0; i < 26; i++) wash(g, rand(rFloor, 0, w), rand(rFloor, pTop + cope, pBot), u * rand(rFloor, 0.04, 0.1), (pBot - pTop) * 0.4, pick(rFloor, ['#7a3a38', '#2a0e16', '#5a2430']), 0.25);
          // warm light from the anars on the wall
          for (const a of anars) oglow(g, X(a.x), pBot, u * 0.32, (pBot - pTop) * 1.4, '#ff8a3a', 0.35);
          // coping slab
          const cg = g.createLinearGradient(0, pTop - cope * 0.2, 0, pTop + cope);
          cg.addColorStop(0, '#c07a5a');
          cg.addColorStop(0.35, '#8a4a3e');
          cg.addColorStop(1, '#3a1a20');
          g.fillStyle = cg;
          g.fillRect(0, pTop - cope * 0.2, w, cope * 1.2);
          // posts with caps
          for (const px of posts) {
            const x0 = X(px) - postW / 2;
            const pg = g.createLinearGradient(x0, 0, x0 + postW, 0);
            pg.addColorStop(0, '#3a1a20');
            pg.addColorStop(0.4, '#8a4a3e');
            pg.addColorStop(1, '#2a1018');
            g.fillStyle = pg;
            g.fillRect(x0, pTop - postH, postW, pBot - pTop + postH);
            g.fillStyle = '#b06a50';
            g.fillRect(x0 - postW * 0.12, pTop - postH - cope * 0.6, postW * 1.24, cope * 0.75);
          }
          // marigold swags between posts
          for (let i = 0; i + 1 < posts.length; i++) {
            const a = { x: X(posts[i]) + postW * 0.45, y: pTop + cope * 1.4 };
            const b = { x: X(posts[i + 1]) - postW * 0.45, y: pTop + cope * 1.4 };
            const sag = (pBot - pTop) * 0.55;
            marigoldGarland(g, rGarl, sagPath(a, b, sag, 24), u * 0.0105);
          }
          // diyas on the posts and along the coping (not behind the person)
          for (const px of posts) flames.push({ ...diya(g, X(px), pTop - postH - cope * 0.6, u * 0.042, { dir: px < 0.5 ? 1 : -1 }), s: u * 0.042 });
          for (let i = 0; i + 1 < posts.length; i++) {
            const mid = (posts[i] + posts[i + 1]) / 2;
            if (mid > 0.36 && mid < 0.64) continue;
            for (const t of [0.3, 0.5, 0.7]) {
              const dx = X(posts[i] + (posts[i + 1] - posts[i]) * t);
              flames.push({ ...diya(g, dx, pTop - cope * 0.05, u * 0.03, { dir: rDiya() < 0.5 ? 1 : -1, paint: pick(rDiya, [['#ffd34d', '#e2412b', '#ffffff'], ['#ffffff', '#1f9e89', '#ffd34d'], ['#ff7ad9', '#ffd34d', '#ffffff']]) }), s: u * 0.03 });
            }
          }
        }

        // ---- terrace floor
        {
          const fg = g.createLinearGradient(0, pBot, 0, h);
          fg.addColorStop(0, '#4a2228');
          fg.addColorStop(0.4, '#30141c');
          fg.addColorStop(1, '#170910');
          g.fillStyle = fg;
          g.fillRect(0, pBot, w, h - pBot);
          withState(g, () => {
            g.beginPath();
            g.rect(0, pBot, w, h - pBot);
            g.clip();
            // tiles in perspective
            const vx = X(0.5);
            const vy = pBot - (h - pBot) * 1.6;
            g.strokeStyle = 'rgba(10,2,8,0.35)';
            g.lineWidth = Math.max(1.5, u * 0.0025);
            g.beginPath();
            for (let i = -12; i <= 12; i++) {
              const bx = X(0.5 + i * 0.09);
              g.moveTo(vx + (bx - vx) * ((pBot - vy) / (h - vy)), pBot);
              g.lineTo(bx, h);
            }
            for (let k = 1; k < 7; k++) {
              const y = pBot + (h - pBot) * Math.pow(k / 7, 1.5);
              g.moveTo(0, y);
              g.lineTo(w, y);
            }
            g.stroke();
            g.strokeStyle = 'rgba(255,170,120,0.08)';
            g.lineWidth = Math.max(1, u * 0.0015);
            g.beginPath();
            for (let k = 1; k < 7; k++) {
              const y = pBot + (h - pBot) * Math.pow(k / 7, 1.5) + u * 0.002;
              g.moveTo(0, y);
              g.lineTo(w, y);
            }
            g.stroke();
          });
          // shadow at the foot of the wall
          hazeBand(g, pBot - u * 0.01, pBot + u * 0.03, w, '#0a0208', 0.5);
          // light pools from the crackers
          for (const a of anars) oglow(g, X(a.x), Y(a.y), u * 0.42 * (a.s / 0.085), u * 0.12, '#ff9440', 0.5);
          oglow(g, chakri.x, chakri.y, chakri.R * 6, chakri.R * 2.2, '#ffb050', 0.45);
          oglow(g, sparkPot.x, sparkPot.y, u * 0.2, u * 0.06, '#ffc070', 0.3);
          // spent cracker paper on the floor
          for (let i = 0; i < 70; i++) {
            const side = rFloor() < 0.5 ? rand(rFloor, 0, 0.33) : rand(rFloor, 0.67, 1);
            const y = rand(rFloor, pBot + u * 0.02, h);
            const s = u * rand(rFloor, 0.004, 0.009) * (0.6 + (y - pBot) / (h - pBot));
            g.fillStyle = pick(rFloor, ['#c41e2a', '#e2412b', '#8a1020', '#ffd34d', '#e0e0d0']);
            g.beginPath();
            g.ellipse(X(side), y, s, s * 0.45, rand(rFloor, 0, Math.PI), 0, TAU);
            g.fill();
          }
          // ground crackers
          for (const a of anars) anarPot(g, X(a.x), Y(a.y), u * a.s, pick(rFloor, ['#c21f3a', '#1f6ec2', '#1f9e5a']));
          // chakri wheel (the spinning disc itself)
          g.beginPath();
          g.ellipse(chakri.x, chakri.y, chakri.R * 0.35, chakri.R * 0.35 * 0.36, 0, 0, TAU);
          g.fillStyle = '#5a2a10';
          g.fill();
          // sparkler pot: clay matka with sand
          {
            const { x, y, s } = sparkPot;
            wash(g, x, y, s * 0.9, s * 0.15, '#000000', 0.5);
            g.beginPath();
            g.moveTo(x - s * 0.25, y - s * 0.72);
            g.bezierCurveTo(x - s * 0.62, y - s * 0.6, x - s * 0.55, y, x, y);
            g.bezierCurveTo(x + s * 0.55, y, x + s * 0.62, y - s * 0.6, x + s * 0.25, y - s * 0.72);
            g.closePath();
            const pg = g.createRadialGradient(x - s * 0.15, y - s * 0.55, s * 0.05, x, y - s * 0.35, s * 0.6);
            pg.addColorStop(0, '#e89a5a');
            pg.addColorStop(0.5, '#a24a22');
            pg.addColorStop(1, '#3a1206');
            g.fillStyle = pg;
            g.fill();
            g.strokeStyle = 'rgba(255,240,200,0.6)';
            g.lineWidth = Math.max(1.5, s * 0.03);
            g.beginPath();
            g.ellipse(x, y - s * 0.35, s * 0.5, s * 0.08, 0, 0.1, Math.PI - 0.1);
            g.stroke();
            g.beginPath();
            g.ellipse(x, y - s * 0.72, s * 0.27, s * 0.06, 0, 0, TAU);
            g.fillStyle = '#c8a070';
            g.fill();
          }
          // floor diyas
          const fd: [number, number, number][] = P
            ? [
                [0.05, 0.97, 0.06],
                [0.13, 0.99, 0.055],
                [0.78, 0.985, 0.055],
              ]
            : [
                [0.035, 0.965, 0.055],
                [0.085, 0.99, 0.05],
                [0.225, 0.985, 0.045],
                [0.79, 0.985, 0.05],
              ];
          for (const [fx, fy, fs] of fd) flames.push({ ...diya(g, X(fx), Y(fy), u * fs, { dir: fx < 0.5 ? 1 : -1 }), s: u * fs });
        }
        // low smoke from the anars, lit gold
        for (const a of anars) litSmoke(g, rSmoke, X(a.x), Y(a.y) - u * a.H * 0.6, u * 0.12, u * 0.08, 6, u * 0.09, '#3a2030', '#ffb070', X(a.x), Y(a.y), 0.18);
        vignette(g, w, h, 0.4, '#05020c');
      },

      lights(g) {
        const rl = rLights;
        skyClip(g, () => {
          starField(g, rStars, 0, 0, w, Y(P ? 0.45 : 0.4), 140, u * 0.0018);
          for (const b of far) burstLights(g, b, 0.75);
          for (const b of near) burstLights(g, b);
          for (const [x0, y0, x1, y1] of rockets) rocketTrail(g, rl, X(x0), Y(y0), X(x1), Y(y1), u * 0.0032);
          // glittering dust drifting under the big bursts
          for (const b of big) embers(g, rl, b.x - b.r * 0.9, b.y, b.x + b.r * 0.9, b.y + b.r * 1.3, 70, u * 0.0022);
          embers(g, rl, 0, Y(0.05), w, pTop, 90, u * 0.0018, ['#ffd27a', '#ff9ad0', '#bfe6ff', '#fff0c8']);
        });
        windowsLights(g, farCity, 0.5);
        cityLights(g, fork(rl), farCity, 0.6);
        windowsLights(g, templeC, 1);
        cityLights(g, fork(rl), templeC, 1);
        windowsLights(g, palaceC, 1);
        cityLights(g, fork(rl), palaceC, 1);
        windowsLights(g, nearCity, 1);
        cityLights(g, fork(rl), nearCity, 1);
        // terrace diyas
        for (const f of flames) diyaFlame(g, rl, f.x, f.y, f.s, 1);
        // ground crackers
        for (const a of anars) anarSpray(g, rAnar, X(a.x), Y(a.y) - u * a.s * 0.86, Y(a.H), Y(a.y), a.s > 0.07 ? 650 : 320, 0.24);
        chakriSpin(g, rAnar, chakri.x, chakri.y, chakri.R, 0.36, ['#ffd27a', '#ff7a3a', '#bfff8a', '#fff2c8']);
        // sparklers: wire sticks then the burning tips
        for (let i = 0; i < sparkTips.length; i++) {
          const b = sparkBases[i];
          const t = sparkTips[i];
          g.strokeStyle = 'rgba(150,140,130,0.9)';
          g.lineWidth = Math.max(1.2, u * 0.0028);
          g.beginPath();
          g.moveTo(b.x, b.y);
          g.lineTo(t.x, t.y);
          g.stroke();
          g.strokeStyle = 'rgba(40,30,30,0.9)';
          g.lineWidth = Math.max(1, u * 0.0016);
          g.beginPath();
          g.moveTo(t.x, t.y);
          g.lineTo(t.x + (t.x - b.x) * 0.25, t.y + (t.y - b.y) * 0.25);
          g.stroke();
          sparklerBurn(g, rAnar, t.x, t.y, u * (P ? 0.07 : 0.065));
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
