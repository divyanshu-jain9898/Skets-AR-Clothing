import { Vector3, type Material } from 'three';
import { Garment, Stage, type GarmentContext } from './Garment';
import { GridMesh } from './GridMesh';
import { SectionTable } from './helpers';
import { SkirtGarment, type SkirtParams } from './SkirtGarment';
import { ClothDrape } from './ClothDrape';
import { H, type BodyShape } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import { Section } from '../body/Section';
import type { FabricSpec } from '../materials/FabricLibrary';
import { lerp, smoothstep } from '../core/math';

export interface SareeParams {
  /** 'nivi' = pallu over left shoulder hanging behind; 'seedha' = pallu over right shoulder to the front. */
  drape: 'nivi' | 'seedha';
  palluWidth: number;
  skirt: Partial<SkirtParams>;
  palluLength: number;
  /** Half-saree voni: only the pallu band + hanging end, worn over a separate skirt. */
  noSkirt?: boolean;
}

export const SAREE_DEFAULTS: SareeParams = {
  drape: 'nivi',
  palluWidth: 0.95,
  palluLength: 1.05,
  skirt: {
    top: H.WAIST + 0.2,
    hem: H.FLOOR,
    ease: 0.06,
    flare: 0.24,
    pleats: 7,
    pleatDepth: 0.012,
    frontPleats: 8,
    frontPleatDepth: 0.05,
    waistBand: 0,
    hemBorder: 0.2,
    midBorder: 0,
    sway: 0.7,
  },
};

const sec = new Section();
const q0 = new Vector3();
const q1 = new Vector3();
const c0 = new Vector3();
const tan = new Vector3();
const nrm = new Vector3();
const acr = new Vector3();

/**
 * Saree = pleated under-skirt + pallu band wrapping diagonally from the waist
 * across the chest over one shoulder + the decorated pallu end hanging as cloth.
 */
