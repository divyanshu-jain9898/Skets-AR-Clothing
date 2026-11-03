import { Vector3, type Material } from 'three';
import { Garment, SwaySystem, type GarmentContext } from './Garment';
import { GridMesh } from './GridMesh';
import { SectionTable, layoutRows, writeTube, type SegmentSpec } from './helpers';
import { H, PROP, type BodyShape, type LimbPath } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import { Section } from '../body/Section';
import type { FabricSpec } from '../materials/FabricLibrary';
import { lerp, smoothstep, TAU } from '../core/math';

export type PantsStyle = 'churidar' | 'pyjama' | 'salwar' | 'palazzo' | 'sharara' | 'dhoti' | 'jodhpuri';

export interface PantsParams {
  style: PantsStyle;
  top: number;
  /** Leg parameter of the hem: 1 = knee, 2 = ankle. */
  hemT: number;
  ease: number;
  hemBorder: number;
}

export const PANTS_DEFAULTS: PantsParams = { style: 'pyjama', top: H.WAIST + 0.1, hemT: 2.05, ease: 0.04, hemBorder: 0 };

/** Extra radius (sw units) over the body leg at leg parameter t, plus fold amplitude. */
function profile(style: PantsStyle, t: number): { r: number; abs: boolean; folds: number; foldAmp: number } {
  switch (style) {
    case 'churidar':
      return { r: 0.025, abs: false, folds: 0, foldAmp: 0 };
    case 'jodhpuri':
      return t < 1 ? { r: lerp(0.12, 0.05, t), abs: false, folds: 6, foldAmp: 0.012 } : { r: 0.02, abs: false, folds: 0, foldAmp: 0 };
    case 'salwar': {
      const r = t < 1.55 ? lerp(0.36, 0.33, t / 1.55) : lerp(0.33, 0.13, smoothstep(1.55, 2.02, t));
      return { r, abs: true, folds: 9, foldAmp: 0.02 + 0.03 * smoothstep(1.2, 1.95, t) };
    }
    case 'palazzo':
      return { r: lerp(0.38, 0.46, t / 2), abs: true, folds: 8, foldAmp: 0.03 * smoothstep(0.4, 2, t) };
    case 'sharara': {
      const r = t < 1 ? 0.06 : lerp(0.06, 0.62, Math.pow(smoothstep(1, 2.05, t), 0.8));
      return { r, abs: false, folds: 14, foldAmp: 0.045 * smoothstep(1.05, 2, t) };
    }
    case 'dhoti':
      return { r: lerp(0.42, 0.34, t / 2), abs: true, folds: 7, foldAmp: 0.035 };
    default:
      return { r: lerp(0.32, 0.22, t / 2), abs: true, folds: 5, foldAmp: 0.012 };
  }
}

const sec = new Section();
const v0 = new Vector3();
const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();
const v4 = new Vector3();

interface LegState {
  grid: GridMesh;
  rowT: number[];
  limb: 'L' | 'R';
}

