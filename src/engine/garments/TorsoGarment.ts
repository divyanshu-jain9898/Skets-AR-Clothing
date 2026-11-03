import { InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, type Material } from 'three';
import { Garment, SwaySystem, Smoothed, samplePath, sampleScalar, type GarmentContext } from './Garment';
import { GridMesh } from './GridMesh';
import { SectionTable, bump, layoutRows, writeTube, type SegmentSpec } from './helpers';
import { H, type BodyShape, type LimbPath } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import { Section } from '../body/Section';
import type { FabricSpec, TrimKind } from '../materials/FabricLibrary';
import { clamp, lerp, smoothstep, TAU } from '../core/math';

export type Neckline = 'round' | 'mandarin' | 'v' | 'sweetheart' | 'boat' | 'collar';

export interface TorsoParams {
  /** Height of the neckline at the sides and of the hem (BodyShape H units). */
  top: number;
  hem: number;
  /** Looseness in shoulder-widths. */
  ease: number;
  /** Extra half-width at the hem (A-line / anarkali flare). */
  flare: number;
  flareStart: number;
  waistFit: number;
  bust: number;
  neckline: Neckline;
  neckDepth: number;
  neckWidth: number;
  backDepth: number;
  collarHeight: number;
  /** 0 sleeveless, 0.2 cap, 0.4 short, 0.6 elbow, 0.8 three-quarter, 1 full. */
  sleeve: number;
  sleeveEase: number;
  sleeveFlare: number;
  sleevePuff: number;
  armhole: number;
  opening: 'none' | 'placket' | 'full';
  placketLen: number;
  buttons: number;
  buttonStyle: TrimKind;
  /** Height where side slits start (0 = none). */
  slits: number;
  pleats: number;
  pleatDepth: number;
  pleatStart: number;
  hemBorder: number;
  neckBorder: number;
  cuffBorder: number;
  waistBand: number;
  /** 0 = worn directly, 1 = worn over another top (jacket). */
  layer: number;
  hemCurve: number;
  sway: number;
}

export const TORSO_DEFAULTS: TorsoParams = {
  top: 0,
  hem: H.KNEE,
  ease: 0.07,
  flare: 0.08,
  flareStart: H.HIGHHIP,
  waistFit: 0,
  bust: 0,
  neckline: 'round',
  neckDepth: 0.16,
  neckWidth: 0.03,
  backDepth: 0.04,
  collarHeight: 0,
  sleeve: 1,
  sleeveEase: 0.05,
  sleeveFlare: 0,
  sleevePuff: 0,
  armhole: 0,
  opening: 'placket',
  placketLen: 0.85,
  buttons: 4,
  buttonStyle: 'gold',
  slits: 0,
  pleats: 0,
  pleatDepth: 0,
  pleatStart: H.WAIST,
  hemBorder: 0.1,
  neckBorder: 0,
  cuffBorder: 0.07,
  waistBand: 0,
  layer: 0,
  hemCurve: 0,
  sway: 0.6,
};

/** Sleeve length -> parameter along the arm path (0 inside torso, 1 shoulder, 2 elbow, 3 wrist). */
export function sleeveEndU(s: number) {
  if (s >= 0.99) return 3.0;
  if (s >= 0.6) return lerp(2.05, 3.0, (s - 0.6) / 0.4);
  return lerp(1.2, 2.05, clamp((s - 0.2) / 0.4, 0, 1));
}

const tmpSec = new Section();
const v0 = new Vector3();
const v1 = new Vector3();
const q = new Quaternion();
const m4 = new Matrix4();
const Z = new Vector3(0, 0, 1);
const sc = new Vector3();

interface SleeveState {
  grid: GridMesh;
  rowU: number[];
  endU: number;
  limb: 'L' | 'R';
}

/**
 * Parametric upper-body garment: kurta, sherwani, bandhgala, Nehru jacket,
 * kurti, anarkali, choli/blouse, kameez, pathani. Built as a lofted surface
 * over the body cross-sections plus tube sleeves, collar, placket and buttons.
 */
