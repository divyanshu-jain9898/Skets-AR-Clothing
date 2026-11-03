import { Vector3, type Material } from 'three';
import { Garment, Smoothed, SwaySystem, type GarmentContext } from './Garment';
import { GridMesh } from './GridMesh';
import { SectionTable, bump, layoutRows, wrapAngle, type SegmentSpec } from './helpers';
import { H, type BodyShape } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import { Section } from '../body/Section';
import type { FabricSpec } from '../materials/FabricLibrary';
import { clamp, lerp, smoothstep, TAU } from '../core/math';

export interface SkirtParams {
  top: number;
  hem: number;
  ease: number;
  flare: number;
  pleats: number;
  pleatDepth: number;
  /** Saree-style deep pleats gathered at the centre front. */
  frontPleats: number;
  frontPleatDepth: number;
  waistBand: number;
  hemBorder: number;
  /** Second decorative band (lehenga), height in sw; 0 = none. */
  midBorder: number;
  sway: number;
  /** Veshti / mundu: vertical border along the wrap edge at this angle (0 = none). */
  wrapEdge: number;
}

export const SKIRT_DEFAULTS: SkirtParams = {
  top: H.WAIST + 0.12,
  hem: H.FLOOR,
  ease: 0.05,
  flare: 0.75,
  pleats: 18,
  pleatDepth: 0.05,
  frontPleats: 0,
  frontPleatDepth: 0,
  waistBand: 0.07,
  hemBorder: 0.22,
  midBorder: 0,
  sway: 1,
  wrapEdge: 0,
};

const sec = new Section();
const v0 = new Vector3();
const v1 = new Vector3();