/** Churidar, pyjama, salwar, palazzo, sharara, dhoti, jodhpuri breeches. */
export class PantsGarment extends Garment {
  readonly p: PantsParams;
  private seat: GridMesh;
  private seatH: number[];
  private table = new SectionTable(40);
  private legs: LegState[] = [];
  private panel: GridMesh | null = null;
  private sway = new SwaySystem(2);
  private legTargets = [new Vector3(), new Vector3()];
  private legFree = new Float32Array([1, 1]);
  private seatBottom = H.CROTCH + 0.25;

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<PantsParams>) {
    super(ctx, fabric);
    const p = (this.p = { ...PANTS_DEFAULTS, ...params });
    const d = ctx.detail;
    const mats: Material[] = [ctx.lib.body(fabric), ctx.lib.border(fabric)];
    // seat: waist -> just below crotch, wraps both legs
    const C = Math.max(40, Math.round((56 * d) / 4) * 4);
    const sr = Math.max(8, Math.round(12 * d));
    this.seatH = Array.from({ length: sr }, (_, i) => lerp(p.top, this.seatBottom, i / (sr - 1)));
    this.seat = new GridMesh(sr, C, true, [{ r0: 0, r1: sr - 1, material: 0, uv: 'body' }], 8, 1.6);
    this.mesh(this.seat.geometry, mats);

    const lr = Math.max(14, Math.round(26 * d));
    const lc = Math.max(16, Math.round((p.style === 'sharara' || p.style === 'salwar' ? 36 : 26) * d / 2) * 2);
    const tB = p.hemBorder > 0 ? Math.min(0.25, p.hemBorder / 0.9) : 0;
    for (const limb of ['L', 'R'] as const) {
      const segs: SegmentSpec[] = [{ t0: 0.06, t1: p.hemT - tB, rows: lr, material: 0, uv: 'body' }];
      if (tB > 0) segs.push({ t0: p.hemT - tB, t1: p.hemT, rows: 3, material: 1, uv: 'band', uRepeat: p.style === 'sharara' ? 7 : 3 });
      const lay = layoutRows(segs);
      const grid = new GridMesh(lay.rowT.length, lc, true, lay.bands, 3, p.hemT * 2.2);
      this.mesh(grid.geometry, mats);
      this.legs.push({ grid, rowT: lay.rowT, limb });
    }
    if (p.style === 'dhoti') {
      this.panel = new GridMesh(16, 9, false, [{ r0: 0, r1: 15, material: 0, uv: 'body' }], 1.2, 3);
      this.mesh(this.panel.geometry, mats);
    }
  }

  reset() {
    this.sway.reset();
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    const p = this.p;
    const sw = shape.sw;
    this.table.build(shape, p.top - 0.05, this.seatBottom + 0.05);
    // seat
    const s0 = profile(p.style, 0);
    const seatGrow = (s0.abs ? Math.max(0, s0.r - PROP.thighR) * 0.55 : s0.r) * sw + p.ease * sw;
    const g = this.seat;
    const C = g.cols;
    for (let i = 0; i < g.rows; i++) {
      const h = this.seatH[i];
      const s = this.table.sample(h, sec);
      // under a top the seat is invisible: keep it inside so it never pokes through
      const covered = shape.layerAt(h + 0.14) > 0;
      const grow = covered ? -0.012 * sw : seatGrow * smoothstep(p.top, H.HIP, h) + p.ease * sw;
      for (let j = 0; j < C; j++) {
        const th = (j / C) * TAU;
        const sn = Math.sin(th);
        const cs = Math.cos(th);
        const ex = 2 / s.n;
        const x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * (s.a + grow);
        const z = Math.sign(cs) * Math.pow(Math.abs(cs), ex) * ((cs >= 0 ? s.bF : s.bB) + grow);
        v0.copy(s.c).addScaledVector(s.side, x).addScaledVector(s.fwd, z);
        g.set(i, j, v0);
      }
    }
    g.computeNormals();
    g.commit();

    // legs: wide styles swing a little at the hem
    shape.legPoint(shape.legL, p.hemT, this.legTargets[0]);
    shape.legPoint(shape.legR, p.hemT, this.legTargets[1]);
    const loose = p.style === 'sharara' || p.style === 'palazzo' || p.style === 'dhoti' || p.style === 'salwar';
    this.sway.update(this.legTargets, this.legFree, rig.yaw, dt, 0.2 * sw, loose ? 0.8 : 0);
    for (let k = 0; k < this.legs.length; k++) {
      const L = this.legs[k];
      this.updateLeg(L, L.limb === 'L' ? shape.legL : shape.legR, shape, rig, sw, this.sway.offset[k]);
    }

    if (this.panel) this.updatePanel(shape, sw);
    shape.registerLayer(p.top, this.seatBottom, seatGrow);
  }

  private updateLeg(L: LegState, limb: LimbPath, shape: BodyShape, rig: BodyRig, sw: number, hemOff: Vector3) {
    const p = this.p;
    const ease = p.ease * sw;
    const style = p.style;
    const tEnd = p.hemT;
    // body height of leg parameter t, to know which part is hidden under a long top
    const hOf = (t: number) => (t <= 1 ? lerp(H.HIP, H.KNEE, t) : lerp(H.KNEE, H.ANKLE, t - 1));
    const cover = L.rowT.map((t) => (shape.layerAt(hOf(t) + 0.14) > 0 ? 1 : 0));
    for (let i = cover.length - 2; i >= 0; i--) if (cover[i + 1] === 1) cover[i] = 1;
    writeTube(
      L.grid,
      L.rowT,
      (t, out) => {
        shape.legPoint(limb, t, out);
        const w = smoothstep(1.0, tEnd, t);
        return out.addScaledVector(hemOff, w);
      },
      (t, phi, row) => {
        const base0 = t <= 1 ? lerp(limb.r[0], limb.r[1], Math.pow(t, 0.8)) : lerp(limb.r[1], limb.r[2], t - 1);
        if (cover[row]) return base0 * 0.98 + 0.008 * sw;
        const pr = profile(style, t);
        const base = t <= 1 ? lerp(limb.r[0], limb.r[1], Math.pow(t, 0.8)) : lerp(limb.r[1], limb.r[2], t - 1);
        let r = pr.abs ? Math.max(base + ease * 0.5, pr.r * sw) : base + pr.r * sw + ease * 0.6;
        if (pr.folds > 0) r += pr.foldAmp * sw * Math.sin(phi * pr.folds + t * 1.7);
        if (style === 'churidar' && t > 1.35) {
          // gathered "churi" rings near the ankle
          const k = smoothstep(1.35, 1.75, t);
          r += 0.03 * sw * k * Math.pow(Math.abs(Math.sin(t * 34)), 0.6);
        }
        return r;
      },
      rig.hipFwd,
    );
  }

  /** Dhoti front pleats hanging from the waist between the legs. */
  private updatePanel(shape: BodyShape, sw: number) {
    const pan = this.panel!;
    const p = this.p;
    const rows = pan.rows;
    const cols = pan.cols;
    const top = this.table.sample(p.top + 0.04, sec);
    const topC = v1.copy(top.c).addScaledVector(top.fwd, top.bF + 0.06 * sw);
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const legT = lerp(0.0, p.hemT * 0.82, t);
      const pl = shape.legPoint(shape.legL, Math.max(0.2, legT), v0);
      const pr = shape.legPoint(shape.legR, Math.max(0.2, legT), v2);
      const mid = pl.add(pr).multiplyScalar(0.5);
      const front = Math.max(shape.legL.r[0], shape.legL.r[1]) * (1 - t * 0.3) + 0.05 * sw;
      const s = this.table.sample(Math.min(this.seatBottom, p.top + t * 2), sec);
      mid.addScaledVector(s.fwd, front);
      const cx = v3.copy(topC).lerp(mid, smoothstep(0, 0.5, t));
      const width = lerp(0.42, 0.3, t) * sw;
      for (let j = 0; j < cols; j++) {
        const u = j / (cols - 1) - 0.5;
        const zig = (j % 2 === 0 ? 1 : -1) * 0.035 * sw * (0.4 + 0.6 * t);
        v4.copy(cx).addScaledVector(s.side, u * width).addScaledVector(s.fwd, zig + Math.abs(u) * -0.05 * sw);
        pan.set(i, j, v4);
      }
    }
    pan.computeNormals();
    pan.commit();
  }
}

