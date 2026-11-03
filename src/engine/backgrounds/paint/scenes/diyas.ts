import type { SceneSpec } from '../scene';
import { archPath, bell, bokeh, glow, gradientSky, lerp, mix, rand, sagPath, sparkle, vignette, wash, withState, type Ctx, type Pt, type Rng } from '../kit';
import { backlit, brushwork, clayDiya, flame, fork, garland, genda, hangingLamp, kuthuVilakku, mottle, petalRangoli, pool, rose, scatterPetals, thali, urli, type Flame } from './diyas-parts';

const CLAYS = ['#b4532a', '#a3401f', '#c2652f', '#9c3a22'] as const;
const BANDS = ['#ffcf4a', '#e8402a', '#2fa58f', '#ffcf4a', '#d6247b'] as const;
const PETALS = ['#ff8a00', '#ffc23d', '#c8102e', '#d6247b', '#fff4e0'] as const;

/**
 * "Diya Decorations": a warm, softly lit set. Stepped platforms on both sides
 * draped in maroon silk and gold carry rows of glowing earthen diyas, a
 * cusped arch frames the person, brass lamps hang from the top, and a petal
 * rangoli ringed with diyas, a brass urli of floating lamps and a tall kuthu
 * vilakku stand on the polished floor.
 */
export const diyas: SceneSpec = {
  id: 'diyas',
  compose(w, h, rng) {
    const u = Math.min(w, h);
    const land = w >= h;
    const flames: Flame[] = [];
    const front: Pt[] = []; // lowest-row flames, mirrored in the floor

    const Yf = h * (land ? 0.79 : 0.815); // front of the lowest step
    const Yw = Yf - h * (land ? 0.045 : 0.028); // wall base behind the person
    const nT = land ? 3 : 4;
    const sh = land ? h * 0.088 : h * 0.054; // step height
    const inner = land ? [0.345, 0.245, 0.145] : [0.33, 0.25, 0.17, 0.09];
    const dS = u * (land ? 0.062 : 0.064); // diya size on the steps
    const spacing = u * (land ? 0.08 : 0.078);
    const topStep = Yf - nT * sh;

    function wall(g: Ctx, r: Rng) {
      gradientSky(g, 0, 0, w, h, [
        [0, '#0e0303'],
        [0.4, '#1c0706'],
        [0.8, '#2e0e08'],
        [1, '#1e0805'],
      ]);
      mottle(g, r, -0.05 * w, -0.05 * h, 1.05 * w, Yf, 120, ['#40140c', '#120302', '#52200f', '#250806', '#5a2812'], 0.32, u * 0.05, u * 0.16);
      brushwork(g, r, -0.02 * w, 0, 1.02 * w, Yf, 320, ['#5a2414', '#140404', '#6e3018', '#2a0a08'], 0.16, u * 0.08, u * 0.012, -1.1, 0.7);
      // lamp light washing the wall above the steps and around the hanging lamps
      for (const sx of [0, w]) {
        glow(g, sx, topStep, w * (land ? 0.45 : 0.62), '#ff6a1a', 0.22);
        glow(g, sx + (sx ? -1 : 1) * w * 0.1, topStep + sh, w * 0.28, '#ffa040', 0.14);
      }
      // dim centre so the person stands out against a quiet backdrop
      wash(g, w / 2, h * 0.42, w * (land ? 0.2 : 0.3), h * 0.4, '#070101', 0.35);
    }

    function arch(g: Ctx, r: Rng) {
      const aw = w * (land ? 0.3 : 0.4);
      const top = h * (land ? 0.1 : 0.2);
      const ah = Yw - top;
      const cx = w / 2;
      const fw = u * 0.055;
      withState(g, () => {
        g.beginPath();
        archPath(g, cx, Yw, aw + fw * 2, ah + fw, 9);
        g.closePath();
        const fg = g.createLinearGradient(0, top, 0, Yw);
        fg.addColorStop(0, '#2e1208');
        fg.addColorStop(0.6, '#4a2010');
        fg.addColorStop(1, '#6a3016');
        g.fillStyle = fg;
        g.fill();
        g.strokeStyle = 'rgba(170,110,50,0.4)';
        g.lineWidth = Math.max(1, u * 0.004);
        g.stroke();
        // carved bead line along the frame
        g.beginPath();
        archPath(g, cx, Yw, aw + fw, ah + fw * 0.5, 9);
        g.setLineDash([u * 0.006, u * 0.008]);
        g.strokeStyle = 'rgba(220,160,80,0.35)';
        g.lineWidth = Math.max(1, u * 0.006);
        g.stroke();
      });
      withState(g, () => {
        g.beginPath();
        archPath(g, cx, Yw, aw, ah, 9);
        g.closePath();
        const ig = g.createLinearGradient(0, top, 0, Yw);
        ig.addColorStop(0, '#0a0202');
        ig.addColorStop(0.6, '#1a0604');
        ig.addColorStop(1, '#341008');
        g.fillStyle = ig;
        g.fill();
        // warm rim light on the inner edge of the arch from the floor lamps
        g.strokeStyle = 'rgba(255,170,90,0.28)';
        g.lineWidth = Math.max(1, u * 0.006);
        g.stroke();
        g.clip();
        // a dim inner doorway further back gives the recess depth
        g.beginPath();
        archPath(g, cx, Yw - ah * 0.05, aw * 0.56, ah * 0.7, 7);
        g.closePath();
        const dg = g.createLinearGradient(0, Yw - ah * 0.75, 0, Yw);
        dg.addColorStop(0, '#1c0705');
        dg.addColorStop(1, '#4a1a0c');
        g.fillStyle = dg;
        g.fill();
        g.strokeStyle = 'rgba(200,120,60,0.14)';
        g.lineWidth = Math.max(1, u * 0.005);
        g.stroke();
        glow(g, cx, Yw - ah * 0.05, aw * 0.45, '#ff8a3a', 0.1);
        bokeh(g, r, cx - aw * 0.42, top + ah * 0.08, cx + aw * 0.42, top + ah * 0.45, 7, ['#ffb347', '#ff8a2a'], u * 0.012, u * 0.035, 0.07);
        wash(g, cx, Yw, aw * 0.7, ah * 0.3, '#7a3418', 0.35);
      });
      if (!land) return;
      // pillars either side of the arch
      for (const sx of [-1, 1]) {
        const px = cx + sx * (aw / 2 + fw * 0.5);
        const pw = u * 0.036;
        const ptop = Yw - ah * 0.58;
        const pg = g.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0);
        pg.addColorStop(0, '#1e0a04');
        pg.addColorStop(0.45, '#6a3a1c');
        pg.addColorStop(0.62, '#9a5a2a');
        pg.addColorStop(1, '#1e0a04');
        g.fillStyle = pg;
        g.fillRect(px - pw / 2, ptop, pw, Yw - ptop);
        for (const [yy, hh] of [
          [ptop - u * 0.014, u * 0.024],
          [Yw - u * 0.032, u * 0.032],
          [ptop + (Yw - ptop) * 0.3, u * 0.012],
        ] as const) {
          g.fillStyle = pg;
          g.fillRect(px - pw * 0.8, yy, pw * 1.6, hh);
          g.fillStyle = 'rgba(255,200,120,0.22)';
          g.fillRect(px - pw * 0.8, yy, pw * 1.6, Math.max(1, hh * 0.25));
        }
      }
    }

    /** Arched wall niche with a diya inside. */
    function niche(g: Ctx, x: number, y: number, nw: number, nh: number, clay: string) {
      glow(g, x, y - nh * 0.35, nw * 2.2, '#ff7a2a', 0.18);
      withState(g, () => {
        g.beginPath();
        archPath(g, x, y, nw * 1.28, nh * 1.12, 5);
        g.closePath();
        g.fillStyle = '#3e1a0c';
        g.fill();
        g.strokeStyle = 'rgba(220,160,80,0.4)';
        g.lineWidth = Math.max(1, u * 0.004);
        g.stroke();
        g.beginPath();
        archPath(g, x, y, nw, nh, 5);
        g.closePath();
        const ig = g.createRadialGradient(x, y - nh * 0.15, 0, x, y - nh * 0.3, nh * 0.9);
        ig.addColorStop(0, '#d0703a');
        ig.addColorStop(0.35, '#6a2610');
        ig.addColorStop(1, '#160402');
        g.fillStyle = ig;
        g.fill();
      });
      g.fillStyle = '#5a2c14';
      g.fillRect(x - nw * 0.72, y, nw * 1.44, nh * 0.07);
      g.fillStyle = 'rgba(255,190,110,0.35)';
      g.fillRect(x - nw * 0.72, y, nw * 1.44, Math.max(1, nh * 0.015));
      const s = nw * 0.56;
      const p = clayDiya(g, x - s * 0.18, y - s * 0.04, s, { clay, band: '#ffcf4a', dots: '#fff4d0', dir: 1, shadow: 0.4 });
      flames.push({ x: p.x, y: p.y, h: s * 0.55, halo: 0.9 });
    }

    /** Stepped platform on one side: silk-draped risers, garland swags, diyas. */
    function steps(g: Ctx, r: Rng, side: -1 | 1) {
      const X = (fx: number) => (side < 0 ? fx * w : w - fx * w);
      const xo = side < 0 ? -0.02 * w : 1.02 * w;
      const d = sh * 0.34;
      for (let k = nT - 1; k >= 0; k--) {
        const yk = Yf - (k + 1) * sh;
        const xi = X(inner[k]);
        const sk = -side * d * 0.9; // back edge leans toward the centre
        const x0 = Math.min(xo, xi);
        const x1 = Math.max(xo, xi);
        // inner end face
        g.beginPath();
        g.moveTo(xi, yk);
        g.lineTo(xi + sk, yk - d);
        g.lineTo(xi + sk, Yf - d);
        g.lineTo(xi, Yf);
        g.closePath();
        const eg = g.createLinearGradient(0, yk, 0, Yf);
        eg.addColorStop(0, '#4a1408');
        eg.addColorStop(1, '#1a0504');
        g.fillStyle = eg;
        g.fill();
        // riser: maroon silk with a gold zari border
        const rg = g.createLinearGradient(0, yk, 0, yk + sh);
        rg.addColorStop(0, '#7a1a16');
        rg.addColorStop(0.55, '#4a0c0e');
        rg.addColorStop(1, '#220405');
        g.fillStyle = rg;
        g.fillRect(x0, yk, x1 - x0, Yf - yk);
        // soft silk folds
        for (let i = 0; i < 6; i++) {
          const fx = lerp(x0, x1, (i + 0.5) / 6);
          wash(g, fx, yk + sh * 0.6, (x1 - x0) * 0.05, sh * 0.6, i % 2 ? '#000000' : '#9a2a20', 0.18);
        }
        const zy = yk + sh * 0.06;
        const zh = sh * 0.12;
        const zg = g.createLinearGradient(0, zy, 0, zy + zh);
        zg.addColorStop(0, '#ffe08a');
        zg.addColorStop(0.5, '#c8901e');
        zg.addColorStop(1, '#6a3c08');
        g.fillStyle = zg;
        g.fillRect(x0, zy, x1 - x0, zh);
        g.fillStyle = 'rgba(230,170,60,0.6)';
        const tw = sh * 0.16;
        g.beginPath();
        for (let x = x0 + tw * 0.5; x < x1 - tw * 0.5; x += tw * 1.5) {
          g.moveTo(x - tw * 0.5, zy + zh);
          g.lineTo(x, zy + zh + tw * 0.8);
          g.lineTo(x + tw * 0.5, zy + zh);
        }
        g.fill();
        // top surface
        g.beginPath();
        g.moveTo(xo, yk);
        g.lineTo(xi, yk);
        g.lineTo(xi + sk, yk - d);
        g.lineTo(xo, yk - d);
        g.closePath();
        const tg = g.createLinearGradient(0, yk - d, 0, yk);
        tg.addColorStop(0, '#3a1a0c');
        tg.addColorStop(1, '#7a4020');
        g.fillStyle = tg;
        g.fill();
        g.fillStyle = 'rgba(255,190,110,0.4)';
        g.fillRect(x0, yk - Math.max(1, sh * 0.015), x1 - x0, Math.max(1, sh * 0.03));
        // lamp positions
        const L = Math.abs(xi - xo) - u * 0.035;
        const n = Math.max(1, Math.floor(L / spacing));
        const gap = L / n;
        const pts: Pt[] = [];
        for (let i = 0; i < n; i++) pts.push({ x: xi + side * (gap * (i + 0.5) + u * 0.015), y: yk - d * 0.42 });
        // light pools on the riser below and the wall behind the top row
        for (const p of pts) {
          pool(g, p.x, yk + sh * 0.22, spacing * 0.6, sh * 0.62, '#ff8a30', 0.26);
          if (k === nT - 1) pool(g, p.x, yk - sh * 0.8, spacing * 1.1, sh * 1.6, '#ff7a2a', 0.13);
        }
        // garland swags hanging on the riser between the lamps
        const gp: Pt[] = [];
        const ga = xi;
        const gb = xo;
        const segs = n;
        for (let i = 0; i < segs; i++) {
          const a = { x: lerp(ga, gb, i / segs), y: zy + zh * 0.6 };
          const b = { x: lerp(ga, gb, (i + 1) / segs), y: zy + zh * 0.6 };
          const sp = sagPath(a, b, sh * 0.3, 8);
          if (i > 0) sp.shift();
          gp.push(...sp);
        }
        garland(g, r, gp, sh * 0.105);
        // tassel drops at the swag joins
        for (let i = 1; i < segs; i++) {
          const x = lerp(ga, gb, i / segs);
          genda(g, r, x, zy + zh + sh * 0.12, sh * 0.09, '#ffc23d');
          genda(g, r, x, zy + zh + sh * 0.3, sh * 0.075, '#e2412b');
        }
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const dir: 1 | -1 = side < 0 ? 1 : -1;
          // flower heads between the lamps
          if (i + 1 < pts.length) {
            const mx = (p.x + pts[i + 1].x) / 2;
            if (r() < 0.55) genda(g, r, mx, p.y + d * 0.15, dS * 0.2, r() < 0.5 ? '#ff8a00' : '#ffc23d', 0.8);
            else rose(g, r, mx, p.y + d * 0.15, dS * 0.18, '#b0102a', 0.75);
          }
          const s = dS * rand(r, 0.93, 1.05);
          const fp = clayDiya(g, p.x, p.y, s, {
            clay: CLAYS[(i + k) % CLAYS.length],
            band: BANDS[(i * 2 + k) % BANDS.length],
            dots: '#fff2d0',
            rim: i % 3 === 0 ? '#ffd560' : undefined,
            dir,
            shadow: 0.5,
          });
          flames.push({ x: fp.x, y: fp.y, h: s * 0.55, halo: 0.8 });
          if (k === 0) front.push({ x: fp.x, y: p.y });
        }
      }
    }

    function floor(g: Ctx, r: Rng) {
      const fg = g.createLinearGradient(0, Yw, 0, h);
      fg.addColorStop(0, '#3a160c');
      fg.addColorStop(0.3, '#200c07');
      fg.addColorStop(1, '#0e0403');
      g.fillStyle = fg;
      g.fillRect(0, Yw, w, h - Yw);
      // polished stone streaks
      for (let i = 0; i < 46; i++) {
        const x = rand(r, -0.1, 1.1) * w;
        const y = rand(r, Yw, h);
        wash(g, x, y, u * rand(r, 0.1, 0.3), u * rand(r, 0.006, 0.016), r() < 0.5 ? '#5a2a18' : '#050101', 0.35);
      }
      brushwork(g, r, -0.02 * w, Yw, 1.02 * w, h, 140, ['#5a2a18', '#0a0302', '#7a3a1c'], 0.16, u * 0.1, u * 0.01, 0, 0.25);
      g.fillStyle = 'rgba(170,100,45,0.4)';
      g.fillRect(0, Yw - Math.max(1, u * 0.003), w, Math.max(1, u * 0.005));
    }

    return {
      base(g) {
        const r = fork(rng);
        const rf = fork(rng);
        wall(g, r);
        // big out-of-focus lights in the dark upper wall, mostly at the sides
        const bk = ['#ffb347', '#ff8a2a', '#ffd27a', '#ff6a3a'];
        const bx = land ? 0.3 : 0.32;
        bokeh(g, r, -0.03 * w, 0.06 * h, w * bx, topStep, 16, bk, u * 0.025, u * 0.075, 0.2);
        bokeh(g, r, w * (1 - bx), 0.06 * h, w * 1.03, topStep, 16, bk, u * 0.025, u * 0.075, 0.2);
        bokeh(g, r, -0.03 * w, 0.1 * h, w * bx, topStep, 14, bk, u * 0.008, u * 0.022, 0.3);
        bokeh(g, r, w * (1 - bx), 0.1 * h, w * 1.03, topStep, 14, bk, u * 0.008, u * 0.022, 0.3);
        bokeh(g, r, w * 0.3, 0.0, w * 0.7, h * 0.12, 6, ['#ffb347', '#ff9a4a'], u * 0.015, u * 0.04, 0.1);
        arch(g, r);
        if (land) {
          niche(g, w * 0.215, h * 0.455, w * 0.058, h * 0.17, CLAYS[0]);
          niche(g, w * 0.785, h * 0.455, w * 0.058, h * 0.17, CLAYS[2]);
        } else {
          niche(g, w * 0.16, h * 0.53, w * 0.12, h * 0.1, CLAYS[0]);
          niche(g, w * 0.84, h * 0.53, w * 0.12, h * 0.1, CLAYS[2]);
        }
        floor(g, r);
        // warm reflection of the lamp rows on the polished floor
        for (const sx of [0, w]) pool(g, sx, Yf + (h - Yf) * 0.2, w * (land ? 0.38 : 0.42), (h - Yf) * 0.32, '#ff7a2a', 0.2);
        steps(g, rf, -1);
        steps(g, rf, 1);
        for (const e of front) pool(g, e.x, Yf + (Yf - e.y) * 1.4, dS * 0.3, dS * 1.7, '#ffa040', 0.32);
        // hanging brass lamps
        const hl = land
          ? [
              { x: w * 0.075, y: h * 0.3, s: u * 0.13 },
              { x: w * 0.925, y: h * 0.3, s: u * 0.13 },
            ]
          : [
              { x: w * 0.15, y: h * 0.27, s: u * 0.17 },
              { x: w * 0.85, y: h * 0.27, s: u * 0.17 },
            ];
        for (const l of hl) {
          glow(g, l.x, l.y, l.s * 3, '#ff8a2a', 0.2);
          for (const p of hangingLamp(g, l.x, -u * 0.02, l.y, l.s)) flames.push({ x: p.x, y: p.y, h: l.s * 0.2, halo: 0.75 });
        }
        // marigold swags across the top with drops ending in bells
        const anchors = land ? [-0.03, 0.33, 0.67, 1.03] : [-0.05, 0.5, 1.05];
        const ay = h * 0.012;
        for (let i = 0; i + 1 < anchors.length; i++) {
          const a = { x: anchors[i] * w, y: ay };
          const b = { x: anchors[i + 1] * w, y: ay };
          garland(g, rf, sagPath(a, b, h * (land ? 0.075 : 0.045), 30), u * 0.019);
        }
        for (let i = 1; i + 1 < anchors.length; i++) {
          const x = anchors[i] * w;
          for (let k = 0; k < 4; k++) genda(g, rf, x, ay + u * (0.03 + k * 0.029), u * 0.016, k % 2 ? '#ffc23d' : '#ff8a00');
          bell(g, x, ay + u * 0.165, u * 0.022);
        }
        // floor: petal rangoli at the feet, urli and the tall lamp
        const rc = land ? { x: w * 0.5, y: h * 0.895, R: w * 0.165 } : { x: w * 0.5, y: h * 0.885, R: w * 0.28 };
        pool(g, rc.x, rc.y, rc.R * 1.8, rc.R * 0.62, '#ff8a3a', 0.24);
        flames.push(...petalRangoli(g, rf, rc.x, rc.y, rc.R, { tilt: land ? 0.3 : 0.32, diyas: 10 }));
        scatterPetals(g, rf, w * 0.02, Yf + (h - Yf) * 0.3, w * 0.98, h, 44, u * 0.011, PETALS);
        const U = land ? { x: w * 0.135, y: h * 0.885, W: w * 0.18 } : { x: w * 0.17, y: h * 0.968, W: w * 0.31 };
        pool(g, U.x, U.y, U.W * 0.9, U.W * 0.32, '#ff9a3a', 0.25);
        flames.push(...urli(g, rf, U.x, U.y, U.W, { tilt: 0.38, diyas: 3, marigolds: 6, roses: 4, lotuses: 1, petals: 22 }));
        if (land) {
          const lamp = { x: w * 0.905, b: h * 0.965, H: h * 0.56 };
          backlit(0.5, () => {
            for (const p of kuthuVilakku(g, lamp.x, lamp.b, lamp.H)) flames.push({ x: p.x, y: p.y, h: lamp.H * 0.055, halo: 0.9 });
          });
        } else {
          pool(g, w * 0.82, h * 0.955, w * 0.25, h * 0.035, '#ff9a3a', 0.25);
          flames.push(...thali(g, rf, w * 0.82, h * 0.955, w * 0.3));
        }
        // warm haze and vignette
        wash(g, w * 0.5, h * 0.6, w * 0.7, h * 0.3, '#4a1a0a', 0.1);
        vignette(g, w, h, 0.5, '#060101');
      },
      lights(g) {
        const r = fork(rng);
        for (const f of flames) flame(g, r, f);
        // drifting embers above the lamps (kept off the centre column)
        for (let i = 0; i < 26; i++) {
          const src = flames[Math.floor(r() * flames.length)];
          const x = src.x + rand(r, -1, 1) * u * 0.05;
          const y = src.y - rand(r, 0.04, 0.22) * u;
          const s = u * rand(r, 0.003, 0.006);
          const col = mix('#ffd27a', '#ff8a2a', r());
          const a = rand(r, 0.35, 0.8);
          if (Math.abs(x - w / 2) > w * 0.16 || y > h * 0.86) sparkle(g, x, y, s * 2, col, a);
        }
      },
      painterly: { warmth: 0.25, saturation: 1.1, contrast: 1.06 },
    };
  },
};