/** Lehenga / ghagra, saree under-skirt with front pleats, veshti / mundu. */
export class SkirtGarment extends Garment {
  readonly p: SkirtParams;
  private grid: GridMesh;
  private rowT: number[];
  private table = new SectionTable(72);
  private sway: SwaySystem;
  private targets: Vector3[];
  private freedom: Float32Array;
  private twirl = new Smoothed(3.5);
  private edge: GridMesh | null = null;
  private edgeT: number[] = [];

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<SkirtParams>) {
    super(ctx, fabric);
    const p = (this.p = { ...SKIRT_DEFAULTS, ...params });
    const d = ctx.detail;
    const len = p.hem - p.top;
    const C = Math.max(56, Math.round((p.pleats > 20 || p.frontPleats > 0 ? 96 : 72) * d / 4) * 4);
    const R = clamp(Math.round(len * 12 * d + 10), 16, 72);
    const segs: SegmentSpec[] = [];
    const hemRepeat = Math.max(8, Math.round((TAU * (0.65 + p.flare)) / Math.max(0.35, p.hemBorder * 3.6)));
    let t = 0;
    const rowsFor = (a: number, b: number) => Math.max(3, Math.round(R * (b - a)));
    if (p.waistBand > 0) {
      const tw = clamp(p.waistBand / len, 0.01, 0.1);
      segs.push({ t0: 0, t1: tw, rows: 3, material: 1, uv: 'band', flipV: true, uRepeat: 10 });
      t = tw;
    }
    const tH = p.hemBorder > 0 ? clamp(p.hemBorder / len, 0.02, 0.3) : 0;
    if (p.midBorder > 0) {
      const tm1 = 1 - tH - 0.18;
      const tm0 = tm1 - clamp(p.midBorder / len, 0.02, 0.15);
      segs.push({ t0: t, t1: tm0, rows: rowsFor(t, tm0), material: 0, uv: 'body' });
      segs.push({ t0: tm0, t1: tm1, rows: 3, material: 1, uv: 'band', uRepeat: Math.round(hemRepeat * 0.85) });
      t = tm1;
    }
    segs.push({ t0: t, t1: 1 - tH, rows: rowsFor(t, 1 - tH), material: 0, uv: 'body' });
    if (tH > 0) segs.push({ t0: 1 - tH, t1: 1, rows: 4, material: 1, uv: 'band', uRepeat: hemRepeat });
    const lay = layoutRows(segs);
    this.rowT = lay.rowT;
    const rows = this.rowT.length;
    this.grid = new GridMesh(rows, C, true, lay.bands, 10, len / 0.5);
    const mats: Material[] = [ctx.lib.body(fabric), ctx.lib.border(fabric)];
    this.mesh(this.grid.geometry, mats);
    this.sway = new SwaySystem(rows);
    this.targets = Array.from({ length: rows }, () => new Vector3());
    this.freedom = new Float32Array(rows);

    if (p.wrapEdge !== 0) {
      const er = Math.max(10, Math.round(len * 8));
      this.edgeT = Array.from({ length: er }, (_, i) => i / (er - 1));
      this.edge = new GridMesh(er, 3, false, [{ r0: 0, r1: er - 1, material: 1, uv: 'band', swap: true, flipV: true, uRepeat: Math.max(2, len / 0.45) }], 1, 1);
      this.mesh(this.edge.geometry, mats);
    }
  }

  reset() {
    this.sway.reset();
  }

  private point(theta: number, h: number, i: number, sw: number, twirl: number, extra: number, out: Vector3) {
    const p = this.p;
    const s = this.table.sample(h, sec);
    const f = smoothstep(p.top, p.hem, h);
    const lag = this.sway.yawLag[i];
    const fl = p.flare * sw * Math.pow(f, 1.25) + twirl * sw * f * f;
    const g = p.ease * sw + extra;
    const sn = Math.sin(theta);
    const cs = Math.cos(theta);
    const ex = 2 / s.n;
    let x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (s.a + g + fl);
    let z = Math.sign(cs) * Math.pow(Math.abs(cs), ex) * ((cs >= 0 ? s.bF : s.bB) + g + fl * 0.92);
    const l = Math.hypot(x, z) || 1;
    let disp = 0;
    if (p.pleats > 0) {
      const ramp = smoothstep(0, 0.35, f) * (0.35 + 0.65 * f);
      disp += p.pleatDepth * sw * ramp * Math.sin(p.pleats * (theta + lag * 0.7));
    }
    if (p.frontPleats > 0) {
      const a = wrapAngle(theta);
      const win = bump(a, 0.05, 0.42);
      const ramp = 0.25 + 0.75 * smoothstep(0, 0.45, f);
      // deep accordion folds: sharpened sine
      const sv = Math.sin(a * p.frontPleats * 5 + lag * 2);
      disp += p.frontPleatDepth * sw * ramp * win * Math.sign(sv) * Math.pow(Math.abs(sv), 0.6);
    }
    x += (x / l) * disp;
    z += (z / l) * disp;
    out.copy(s.c).addScaledVector(s.side, x).addScaledVector(s.fwd, z).add(this.sway.offset[i]);
    return out;
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    const p = this.p;
    const sw = shape.sw;
    this.table.build(shape, p.top - 0.05, p.hem + 0.05, H.HIP + 0.1);
    const rows = this.rowT.length;
    for (let i = 0; i < rows; i++) {
      const h = lerp(p.top, p.hem, this.rowT[i]);
      this.table.sample(h, sec);
      this.targets[i].copy(sec.c);
      this.freedom[i] = Math.pow(smoothstep(p.top + 0.15, p.hem, h), 0.9);
    }
    this.sway.update(this.targets, this.freedom, rig.yaw, dt, 0.4 * sw, p.sway);
    const twirl = this.twirl.update(clamp(Math.abs(rig.yawRate) - 1.0, 0, 7) * (0.05 + p.flare * 0.07), dt);
    const g = this.grid;
    const C = g.cols;
    for (let i = 0; i < rows; i++) {
      const h = lerp(p.top, p.hem, this.rowT[i]);
      for (let j = 0; j < C; j++) {
        this.point((j / C) * TAU, h, i, sw, twirl, 0, v0);
        g.set(i, j, v0);
      }
    }
    g.computeNormals();
    g.commit();

    if (this.edge) {
      const e = this.edge;
      const half = 0.045 * sw;
      for (let i = 0; i < e.rows; i++) {
        const t = this.edgeT[i];
        const h = lerp(p.top, p.hem, t);
        const ri = Math.round(t * (rows - 1));
        const s = this.table.sample(h, sec);
        const dth = half / Math.max(1, s.a + p.flare * sw * t);
        for (let j = 0; j < 3; j++) {
          this.point(p.wrapEdge + (j - 1) * dth, h, ri, sw, twirl, 0.01 * sw, v1);
          e.set(i, j, v1);
        }
      }
      e.computeNormals();
      e.commit();
    }
    shape.registerLayer(p.top, p.hem, (p.ease + p.flare * 0.5) * sw);
  }
}
