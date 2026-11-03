import { Vector3, type Material } from 'three';
import { Garment, Stage, type GarmentContext } from './Garment';
import { GridMesh, type Band } from './GridMesh';
import { BodyShape } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import type { FabricSpec } from '../materials/FabricLibrary';
import { clamp } from '../core/math';

export type DrapeStyle = 'dupatta-front' | 'dupatta-shoulder' | 'stole' | 'pallu' | 'tail';

export interface DrapeParams {
  style: DrapeStyle;
  /** Length / width in metres. */
  length: number;
  width: number;
  /** Fraction of the length (at each end) with the decorated end panel. */
  endPanel: number;
  /** Width of the gathered fold where the drape is pinned (fraction of width). */
  gather: number;
}

export const DRAPE_DEFAULTS: Record<DrapeStyle, DrapeParams> = {
  'dupatta-front': { style: 'dupatta-front', length: 2.3, width: 0.3, endPanel: 0.1, gather: 0.45 },
  'dupatta-shoulder': { style: 'dupatta-shoulder', length: 2.0, width: 0.42, endPanel: 0.12, gather: 0.3 },
  stole: { style: 'stole', length: 1.7, width: 0.26, endPanel: 0.12, gather: 0.55 },
  pallu: { style: 'pallu', length: 1.05, width: 0.6, endPanel: 0.45, gather: 0.2 },
  tail: { style: 'tail', length: 0.55, width: 0.16, endPanel: 0.25, gather: 0.6 },
};

/** Pin anchor callback: writes the anchor for column fraction u (0..1). */
export type PinFn = (u: number, out: Vector3) => void;

interface Pin {
  row: number;
  fn: PinFn;
}

const tmp = new Vector3();
const tmp2 = new Vector3();

/**
 * Position-based (Verlet) cloth strip. Rows run along the drape length,
 * columns across its width. Pinned rows follow anchor points on the body;
 * free particles fall under gravity and collide with the clothed body
 * (front/back aware) and the arms.
 */
