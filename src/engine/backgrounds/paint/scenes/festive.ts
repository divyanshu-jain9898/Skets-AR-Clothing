import type { SceneSpec } from '../scene';
import { archPath, bell, bokeh, drawBulbs, glow, gradientSky, lanternGlow, lerp, mix, rand, sparkle, stringLights, vignette, wash, withState, type Bulb, type Ctx, type Rng } from '../kit';
import { brushwork, flame, fork, genda, leafSimple, mottle, pool, scatterPetals, type Flame } from './diyas-parts';
import { butiPattern, drape, flowerUrli, kandil, powderRangoli, richToran } from './festive-parts';

const WARM = ['#fff1c8', '#ffd27a', '#ffe7a8', '#ffc861'] as const;
const PETALS = ['#ff8a00', '#ffc23d', '#c8102e', '#d6247b', '#fff4e0'] as const;

/**
 * "Festive Decoration": a deep rani-pink wall with block-printed paisleys,
 * peacock-teal silk drapes, curtains of marigold ladis ending in bells, a
 * toran and rows of fairy lights across the top, glowing akash kandils,
 * lotus arrangements in brass urlis on stands and a large powder rangoli
 * ringed with diyas at the person's feet.
 */
export const festive: SceneSpec = {
  id: 'festive',
  compose(w, h, rng) {
    const u = Math.min(w, h);
    const land = w >= h;
    const Yf = h * (land ? 0.76 : 0.79);
    const flames: Flame[] = [];
    const bulbs: Bulb[] = [];
    const lamps: { x: number; y: number; s: number; c: string }[] = [];

    function wall(g: Ctx, r: Rng) {
      gradientSky(g, 0, 0, w, Yf, [
        [0, '#30031f'],
        [0.4, '#5e0a3a'],
        [1, '#7e1449'],
      ]);
      mottle(g, r, -0.05 * w, -0.05 * h, 1.05 * w, Yf, 110, ['#9a1f5a', '#3a0426', '#b02a68', '#5a0a38', '#8a1a3a'], 0.28, u * 0.05, u * 0.15);
      brushwork(g, r, -0.02 * w, 0, 1.02 * w, Yf, 320, ['#a82a64', '#3a0424', '#c23a74', '#6a0a3e'], 0.14, u * 0.08, u * 0.012, -1.1, 0.7);
      butiPattern(g, 0, h * 0.02, w, Yf, u * 0.085, '#f2c25a', 0.1);
      // warm light rising from the lamps and arrangements at the sides
      for (const sx of [0, w]) glow(g, sx, Yf, w * (land ? 0.4 : 0.6), '#ff7a3a', 0.2);
      // soft lift behind the person so the figure separates from the wall
      wash(g, w / 2, h * 0.48, w * (land ? 0.24 : 0.36), h * 0.36, '#b8306e', 0.22);
    }

    /** Gold-outlined cusped arch panel framing the person. */
    function backdrop(g: Ctx) {
      const aw = w * (land ? 0.36 : 0.5);
      const top = h * (land ? 0.15 : 0.2);
      withState(g, () => {
        g.beginPath();
        archPath(g, w / 2, Yf, aw, Yf - top, 9);
        g.closePath();
        const ig = g.createLinearGradient(0, top, 0, Yf);
        ig.addColorStop(0, 'rgba(40,2,24,0.45)');
        ig.addColorStop(1, 'rgba(120,20,70,0.15)');
        g.fillStyle = ig;
        g.fill();
        g.strokeStyle = 'rgba(242,194,90,0.55)';
        g.lineWidth = Math.max(1, u * 0.007);
        g.stroke();
        g.beginPath();
        archPath(g, w / 2, Yf, aw + u * 0.035, Yf - top + u * 0.02, 9);
        g.strokeStyle = 'rgba(242,194,90,0.3)';
        g.lineWidth = Math.max(1, u * 0.004);
        g.stroke();
      });
    }

    /** Marigold ladi with leaves, a white mogra bead now and then, ending in a bell. */
    function ladi(g: Ctx, r: Rng, x: number, y0: number, L: number, rad: number) {
      const step = rad * 1.55;
      const n = Math.max(3, Math.round(L / step));
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const sway = Math.sin(t * 3.2 + x * 0.013) * rad * 0.3;
        const y = y0 + i * step;
        const a = rand(r, -0.4, 0.4);
        if (i % 5 === 2) leafSimple(g, x + sway, y, rad * 1.6, Math.PI / 2 + (i % 2 ? 0.9 : -0.9) + a, '#2f7a2c');
        const c = i % 7 === 6 ? '#fff4e0' : i % 7 === 3 ? '#d8241e' : i % 2 ? '#ffb000' : '#ff7a00';
        genda(g, r, x + sway, y, rad * (i % 7 === 6 ? 0.8 : 1), c);
      }
      const end = y0 + n * step;
      g.strokeStyle = 'rgba(80,40,10,0.8)';
      g.lineWidth = Math.max(1, rad * 0.12);
      g.beginPath();
      g.moveTo(x, end - step * 0.5);
      g.lineTo(x, end + rad * 0.2);
      g.stroke();
      bell(g, x, end + rad * 0.9, rad * 1.15);
    }

    function floor(g: Ctx, r: Rng) {
      const fg = g.createLinearGradient(0, Yf, 0, h);
      fg.addColorStop(0, '#6a2a24');
      fg.addColorStop(0.35, '#3e1612');
      fg.addColorStop(1, '#1c0806');
      g.fillStyle = fg;
      g.fillRect(0, Yf, w, h - Yf);
      for (let i = 0; i < 40; i++) {
        const x = rand(r, -0.1, 1.1) * w;
        const y = rand(r, Yf, h);
        wash(g, x, y, u * rand(r, 0.1, 0.3), u * rand(r, 0.006, 0.016), r() < 0.5 ? '#8a3a30' : '#0a0202', 0.3);
      }
      brushwork(g, r, -0.02 * w, Yf, 1.02 * w, h, 140, ['#8a3a30', '#120404', '#a04a38'], 0.16, u * 0.1, u * 0.01, 0, 0.25);
      // reflection of the pink wall in the polished floor
      wash(g, w / 2, Yf + (h - Yf) * 0.08, w * 0.6, (h - Yf) * 0.15, '#a02a5a', 0.3);
      // skirting: peacock band with gold lines
      const sh = u * 0.028;
      const sg = g.createLinearGradient(0, Yf - sh, 0, Yf);
      sg.addColorStop(0, '#0e6a72');
      sg.addColorStop(1, '#063a40');
      g.fillStyle = sg;
      g.fillRect(0, Yf - sh, w, sh);
      g.fillStyle = '#e8b84a';
      g.fillRect(0, Yf - sh, w, Math.max(1, sh * 0.14));
      g.fillRect(0, Yf - Math.max(1, sh * 0.12), w, Math.max(1, sh * 0.12));
    }

    return {
      base(g) {
        const r = fork(rng);
        const rf = fork(rng);
        wall(g, r);
        backdrop(g);
        // out-of-focus fairy lights in the upper wall
        bokeh(g, r, -0.03 * w, 0.08 * h, w * 0.3, Yf * 0.85, 22, ['#ffd27a', '#ffb347', '#ff7ab0', '#fff0c8'], u * 0.012, u * 0.045, 0.22);
        bokeh(g, r, w * 0.7, 0.08 * h, w * 1.03, Yf * 0.85, 22, ['#ffd27a', '#ffb347', '#ff7ab0', '#fff0c8'], u * 0.012, u * 0.045, 0.22);
        // the fairy lights in the ladi curtains warm the wall around them
        for (const sx of [0.17, 0.83]) wash(g, sx * w, h * 0.3, w * (land ? 0.16 : 0.2), h * 0.28, '#ff9a6a', 0.14);
        // drapes at the edges
        const dw = w * (land ? 0.062 : 0.08);
        drape(g, -1, w, h, dw, 0, h * 0.56, Yf + h * 0.02, '#0b6f78', '#e8b84a');
        drape(g, 1, w, h, dw, 0, h * 0.56, Yf + h * 0.02, '#0b6f78', '#e8b84a');
        // curtains of marigold ladis, longest at the outside
        const nS = land ? 6 : 4;
        const xs0 = land ? 0.075 : 0.1;
        const xs1 = land ? 0.27 : 0.28;
        const rad = u * (land ? 0.017 : 0.019);
        const ladiTop = h * 0.05;
        for (const side of [-1, 1] as const) {
          for (let i = 0; i < nS; i++) {
            const t = i / (nS - 1);
            const fx = lerp(xs0, xs1, t);
            const x = side < 0 ? fx * w : w - fx * w;
            const L = h * lerp(land ? 0.56 : 0.5, land ? 0.24 : 0.22, Math.pow(t, 0.8));
            // a curtain-light strand between the ladis
            if (i + 1 < nS) {
              const cx = side < 0 ? lerp(fx, lerp(xs0, xs1, (i + 1) / (nS - 1)), 0.5) * w : w - lerp(fx, lerp(xs0, xs1, (i + 1) / (nS - 1)), 0.5) * w;
              const cl = L * 0.9;
              g.strokeStyle = 'rgba(60,20,30,0.5)';
              g.lineWidth = Math.max(1, u * 0.0018);
              g.beginPath();
              g.moveTo(cx, ladiTop);
              g.lineTo(cx, ladiTop + cl);
              g.stroke();
              const nb = Math.max(4, Math.round(cl / (u * 0.045)));
              for (let k = 0; k < nb; k++) bulbs.push({ x: cx, y: ladiTop + (cl * (k + 0.6)) / nb, color: WARM[(k + i) % WARM.length], r: u * 0.0042 });
            }
            ladi(g, rf, x, ladiTop + rad, L, rad);
          }
        }
        // akash kandils
        const kd = land
          ? [
              { x: w * 0.2, cy: h * 0.43, s: u * 0.11, c1: '#ff7a00', c2: '#d6247b' },
              { x: w * 0.8, cy: h * 0.39, s: u * 0.11, c1: '#d6247b', c2: '#0b8f96' },
            ]
          : [
              { x: w * 0.19, cy: h * 0.36, s: u * 0.15, c1: '#ff7a00', c2: '#d6247b' },
              { x: w * 0.81, cy: h * 0.33, s: u * 0.15, c1: '#d6247b', c2: '#0b8f96' },
            ];
        for (const k of kd) {
          glow(g, k.x, k.cy, k.s * 2.2, k.c1, 0.2);
          kandil(g, rf, k.x, 0, k.cy, k.s, k.c1, k.c2);
          lamps.push({ x: k.x, y: k.cy, s: k.s, c: k.c1 });
        }
        // toran and rows of fairy lights across the top
        const tSize = u * (land ? 0.085 : 0.075);
        const tY = tSize * 0.36;
        const rows = land ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1];
        for (let i = 0; i + 1 < rows.length; i++) {
          const a = { x: rows[i] * w, y: tY + tSize * 0.9 };
          const b = { x: rows[i + 1] * w, y: tY + tSize * 0.9 };
          bulbs.push(...stringLights(g, r, a, b, h * 0.05, 9, WARM, u * 0.0045, 'rgba(50,16,26,0.7)'));
        }
        richToran(g, rf, -tSize * 0.3, w + tSize * 0.3, tY, tSize);
        floor(g, r);
        // lotus arrangements on brass stands at the sides
        const ur = land
          ? [
              { x: w * 0.115, b: h * 0.855, W: w * 0.15 },
              { x: w * 0.885, b: h * 0.855, W: w * 0.15 },
            ]
          : [
              { x: w * 0.16, b: h * 0.85, W: w * 0.27 },
              { x: w * 0.84, b: h * 0.85, W: w * 0.27 },
            ];
        ur.forEach((o, i) => {
          pool(g, o.x, o.b, o.W * 1.1, o.W * 0.25, '#ff9a4a', 0.25);
          flames.push(...flowerUrli(g, rf, o.x, o.b, o.W, i ? -1 : 1));
        });
        // lantern light reflected in the polished floor
        for (const l of lamps) pool(g, l.x, Yf + (h - Yf) * 0.3, l.s * 0.5, (h - Yf) * 0.3, l.c, 0.16);
        // the rangoli at the feet
        const rc = land ? { x: w * 0.5, y: h * 0.88, R: w * 0.18, t: 0.28 } : { x: w * 0.5, y: h * 0.905, R: w * 0.32, t: 0.3 };
        pool(g, rc.x, rc.y, rc.R * 1.6, rc.R * 0.55, '#ff9a4a', 0.2);
        flames.push(...powderRangoli(g, rf, rc.x, rc.y, rc.R, rc.t, 12));
        scatterPetals(g, rf, w * 0.03, Yf + (h - Yf) * 0.2, w * 0.97, h, 46, u * 0.011, PETALS);
        vignette(g, w, h, 0.42, '#12020a');
      },
      lights(g) {
        const r = fork(rng);
        drawBulbs(g, bulbs, 0.95);
        for (const l of lamps) lanternGlow(g, l.x, l.y, l.s, l.c, 0.9);
        for (const f of flames) flame(g, r, f);
        for (let i = 0; i < 22; i++) {
          const x = rand(r, 0, 1) * w;
          const y = rand(r, 0.05, 0.75) * h;
          const s = u * rand(r, 0.004, 0.009);
          const c = mix('#fff1c8', '#ffb347', r());
          const a = rand(r, 0.3, 0.75);
          if (Math.abs(x - w / 2) > w * 0.18) sparkle(g, x, y, s, c, a);
        }
      },
      painterly: { warmth: 0.2, saturation: 1.08, contrast: 1.05 },
    };
  },
};