export class TorsoGarment extends Garment {
  readonly p: TorsoParams;
  private grid: GridMesh;
  private rowT: number[];
  private theta: Float32Array;
  private topH: Float32Array;
  private hemH: Float32Array;
  private table = new SectionTable(80);
  private sway: SwaySystem;
  private targets: Vector3[];
  private freedom: Float32Array;
  private twirl = new Smoothed(4);
  private sleeves: SleeveState[] = [];
  private collar: GridMesh | null = null;
  private collarRowH: number[] = [];
  private placket: GridMesh | null = null;
  private placketH: number[] = [];
  private buttons: InstancedMesh | null = null;
  private hMin: number;
  private hMax: number;

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<TorsoParams>) {
    super(ctx, fabric);
    const p = (this.p = { ...TORSO_DEFAULTS, ...params });
    const d = ctx.detail;
    const len = p.hem - p.top;
    const C = Math.max(40, Math.round((64 * d) / 4) * 4);
    const R = clamp(Math.round(len * 13 * d + 8), 14, 84);
    const segs: SegmentSpec[] = [];
    const hemHalf = 0.62 + p.flare + p.ease;
    const hemRepeat = Math.max(6, Math.round((TAU * hemHalf) / Math.max(0.3, p.hemBorder * 4)));
    const tN = p.neckBorder > 0 ? clamp(p.neckBorder / len, 0.02, 0.25) : 0;
    const tH = p.hemBorder > 0 ? clamp(p.hemBorder / len, 0.02, 0.3) : 0;
    let t = 0;
    if (tN > 0) {
      segs.push({ t0: 0, t1: tN, rows: 3, material: 1, uv: 'band', flipV: true, uRepeat: 8 });
      t = tN;
    }
    const bodyRows = (t0: number, t1: number) => Math.max(3, Math.round(R * (t1 - t0)));
    if (p.waistBand > 0) {
      const tw = clamp((p.pleatStart - p.top) / len, t + 0.05, 1 - tH - 0.05);
      const tw0 = tw - p.waistBand / len / 2;
      const tw1 = tw + p.waistBand / len / 2;
      segs.push({ t0: t, t1: tw0, rows: bodyRows(t, tw0), material: 0, uv: 'body' });
      segs.push({ t0: tw0, t1: tw1, rows: 3, material: 1, uv: 'band', uRepeat: 10 });
      t = tw1;
    }
    segs.push({ t0: t, t1: 1 - tH, rows: bodyRows(t, 1 - tH), material: 0, uv: 'body' });
    if (tH > 0) segs.push({ t0: 1 - tH, t1: 1, rows: 4, material: 1, uv: 'band', uRepeat: hemRepeat });
    const { rowT, bands } = layoutRows(segs);
    this.rowT = rowT;
    const rows = rowT.length;

    // side slits: open two quads at each side below the slit height
    const slitT = p.slits > 0 ? (p.slits - p.top) / len : 2;
    const q1 = C / 4;
    const q3 = (3 * C) / 4;
    const skip = (r: number, j: number) => rowT[r] >= slitT - 1e-4 && (j === q1 - 1 || j === q1 || j === q3 - 1 || j === q3);
    this.grid = new GridMesh(rows, C, true, bands, 6, len / 0.58, p.slits > 0 ? skip : undefined);
    const mats: Material[] = [ctx.lib.body(fabric), ctx.lib.border(fabric)];
    this.mesh(this.grid.geometry, mats);

    // per-column neckline and hem heights
    this.theta = new Float32Array(C);
    this.topH = new Float32Array(C);
    this.hemH = new Float32Array(C);
    for (let j = 0; j < C; j++) {
      const th = (j / C) * TAU;
      this.theta[j] = th;
      const cf = Math.max(0, Math.cos(th));
      const cb = Math.max(0, -Math.cos(th));
      const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
      let drop = 0;
      switch (p.neckline) {
        case 'v':
          drop = p.neckDepth * Math.pow(Math.max(0, 1 - a / 0.8), 1.15);
          break;
        case 'sweetheart':
          drop = p.neckDepth * Math.pow(cf, 1.6) * (1 - 0.3 * bump(a, 0, 0.16));
          break;
        case 'boat':
          drop = p.neckDepth * Math.pow(cf, 0.7);
          break;
        case 'mandarin':
        case 'collar':
          drop = 0.03 * cf * cf;
          break;
        default:
          drop = p.neckDepth * Math.pow(cf, 2.2);
      }
      drop += p.backDepth * Math.pow(cb, 2);
      this.topH[j] = p.top + drop;
      this.hemH[j] = p.hem - p.hemCurve * Math.pow(Math.abs(Math.sin(th)), 2);
    }
    this.hMin = p.top - 0.05;
    this.hMax = p.hem + 0.05;

    // physics for the lower body
    this.sway = new SwaySystem(rows);
    this.targets = Array.from({ length: rows }, () => new Vector3());
    this.freedom = new Float32Array(rows);

    // sleeves
    if (p.sleeve > 0.05) {
      const endU = sleeveEndU(p.sleeve);
      const sr = Math.max(8, Math.round(17 * d));
      const scn = Math.max(14, Math.round((24 * d) / 2) * 2);
      const cuffU = p.cuffBorder > 0 ? Math.min(0.35, p.cuffBorder / 0.85) : 0;
      for (const limb of ['L', 'R'] as const) {
        const sseg: SegmentSpec[] = [{ t0: 0, t1: endU - cuffU, rows: sr, material: 0, uv: 'body' }];
        if (cuffU > 0) sseg.push({ t0: endU - cuffU, t1: endU, rows: 3, material: 1, uv: 'band', uRepeat: 3 });
        const lay = layoutRows(sseg);
        const grid = new GridMesh(lay.rowT.length, scn, true, lay.bands, 3, endU * 0.9);
        this.mesh(grid.geometry, mats);
        this.sleeves.push({ grid, rowU: lay.rowT, endU, limb });
      }
    }

    // mandarin collar
    if (p.collarHeight > 0) {
      const ch = p.collarHeight;
      this.collarRowH = [-ch, -ch * 0.5, 0.035];
      const cgap = (r: number, j: number) => {
        void r;
        const th = ((j + 0.5) / C) * TAU;
        const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
        return a < 0.13;
      };
      this.collar = new GridMesh(3, C, true, [{ r0: 0, r1: 2, material: 1, uv: 'band', uRepeat: 6, flipV: true }], 6, 1, cgap);
      this.mesh(this.collar.geometry, mats);
    }

    // placket + buttons
    if (p.opening !== 'none') {
      const end = p.opening === 'full' ? p.hem : p.top + p.placketLen;
      const pr = Math.max(6, Math.round((end - p.top) * 9));
      this.placketH = Array.from({ length: pr }, (_, i) => lerp(this.topH[0], end, i / (pr - 1)));
      const lenSw = end - this.topH[0];
      this.placket = new GridMesh(pr, 3, false, [{ r0: 0, r1: pr - 1, material: 1, uv: 'band', swap: true, uRepeat: Math.max(1, lenSw / 0.45) }], 1, 1);
      this.mesh(this.placket.geometry, mats);
      if (p.buttons > 0) {
        const geo = new SphereGeometry(1, 12, 8);
        this.buttons = new InstancedMesh(geo, ctx.lib.trim(p.buttonStyle), p.buttons);
        this.add(this.buttons);
      }
    }
  }

  /** Sway offset interpolated at garment height h. */
  private swayAt(h: number, out: Vector3) {
    const p = this.p;
    const t = (h - p.top) / (p.hem - p.top);
    const rt = this.rowT;
    if (t <= rt[0]) return out.copy(this.sway.offset[0]);
    for (let i = 1; i < rt.length; i++) {
      if (t <= rt[i]) {
        const f = (t - rt[i - 1]) / Math.max(1e-6, rt[i] - rt[i - 1]);
        return out.lerpVectors(this.sway.offset[i - 1], this.sway.offset[i], f);
      }
    }
    return out.copy(this.sway.offset[rt.length - 1]);
  }

  /** Garment surface point at (theta, h) with extra outward growth. */
  private surface(theta: number, h: number, extra: number, sw: number, twirl: number, yawLag: number, out: Vector3) {
    const p = this.p;
    const s = this.table.sample(h, tmpSec);
    const e = p.ease * sw;
    const neckBlend = 1 - smoothstep(0.0, 0.22, h);
    let g = lerp(e, (p.neckWidth + 0.012) * sw, neckBlend);
    g -= p.waistFit * e * 0.65 * bump(h, H.WAIST, 0.32);
    g += p.layer * 0.04 * sw + extra;
    const fl = p.flare > 0 ? p.flare * sw * Math.pow(smoothstep(p.flareStart, p.hem, h), 1.3) : 0;
    const tw = twirl * sw * Math.pow(smoothstep(p.flareStart, p.hem, h), 1.6);
    const armCut = p.armhole * 0.08 * sw * bump(h, 0.3, 0.28);
    const sn = Math.sin(theta);
    const cs = Math.cos(theta);
    const ex = 2 / s.n;
    let x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (s.a + g + fl + tw - armCut);
    let z = Math.sign(cs) * Math.pow(Math.abs(cs), ex) * ((cs >= 0 ? s.bF : s.bB) + g + fl * 0.85 + tw);
    if (p.pleats > 0 && h > p.pleatStart) {
      const ramp = smoothstep(p.pleatStart, p.pleatStart + 0.45, h) * (0.45 + 0.55 * smoothstep(p.pleatStart, p.hem, h));
      const amp = p.pleatDepth * sw * ramp * (1 + twirl * 0.02);
      const l = Math.hypot(x, z) || 1;
      const w = Math.sin(p.pleats * (theta + yawLag * 0.6));
      x += (x / l) * amp * w;
      z += (z / l) * amp * w;
    }
    out.copy(s.c).addScaledVector(s.side, x).addScaledVector(s.fwd, z);
    return out;
  }

  reset() {
    this.sway.reset();
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    const p = this.p;
    const sw = shape.sw;
    this.table.build(shape, this.hMin, this.hMax, H.HIP + 0.1);
    const rows = this.rowT.length;
    for (let i = 0; i < rows; i++) {
      const h = lerp(p.top, p.hem, this.rowT[i]);
      this.table.sample(h, tmpSec);
      this.targets[i].copy(tmpSec.c);
      this.freedom[i] = smoothstep(H.HIP - 0.2, Math.max(p.hem, H.HIP + 0.5), h);
    }
    this.sway.update(this.targets, this.freedom, rig.yaw, dt, 0.32 * sw, p.sway);
    const flareLike = p.pleats > 0 || p.flare > 0.25;
    const twirl = this.twirl.update(flareLike ? clamp(Math.abs(rig.yawRate) - 1.0, 0, 7) * 0.075 : 0, dt);

    const g = this.grid;
    const C = g.cols;
    for (let i = 0; i < rows; i++) {
      const ti = this.rowT[i];
      const off = this.sway.offset[i];
      const lag = this.sway.yawLag[i];
      for (let j = 0; j < C; j++) {
        const h = lerp(this.topH[j], this.hemH[j], ti);
        this.surface(this.theta[j], h, 0, sw, twirl, lag, v0).add(off);
        g.set(i, j, v0);
      }
    }
    g.computeNormals();
    g.commit();

    // sleeves follow the arms
    for (const s of this.sleeves) this.updateSleeve(s, s.limb === 'L' ? shape.armL : shape.armR, rig, sw);

    // collar
    if (this.collar) {
      const c = this.collar;
      for (let i = 0; i < 3; i++) {
        const h = this.collarRowH[i];
        const taper = i === 0 ? -0.018 * sw : 0;
        for (let j = 0; j < C; j++) {
          this.surface(this.theta[j], h, taper + 0.006 * sw, sw, 0, 0, v0);
          c.set(i, j, v0);
        }
      }
      c.computeNormals();
      c.commit();
    }

    // placket strip down the centre front
    if (this.placket) {
      const pl = this.placket;
      const half = 0.05 * sw;
      for (let i = 0; i < pl.rows; i++) {
        const h = this.placketH[i];
        const s = this.table.sample(h, tmpSec);
        const dth = half / Math.max(1, s.a);
        this.swayAt(h, v1);
        for (let j = 0; j < 3; j++) {
          this.surface((j - 1) * dth, h, 0.009 * sw, sw, twirl, 0, v0).add(v1);
          pl.set(i, j, v0);
        }
      }
      pl.computeNormals();
      pl.commit();
      if (this.buttons) {
        const nb = this.buttons.count;
        const h0 = this.topH[0] + 0.06;
        const h1 = p.opening === 'full' ? Math.min(p.hem - 0.2, H.HIP + 0.1) : this.placketH[this.placketH.length - 1] - 0.05;
        const r = 0.024 * sw;
        for (let k = 0; k < nb; k++) {
          const h = lerp(h0, h1, nb === 1 ? 0.5 : k / (nb - 1));
          this.swayAt(h, v1);
          this.surface(0, h, 0.02 * sw, sw, twirl, 0, v0).add(v1);
          // normal ~ body forward at that height
          const s = this.table.sample(h, tmpSec);
          q.setFromUnitVectors(Z, s.fwd);
          sc.set(r, r, r * 0.6);
          m4.compose(v0, q, sc);
          this.buttons.setMatrixAt(k, m4);
        }
        this.buttons.instanceMatrix.needsUpdate = true;
      }
    }

    shape.registerLayer(p.top, Math.min(p.hem, H.HIP), (p.ease + p.layer * 0.04) * sw);
    if (p.hem > H.HIP) shape.registerLayer(H.HIP, p.hem, (p.ease + p.flare * 0.6) * sw);
  }

  private updateSleeve(s: SleeveState, L: LimbPath, rig: BodyRig, sw: number) {
    const p = this.p;
    const pts = L.pts;
    const ease = p.sleeveEase * sw + p.layer * 0.03 * sw;
    const endU = s.endU;
    const r = L.r;
    writeTube(
      s.grid,
      s.rowU,
      (u, out) => samplePath(pts, u, out),
      (u) => {
        let rad = sampleScalar(r, u) + ease;
        if (p.sleevePuff > 0) rad += p.sleevePuff * sw * bump(u, 1.05, 0.38);
        if (p.sleeveFlare > 0) rad += p.sleeveFlare * sw * Math.pow(smoothstep(endU - 1.25, endU, u), 1.5);
        // keep the opening a little wider than the wrist so the hand is free
        return rad;
      },
      rig.fwd,
    );
  }
}