export class ClothDrape extends Garment {
  readonly p: DrapeParams;
  readonly grid: GridMesh;
  readonly nv: number;
  readonly nu: number;
  private pos: Float32Array;
  private prev: Float32Array;
  private pinned: Uint8Array;
  private side: Int8Array;
  private cons: Float32Array; // a, b, restMetres, stiffness
  private nc = 0;
  private pins: Pin[] = [];
  private ready = false;
  private carryPrev = new Vector3();
  private carryReady = false;
  /** Optional external pin provider (used by the saree for its pallu). */
  pinProvider: ((rig: BodyRig, shape: BodyShape, pins: Pin[]) => void) | null = null;
  /** Called to initialise the drape shape (rows 0..nv-1). */
  private sideOf: (row: number) => -1 | 0 | 1;

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<DrapeParams> & { style: DrapeStyle }) {
    super(ctx, fabric);
    this.stage = Stage.Drape;
    const p = (this.p = { ...DRAPE_DEFAULTS[params.style], ...params });
    const d = ctx.detail;
    this.nu = p.style === 'tail' ? 4 : Math.max(5, Math.round(8 * d));
    this.nv = clamp(Math.round((p.length / 0.055) * d), 10, 46);
    const nv = this.nv;
    const nu = this.nu;
    const n = nv * nu;
    this.pos = new Float32Array(n * 3);
    this.prev = new Float32Array(n * 3);
    this.pinned = new Uint8Array(n);
    this.side = new Int8Array(n);

    // constraints: structural, shear, bend
    const list: number[] = [];
    const dl = p.length / (nv - 1);
    const dw = p.width / (nu - 1);
    const id = (i: number, j: number) => i * nu + j;
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nu; j++) {
        if (j < nu - 1) list.push(id(i, j), id(i, j + 1), dw, 1);
        if (i < nv - 1) list.push(id(i, j), id(i + 1, j), dl, 1);
        if (i < nv - 1 && j < nu - 1) {
          const dg = Math.hypot(dl, dw);
          list.push(id(i, j), id(i + 1, j + 1), dg, 0.6);
          list.push(id(i, j + 1), id(i + 1, j), dg, 0.6);
        }
        if (i < nv - 2) list.push(id(i, j), id(i + 2, j), dl * 2, 0.35);
        if (j < nu - 2) list.push(id(i, j), id(i, j + 2), dw * 2, 0.25);
      }
    }
    this.cons = new Float32Array(list);
    this.nc = list.length / 4;

    // bands: decorated ends + drape body
    const bands: Band[] = [];
    const endRows = Math.max(2, Math.round(p.endPanel * (nv - 1)));
    const twoEnds = p.style !== 'pallu' && p.style !== 'tail';
    if (twoEnds) {
      bands.push({ r0: 0, r1: endRows, material: 1, uv: 'band', uRepeat: 1, flipV: true });
      bands.push({ r0: endRows, r1: nv - 1 - endRows, material: 0, uv: 'body', uRepeat: 1 });
      bands.push({ r0: nv - 1 - endRows, r1: nv - 1, material: 1, uv: 'band', uRepeat: 1 });
    } else {
      bands.push({ r0: 0, r1: nv - 1 - endRows, material: 0, uv: 'body', uRepeat: 1 });
      bands.push({ r0: nv - 1 - endRows, r1: nv - 1, material: 1, uv: 'band', uRepeat: 1 });
    }
    this.grid = new GridMesh(nv, nu, false, bands, 1, p.length / p.width);
    const mats: Material[] = [ctx.lib.drape(fabric), ctx.lib.palluEnd(fabric)];
    this.mesh(this.grid.geometry, mats);

    // which side of the body each row hangs on
    const fr = (f: number) => Math.round(f * (nv - 1));
    switch (p.style) {
      case 'dupatta-front': {
        const a = fr(0.27);
        const b = fr(0.73);
        this.sideOf = (i) => (i > a && i < b ? 1 : i === a || i === b ? 0 : -1);
        break;
      }
      case 'dupatta-shoulder': {
        const a = fr(0.47);
        this.sideOf = (i) => (i < a ? 1 : i === a ? 0 : -1);
        break;
      }
      case 'stole': {
        const a = fr(0.42);
        const b = fr(0.58);
        this.sideOf = (i) => (i > a && i < b ? -1 : i === a || i === b ? 0 : 1);
        break;
      }
      default:
        this.sideOf = () => -1;
    }
    for (let i = 0; i < nv; i++) for (let j = 0; j < nu; j++) this.side[i * nu + j] = this.sideOf(i);
  }

  /** Builds pin anchors on the current body for the built-in styles. */
  private makePins(rig: BodyRig, shape: BodyShape) {
    const p = this.p;
    const nv = this.nv;
    const fr = (f: number) => Math.round(f * (nv - 1));
    this.pins.length = 0;
    const shoulderTop = (left: boolean, along: number, fwdOff: number) => {
      const S = rig.p[left ? 11 : 12];
      return (u: number, out: Vector3) => {
        const sw = rig.sw;
        const gatherW = p.width * p.gather * rig.scale;
        out.copy(rig.neck).lerp(S, along);
        // rest on the shoulder line (the neck point sits ~0.17 sw above it)
        out.addScaledVector(rig.up, sw * 0.02 + shape.layerAt(0.2) * 0.8);
        out.addScaledVector(rig.side, (u - 0.5) * gatherW * (left ? 1 : -1) * 0.8);
        out.addScaledVector(rig.fwd, fwdOff * sw + (u - 0.5) * gatherW * 0.35);
      };
    };
    switch (p.style) {
      case 'dupatta-front':
        this.pins.push({ row: fr(0.27), fn: shoulderTop(false, 0.62, 0.05) });
        this.pins.push({ row: fr(0.73), fn: shoulderTop(true, 0.62, 0.05) });
        break;
      case 'dupatta-shoulder':
        this.pins.push({ row: fr(0.47), fn: shoulderTop(true, 0.6, 0) });
        break;
      case 'stole':
        this.pins.push({ row: fr(0.42), fn: shoulderTop(true, 0.74, -0.02) });
        this.pins.push({ row: fr(0.58), fn: shoulderTop(false, 0.74, -0.02) });
        break;
      case 'tail': {
        const hd = shape.head;
        this.pins.push({
          row: 0,
          fn: (u, out) => {
            out.copy(hd.c).addScaledVector(hd.fwd, -hd.rz * 1.05).addScaledVector(hd.up, hd.ry * 0.05);
            out.addScaledVector(hd.side, (u - 0.5) * hd.rx * 0.5);
          },
        });
        break;
      }
      default:
        break;
    }
    if (this.pinProvider) this.pinProvider(rig, shape, this.pins);
    this.pinned.fill(0);
    for (const pin of this.pins) for (let j = 0; j < this.nu; j++) this.pinned[pin.row * this.nu + j] = 1;
  }

  /** Lay the cloth out in a plausible hanging pose, then let it settle. */
  reset(rig: BodyRig, shape: BodyShape) {
    this.makePins(rig, shape);
    const nv = this.nv;
    const nu = this.nu;
    const dl = (this.p.length / (nv - 1)) * rig.scale;
    // Walk outward from each pinned row; rows hang straight down (front/back offset).
    const pinRows = this.pins.map((x) => x.row).sort((a, b) => a - b);
    const anchors = new Map<number, Vector3[]>();
    for (const pin of this.pins) {
      const arr: Vector3[] = [];
      for (let j = 0; j < nu; j++) {
        const v = new Vector3();
        pin.fn(j / (nu - 1), v);
        arr.push(v);
      }
      anchors.set(pin.row, arr);
    }
    for (let i = 0; i < nv; i++) {
      // nearest pin row
      let best = pinRows[0] ?? 0;
      for (const r of pinRows) if (Math.abs(r - i) < Math.abs(best - i)) best = r;
      const base = anchors.get(best);
      const dist = Math.abs(i - best) * dl;
      const sd = this.sideOf(i);
      for (let j = 0; j < nu; j++) {
        const k = (i * nu + j) * 3;
        if (base) tmp.copy(base[j]);
        else tmp.copy(rig.neck);
        tmp.addScaledVector(rig.up, -dist * 0.95);
        tmp.addScaledVector(rig.fwd, sd * rig.sw * 0.45);
        // spread between two pins (U shapes) horizontally
        if (pinRows.length === 2 && i > pinRows[0] && i < pinRows[1]) {
          const a = anchors.get(pinRows[0])![j];
          const b = anchors.get(pinRows[1])![j];
          const f = (i - pinRows[0]) / (pinRows[1] - pinRows[0]);
          tmp.lerpVectors(a, b, f);
          const sag = Math.sin(f * Math.PI) * (pinRows[1] - pinRows[0]) * dl * 0.4;
          tmp.addScaledVector(rig.up, -sag);
          tmp.addScaledVector(rig.fwd, sd * rig.sw * 0.45);
        }
        this.pos[k] = this.prev[k] = tmp.x;
        this.pos[k + 1] = this.prev[k + 1] = tmp.y;
        this.pos[k + 2] = this.prev[k + 2] = tmp.z;
      }
    }
    this.ready = true;
    for (let s = 0; s < 70; s++) this.step(rig, shape, 1 / 90, true);
    for (let i = 0; i < this.pos.length; i++) this.prev[i] = this.pos[i];
  }

  private step(rig: BodyRig, shape: BodyShape, h: number, settle = false) {
    const { pos, prev, pinned, nu } = this;
    const n = this.nv * nu;
    const sc = rig.scale;
    const g = 9.81 * sc * h * h;
    const damping = settle ? 0.9 : 0.985;
    const vmax = rig.sw * 0.12;
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      const k = i * 3;
      let vx = (pos[k] - prev[k]) * damping;
      let vy = (pos[k + 1] - prev[k + 1]) * damping;
      let vz = (pos[k + 2] - prev[k + 2]) * damping;
      // speed cap keeps the cloth stable through tracking glitches
      const v2 = vx * vx + vy * vy + vz * vz;
      if (v2 > vmax * vmax) {
        const f = vmax / Math.sqrt(v2);
        vx *= f;
        vy *= f;
        vz *= f;
      }
      prev[k] = pos[k];
      prev[k + 1] = pos[k + 1];
      prev[k + 2] = pos[k + 2];
      pos[k] += vx;
      pos[k + 1] += vy - g;
      pos[k + 2] += vz;
    }
    // pins
    for (const pin of this.pins) {
      for (let j = 0; j < nu; j++) {
        pin.fn(nu === 1 ? 0.5 : j / (nu - 1), tmp);
        const k = (pin.row * nu + j) * 3;
        prev[k] = pos[k] = tmp.x;
        prev[k + 1] = pos[k + 1] = tmp.y;
        prev[k + 2] = pos[k + 2] = tmp.z;
      }
    }
    const iters = this.ctx.clothIterations;
    const c = this.cons;
    for (let it = 0; it < iters; it++) {
      for (let q = 0; q < this.nc; q++) {
        const a = c[q * 4];
        const b = c[q * 4 + 1];
        const rest = c[q * 4 + 2] * sc;
        const stiff = c[q * 4 + 3];
        const ka = a * 3;
        const kb = b * 3;
        const dx = pos[kb] - pos[ka];
        const dy = pos[kb + 1] - pos[ka + 1];
        const dz = pos[kb + 2] - pos[ka + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        // cloth resists stretching much more than compression
        let diff = (len - rest) / len;
        if (diff < 0) diff *= 0.35;
        diff *= stiff;
        const wa = pinned[a] ? 0 : 1;
        const wb = pinned[b] ? 0 : 1;
        const ws = wa + wb;
        if (ws === 0) continue;
        const fa = (diff * wa) / ws;
        const fb = (diff * wb) / ws;
        pos[ka] += dx * fa;
        pos[ka + 1] += dy * fa;
        pos[ka + 2] += dz * fa;
        pos[kb] -= dx * fb;
        pos[kb + 1] -= dy * fb;
        pos[kb + 2] -= dz * fb;
      }
    }
    this.collide(rig, shape);
  }

  private collide(rig: BodyRig, shape: BodyShape) {
    const { pos, pinned, side } = this;
    const n = this.nv * this.nu;
    const sw = rig.sw;
    const margin = sw * 0.035;
    const armL = shape.armL;
    const armR = shape.armR;
    const hd = shape.head;
    const headR = Math.max(hd.rx, hd.rz) * 1.02;
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      const k = i * 3;
      tmp.set(pos[k], pos[k + 1], pos[k + 2]);
      let moved = shape.pushOut(tmp, margin, side[i] as -1 | 0 | 1);
      // arms (upper arm + forearm) with sleeve allowance
      for (const L of [armL, armR]) {
        moved = BodyShape.pushOutCapsule(tmp, L.pts[1], L.pts[2], L.r[1] + sw * 0.07, tmp2) || moved;
        moved = BodyShape.pushOutCapsule(tmp, L.pts[2], L.pts[3], L.r[2] + sw * 0.06, tmp2) || moved;
      }
      // head
      const dx = tmp.x - hd.c.x;
      const dy = tmp.y - hd.c.y;
      const dz = tmp.z - hd.c.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < headR * headR) {
        const d = Math.sqrt(d2) || 1;
        tmp.set(hd.c.x + (dx / d) * headR, hd.c.y + (dy / d) * headR, hd.c.z + (dz / d) * headR);
        moved = true;
      }
      if (moved) {
        pos[k] = tmp.x;
        pos[k + 1] = tmp.y;
        pos[k + 2] = tmp.z;
      }
    }
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    if (!this.ready || rig.jumped) {
      this.reset(rig, shape);
      this.carryPrev.copy(rig.neck);
      this.carryReady = true;
    } else {
      // Carry the cloth along with the body: most of the translation is applied
      // directly and only the rest is felt as inertia (gentle swing), so fast moves
      // or low frame rates never whip the drape around.
      if (this.carryReady) {
        tmp.copy(rig.neck).sub(this.carryPrev);
        const d = tmp.length();
        if (d > 1e-3) {
          const k = clamp(0.65 + (d / (rig.sw * 0.3)) * 0.35, 0.65, 1);
          const { pos, prev, pinned } = this;
          for (let i = 0; i < pinned.length; i++) {
            if (pinned[i]) continue;
            const q = i * 3;
            pos[q] += tmp.x * k;
            pos[q + 1] += tmp.y * k;
            pos[q + 2] += tmp.z * k;
            prev[q] += tmp.x * k;
            prev[q + 1] += tmp.y * k;
            prev[q + 2] += tmp.z * k;
          }
        }
      }
      this.carryPrev.copy(rig.neck);
      this.carryReady = true;
      const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 110))));
      const h = Math.min(dt, 1 / 30) / steps;
      for (let s = 0; s < steps; s++) this.step(rig, shape, h);
    }
    const g = this.grid;
    const P = g.P;
    P.set(this.pos);
    g.computeNormals();
    g.commit();
  }
}
