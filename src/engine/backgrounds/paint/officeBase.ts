import { ellipse, lerp, mix, rand, rgba, wash, type Ctx, type Pt, type Rng } from './kit';

/**
 * A modern office interior in daylight, painted from scratch. It is the
 * stand-in for "My Office" until a real photo is provided, and goes through
 * the same Diwali conversion as a photo would (windows become a night sky).
 *
 * One-point perspective: room coordinates X (0 left wall .. 1 right wall),
 * Y (0 floor .. 1 ceiling) and Z (0 back wall .. 1 front of the picture).
 */
export function drawOfficeBase(g: Ctx, w: number, h: number, rng: Rng) {
  const portrait = h > w;
  const bl = w * (portrait ? 0.12 : 0.2);
  const br = w - bl;
  const bt = h * (portrait ? 0.25 : 0.17);
  const bb = h * (portrait ? 0.6 : 0.63);
  const P = (X: number, Y: number, Z: number): Pt => {
    const left = lerp(bl, -w * 0.02, Z);
    const right = lerp(br, w * 1.02, Z);
    const top = lerp(bt, -h * 0.02, Z);
    const bottom = lerp(bb, h * 1.02, Z);
    return { x: lerp(left, right, X), y: lerp(bottom, top, Y) };
  };
  const unit = (Z: number) => lerp(bb - bt, h * 1.04, Z);
  const quad = (pts: Pt[], fill: string | CanvasGradient) => {
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };

  // ------------------------------------------------------------- shell
  // ceiling
  const cg = g.createLinearGradient(0, 0, 0, bt);
  cg.addColorStop(0, '#c9c4bc');
  cg.addColorStop(1, '#ece8e1');
  quad([P(0, 1, 1), P(1, 1, 1), P(1, 1, 0), P(0, 1, 0)], cg);
  // recessed linear lights converging to the back
  for (const X of [0.22, 0.5, 0.78]) {
    for (let z = 0.08; z < 0.95; z += 0.17) {
      quad([P(X - 0.03, 1, z), P(X + 0.03, 1, z), P(X + 0.03, 1, z + 0.1), P(X - 0.03, 1, z + 0.1)], '#fbfaf6');
    }
  }
  // left wall (warm plaster) and right wall (wood slats)
  const lw = g.createLinearGradient(0, 0, bl, 0);
  lw.addColorStop(0, '#b9ada0');
  lw.addColorStop(1, '#ddd4c8');
  quad([P(0, 1, 1), P(0, 1, 0), P(0, 0, 0), P(0, 0, 1)], lw);
  const rw = g.createLinearGradient(br, 0, w, 0);
  rw.addColorStop(0, '#a77a52');
  rw.addColorStop(1, '#7b5232');
  quad([P(1, 1, 0), P(1, 1, 1), P(1, 0, 1), P(1, 0, 0)], rw);
  g.strokeStyle = rgba('#4a2e18', 0.45);
  for (let i = 0; i < 26; i++) {
    const Z = i / 26;
    const a = P(1, 1, Z);
    const b = P(1, 0, Z);
    g.lineWidth = Math.max(1, unit(Z) * 0.006);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  // floor: warm oak planks converging to the vanishing point
  const fg = g.createLinearGradient(0, bb, 0, h);
  fg.addColorStop(0, '#b48a62');
  fg.addColorStop(1, '#8a603c');
  quad([P(0, 0, 0), P(1, 0, 0), P(1, 0, 1), P(0, 0, 1)], fg);
  g.strokeStyle = rgba('#5a3a20', 0.35);
  for (let i = 1; i < 18; i++) {
    const a = P(i / 18, 0, 0);
    const b = P(i / 18, 0, 1);
    g.lineWidth = Math.max(1, h * 0.0015);
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  // window reflections on the polished floor
  for (const X of [0.18, 0.42, 0.66, 0.88]) quad([P(X - 0.06, 0, 0), P(X + 0.06, 0, 0), P(X + 0.11, 0, 0.55), P(X - 0.01, 0, 0.55)], rgba('#fff4e0', 0.12));

  // ------------------------------------------------------------- window wall
  const wl = P(0, 0.06, 0);
  const wr = P(1, 1, 0);
  const winTop = wr.y;
  const winBot = wl.y;
  const sky = g.createLinearGradient(0, winTop, 0, winBot);
  sky.addColorStop(0, '#e4effa');
  sky.addColorStop(0.7, '#eef5fb');
  sky.addColorStop(1, '#f6f6f2');
  g.fillStyle = sky;
  g.fillRect(bl, winTop, br - bl, winBot - winTop);
  // distant city in soft daylight haze
  const cityBase = winBot;
  let x = bl;
  while (x < br) {
    const bw = (br - bl) * rand(rng, 0.04, 0.09);
    const bh = (winBot - winTop) * rand(rng, 0.12, 0.38);
    g.fillStyle = mix('#b7c6d6', '#d9e2ea', rand(rng, 0, 0.6));
    g.fillRect(x, cityBase - bh, bw + 1, bh);
    g.fillStyle = rgba('#eef3f8', 0.6);
    for (let wy = cityBase - bh + bh * 0.1; wy < cityBase - 2; wy += bh * 0.12) g.fillRect(x + bw * 0.12, wy, bw * 0.76, Math.max(1, bh * 0.03));
    x += bw;
  }
  // tree tops just outside
  for (let i = 0; i < 9; i++) ellipse(g, rand(rng, bl, br), winBot - (winBot - winTop) * 0.04, (br - bl) * rand(rng, 0.03, 0.06), (winBot - winTop) * rand(rng, 0.05, 0.09), mix('#7ea26a', '#a6c18c', rng()));
  // frame and mullions
  const frame = '#33363b';
  const mw = Math.max(2, w * 0.006);
  g.fillStyle = frame;
  for (let i = 0; i <= 4; i++) {
    const mx = lerp(bl, br, i / 4);
    g.fillRect(mx - mw / 2, winTop, mw, winBot - winTop);
  }
  g.fillRect(bl, winTop + (winBot - winTop) * 0.14, br - bl, mw * 0.7);
  g.fillRect(bl, winTop, br - bl, mw);
  // sill and low wall under the windows
  quad([P(0, 0.06, 0), P(1, 0.06, 0), P(1, 0, 0), P(0, 0, 0)], '#d7d1c8');

  // ------------------------------------------------------------- furniture
  // low credenza along the window with plants (kept low behind the person)
  const credenza = (X0: number, X1: number) => {
    quad([P(X0, 0.14, 0.03), P(X1, 0.14, 0.03), P(X1, 0.14, 0.09), P(X0, 0.14, 0.09)], '#efe9e0');
    quad([P(X0, 0.14, 0.09), P(X1, 0.14, 0.09), P(X1, 0.01, 0.09), P(X0, 0.01, 0.09)], '#6d5340');
    for (let i = 1; i < 4; i++) {
      const a = P(lerp(X0, X1, i / 4), 0.13, 0.09);
      const b = P(lerp(X0, X1, i / 4), 0.02, 0.09);
      g.strokeStyle = rgba('#3b2a1e', 0.6);
      g.lineWidth = Math.max(1, unit(0.09) * 0.004);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
    }
  };
  credenza(0.26, 0.74);
  plant(g, rng, P(0.3, 0.14, 0.06), unit(0.06) * 0.18, 'small');
  plant(g, rng, P(0.7, 0.14, 0.06), unit(0.06) * 0.18, 'small');

  // desks with monitors and chairs, two clusters at the sides, aisle in the middle
  const desk = (X0: number, X1: number, Z0: number, Z1: number) => {
    const top = 0.26;
    // shadow
    quad([P(X0, 0, Z0), P(X1, 0, Z0), P(X1, 0, Z1), P(X0, 0, Z1)], rgba('#3a2412', 0.25));
    // panel legs at both ends
    for (const X of [X0 + 0.012, X1 - 0.012]) quad([P(X - 0.006, top, Z0 + 0.01), P(X + 0.006, top, Z1 - 0.01), P(X + 0.006, 0, Z1 - 0.01), P(X - 0.006, 0, Z0 + 0.01)], '#9b958d');
    const tg = g.createLinearGradient(0, P(X0, top, Z0).y, 0, P(X0, top, Z1).y);
    tg.addColorStop(0, '#e9e4dc');
    tg.addColorStop(1, '#f6f2ec');
    quad([P(X0, top, Z0), P(X1, top, Z0), P(X1, top, Z1), P(X0, top, Z1)], tg);
    quad([P(X0, top, Z1), P(X1, top, Z1), P(X1, top - 0.025, Z1), P(X0, top - 0.025, Z1)], '#bdb5aa');
  };
  const monitor = (X: number, Z: number, hue: number) => {
    const s = 0.034;
    const a = P(X - s, 0.3, Z);
    const b = P(X + s, 0.4, Z);
    const st = P(X, 0.26, Z);
    const p = (b.x - a.x) * 0.05;
    g.fillStyle = '#2a2d31';
    g.fillRect(st.x - p * 0.5, a.y, p, st.y - a.y);
    g.fillRect(st.x - p * 2.5, st.y - p * 0.6, p * 5, p * 0.6);
    g.fillStyle = '#1c1f23';
    g.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
    const sc = g.createLinearGradient(a.x, b.y, b.x, a.y);
    sc.addColorStop(0, `hsl(${hue}, 45%, 62%)`);
    sc.addColorStop(1, `hsl(${hue + 30}, 40%, 38%)`);
    g.fillStyle = sc;
    g.fillRect(a.x + p, b.y + p, b.x - a.x - 2 * p, a.y - b.y - 2 * p);
    g.fillStyle = rgba('#ffffff', 0.35);
    for (let k = 0; k < 3; k++) g.fillRect(a.x + p * 3, b.y + p * (3 + k * 3.2), (b.x - a.x) * (0.5 - k * 0.1), p * 1.2);
  };
  const chair = (X: number, Z: number) => {
    const u = unit(Z);
    const seat = P(X, 0.15, Z);
    const floorY = P(X, 0, Z).y;
    ellipse(g, seat.x, floorY, u * 0.055, u * 0.012, rgba('#1a0f08', 0.3));
    // five-star base and gas lift
    g.strokeStyle = '#25282d';
    g.lineWidth = Math.max(1.2, u * 0.006);
    g.beginPath();
    g.moveTo(seat.x, seat.y);
    g.lineTo(seat.x, floorY - u * 0.012);
    g.moveTo(seat.x - u * 0.045, floorY);
    g.lineTo(seat.x, floorY - u * 0.014);
    g.lineTo(seat.x + u * 0.045, floorY);
    g.stroke();
    ellipse(g, seat.x, seat.y, u * 0.045, u * 0.013, '#3a3e45');
    // mesh back
    const bw = u * 0.075;
    const bh = u * 0.12;
    g.beginPath();
    g.roundRect(seat.x - bw / 2, seat.y - bh - u * 0.02, bw, bh, u * 0.02);
    g.fillStyle = '#30343a';
    g.fill();
    g.beginPath();
    g.roundRect(seat.x - bw / 2 + u * 0.006, seat.y - bh - u * 0.014, bw - u * 0.012, bh - u * 0.012, u * 0.016);
    g.fillStyle = '#4a5059';
    g.fill();
  };
  for (const side of [0, 1]) {
    const X0 = side ? 0.66 : 0.06;
    const X1 = side ? 0.94 : 0.34;
    for (const [Z0, Z1] of [
      [0.16, 0.27],
      [0.42, 0.56],
    ]) {
      desk(X0, X1, Z0, Z1);
      const n = Z0 < 0.3 ? 3 : 2;
      for (let i = 0; i < n; i++) monitor(lerp(X0 + 0.05, X1 - 0.05, i / (n - 1)), Z0 + 0.03, 200 + i * 40 + side * 20);
      for (let i = 0; i < n; i++) chair(lerp(X0 + 0.06, X1 - 0.06, i / (n - 1)), Z1 + 0.03);
    }
  }
  // framed abstract artwork on the left wall
  const art = [P(0, 0.75, 0.18), P(0, 0.75, 0.42), P(0, 0.4, 0.42), P(0, 0.4, 0.18)];
  quad(art, '#2a2a2a');
  const inset = [P(0, 0.72, 0.2), P(0, 0.72, 0.4), P(0, 0.43, 0.4), P(0, 0.43, 0.2)];
  const ag = g.createLinearGradient(inset[0].x, inset[0].y, inset[2].x, inset[2].y);
  ag.addColorStop(0, '#e07a3f');
  ag.addColorStop(0.5, '#e9c46a');
  ag.addColorStop(1, '#2a9d8f');
  quad(inset, ag);
  // tall plants near the front corners
  plant(g, rng, P(0.03, 0, 0.82), unit(0.82) * 0.55, 'tall');
  plant(g, rng, P(0.97, 0, 0.78), unit(0.78) * 0.5, 'tall');
  // pendant lamps over the desks
  for (const X of [0.2, 0.8]) {
    for (const Z of [0.22, 0.5]) {
      const top = P(X, 1, Z);
      const lamp = P(X, 0.72, Z);
      const u = unit(Z);
      g.strokeStyle = '#2a2a2a';
      g.lineWidth = Math.max(1, u * 0.003);
      g.beginPath();
      g.moveTo(top.x, top.y);
      g.lineTo(lamp.x, lamp.y);
      g.stroke();
      g.beginPath();
      g.moveTo(lamp.x - u * 0.045, lamp.y + u * 0.05);
      g.lineTo(lamp.x - u * 0.012, lamp.y);
      g.lineTo(lamp.x + u * 0.012, lamp.y);
      g.lineTo(lamp.x + u * 0.045, lamp.y + u * 0.05);
      g.closePath();
      g.fillStyle = '#2b2e33';
      g.fill();
      ellipse(g, lamp.x, lamp.y + u * 0.05, u * 0.04, u * 0.008, '#fff3d6');
      wash(g, lamp.x, P(X, 0.27, Z).y, u * 0.16, u * 0.04, '#fff3dc', 0.35);
    }
  }
}

function plant(g: Ctx, rng: Rng, base: Pt, size: number, kind: 'small' | 'tall') {
  const potH = size * (kind === 'tall' ? 0.22 : 0.35);
  const potW = size * (kind === 'tall' ? 0.28 : 0.4);
  ellipse(g, base.x, base.y, potW * 0.8, potW * 0.15, rgba('#1a0f08', 0.35));
  g.beginPath();
  g.moveTo(base.x - potW / 2, base.y - potH);
  g.lineTo(base.x + potW / 2, base.y - potH);
  g.lineTo(base.x + potW * 0.38, base.y);
  g.lineTo(base.x - potW * 0.38, base.y);
  g.closePath();
  const pg = g.createLinearGradient(base.x - potW / 2, 0, base.x + potW / 2, 0);
  pg.addColorStop(0, '#9a9289');
  pg.addColorStop(0.45, '#e8e2d8');
  pg.addColorStop(1, '#8d857c');
  g.fillStyle = pg;
  g.fill();
  const cx = base.x;
  const cy = base.y - potH - size * (kind === 'tall' ? 0.42 : 0.3);
  const R = size * (kind === 'tall' ? 0.42 : 0.38);
  const n = kind === 'tall' ? 26 : 14;
  if (kind === 'tall') {
    g.strokeStyle = '#4a3b22';
    g.lineWidth = Math.max(1, size * 0.02);
    g.beginPath();
    g.moveTo(cx, base.y - potH);
    g.lineTo(cx + size * 0.03, cy + R * 0.4);
    g.stroke();
  }
  for (let i = 0; i < n; i++) {
    const a = rand(rng, 0, Math.PI * 2);
    const d = R * Math.sqrt(rng());
    const lx = cx + Math.cos(a) * d;
    const ly = cy + Math.sin(a) * d * 0.9;
    const ll = R * rand(rng, 0.35, 0.55);
    g.save();
    g.translate(lx, ly);
    g.rotate(a + rand(rng, -0.6, 0.6));
    g.beginPath();
    g.ellipse(0, 0, ll, ll * 0.42, 0, 0, Math.PI * 2);
    g.fillStyle = mix('#2f6b34', '#78a85a', rng() * 0.8);
    g.fill();
    g.restore();
  }
}