export class SareeGarment extends Garment {
  readonly p: SareeParams;
  private skirt: SkirtGarment | null;
  private band: GridMesh;
  private pallu: ClothDrape;
  private table = new SectionTable(64);
  private na = 24;
  private nw = 8;
  /** Band end points (last row) for pinning the hanging pallu. */
  private endPts: Vector3[];

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<SareeParams>) {
    super(ctx, fabric);
    this.stage = Stage.Drape;
    const p = (this.p = { ...SAREE_DEFAULTS, ...params, skirt: { ...SAREE_DEFAULTS.skirt, ...(params.skirt ?? {}) } });
    this.skirt = p.noSkirt ? null : new SkirtGarment(ctx, fabric, p.skirt);
    if (this.skirt) this.group.add(this.skirt.group);
    this.band = new GridMesh(this.na, this.nw, false, [{ r0: 0, r1: this.na - 1, material: 0, uv: 'body', uRepeat: 1 }], 1, 2.4);
    const mats: Material[] = [ctx.lib.drape(fabric)];
    this.mesh(this.band.geometry, mats);
    this.endPts = Array.from({ length: 6 }, () => new Vector3());
    this.pallu = new ClothDrape(ctx, fabric, { style: 'pallu', length: p.palluLength, width: 0.46 });
    this.pallu.pinProvider = (_rig, _shape, pins) => {
      pins.push({
        row: 0,
        fn: (u, out) => {
          const k = Math.min(this.endPts.length - 1, Math.max(0, Math.round(u * (this.endPts.length - 1))));
          out.copy(this.endPts[k]);
        },
      });
    };
    this.group.add(this.pallu.group);
  }

  reset(rig: BodyRig, shape: BodyShape) {
    this.skirt?.reset();
    this.updateBand(shape);
    this.pallu.reset(rig, shape);
  }

  /** Surface point of the outermost layer at (theta, h). */
  private surf(theta: number, h: number, grow: number, shape: BodyShape, out: Vector3) {
    const s = this.table.sample(h, sec);
    const g = shape.layerAt(h) + grow;
    return s.point(theta, out, g);
  }

  private updateBand(shape: BodyShape) {
    const sw = shape.sw;
    this.table.build(shape, -0.2, H.HIP + 0.3);
    const mirror = this.p.drape === 'seedha' ? -1 : 1;
    // centreline from the right hip (tuck) to the top of the left shoulder
    const th0 = -1.2 * mirror;
    const th1 = 1.38 * mirror;
    const h0 = H.WAIST + 0.32;
    const h1 = 0.06;
    const na = this.na;
    const nw = this.nw;
    const b = this.band;
    for (let i = 0; i < na; i++) {
      const t = i / (na - 1);
      const te = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const th = lerp(th0, th1, te);
      const h = lerp(h0, h1, Math.pow(t, 0.92));
      // local frame on the surface
      this.surf(th, h, 0, shape, c0);
      const dt = 0.02;
      const tb = Math.min(1, t + dt);
      const ta = Math.max(0, t - dt);
      const teb = tb < 0.5 ? 2 * tb * tb : 1 - Math.pow(-2 * tb + 2, 2) / 2;
      const tea = ta < 0.5 ? 2 * ta * ta : 1 - Math.pow(-2 * ta + 2, 2) / 2;
      this.surf(lerp(th0, th1, teb), lerp(h0, h1, Math.pow(tb, 0.92)), 0, shape, q1);
      this.surf(lerp(th0, th1, tea), lerp(h0, h1, Math.pow(ta, 0.92)), 0, shape, q0);
      tan.copy(q1).sub(q0).normalize();
      const s = this.table.sample(h, sec);
      nrm.copy(c0).sub(s.c);
      nrm.addScaledVector(s.up, -nrm.dot(s.up)).normalize();
      acr.crossVectors(nrm, tan).normalize();
      // tucked in narrow at the waist, full across the chest, gathered on the shoulder
      const width = lerp(0.3, 1, smoothstep(0, 0.2, t)) * lerp(this.p.palluWidth, 0.34, smoothstep(0.3, 1, t)) * sw;
      const tuck = 1 - smoothstep(0, 0.15, t);
      const pleat = smoothstep(0.5, 1, t);
      for (let j = 0; j < nw; j++) {
        const w = j / (nw - 1) - 0.5;
        q0.copy(c0).addScaledVector(acr, w * width);
        // re-project onto the body surface
        const hh = shape.heightOf(q0);
        const ss = this.table.sample(hh, sec);
        q1.copy(q0).sub(ss.c);
        const lx = q1.dot(ss.side) / Math.max(1, ss.a);
        const lz = q1.dot(ss.fwd) / Math.max(1, lz0(q1.dot(ss.fwd), ss));
        const theta = Math.atan2(lx, lz);
        const fold = pleat * 0.03 * sw * (0.5 + 0.5 * Math.sin(w * Math.PI * 7));
        this.surf(theta, hh, (0.02 - tuck * 0.012) * sw + fold, shape, q0);
        b.set(i, j, q0);
        if (i === na - 1) {
          const k = Math.round((j / (nw - 1)) * (this.endPts.length - 1));
          // pin just behind the shoulder apex so the pallu falls down the back
          this.surf(theta + 0.62 * mirror, hh + 0.05, 0.03 * sw, shape, this.endPts[k]);
        }
      }
    }
    b.computeNormals();
    b.commit();
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    this.skirt?.update(rig, shape, dt);
    this.updateBand(shape);
    // the band thickens the outer layer on the chest for anything worn on top
    shape.registerLayer(0.05, H.WAIST, shape.layerAt(0.6) + 0.02 * shape.sw);
    this.pallu.update(rig, shape, dt);
  }

  dispose() {
    this.skirt?.dispose();
    this.pallu.dispose();
    super.dispose();
  }
}

function lz0(z: number, s: Section) {
  return z >= 0 ? s.bF : s.bB;
}
