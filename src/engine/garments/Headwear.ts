import { ConeGeometry, Group, Matrix4, Mesh, SphereGeometry, TorusGeometry, Vector3, type Material } from 'three';
import { Garment, Stage, type GarmentContext } from './Garment';
import { GridMesh } from './GridMesh';
import { ClothDrape } from './ClothDrape';
import type { BodyShape } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import type { FabricSpec } from '../materials/FabricLibrary';
import { TAU, lerp, smoothstep } from '../core/math';

export interface TurbanParams {
  style: 'safa' | 'pagdi';
  height: number;
  tail: boolean;
  kalgi: boolean;
}

const v0 = new Vector3();
const m4 = new Matrix4();

/** Head-local point: x along side, y along up (from ear level), z along fwd, in ear-widths. */
function headPoint(shape: BodyShape, x: number, y: number, z: number, out: Vector3) {
  const hd = shape.head;
  const w = hd.earW;
  return out
    .copy(hd.earMid)
    .addScaledVector(hd.side, x * w)
    .addScaledVector(hd.up, y * w)
    .addScaledVector(hd.fwd, z * w);
}

/** Rajasthani safa / pagdi: wrapped dome with criss-crossing folds, kalgi and a cloth tail. */
export class TurbanGarment extends Garment {
  readonly p: TurbanParams;
  private grid: GridMesh;
  private ornament = new Group();
  private tail: ClothDrape | null = null;

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<TurbanParams>) {
    super(ctx, fabric);
    this.stage = Stage.Accessory;
    this.p = { style: 'safa', height: 1, tail: true, kalgi: true, ...params };
    const d = ctx.detail;
    const rows = Math.max(14, Math.round(22 * d));
    const cols = Math.max(32, Math.round(48 * d));
    this.grid = new GridMesh(rows, cols, true, [{ r0: 0, r1: rows - 1, material: 0, uv: 'body' }], 3, 1.6);
    const mats: Material[] = [ctx.lib.body(fabric)];
    this.mesh(this.grid.geometry, mats);
    if (this.p.kalgi) {
      const gold = ctx.lib.trim('gold');
      const ring = new Mesh(new TorusGeometry(1, 0.28, 8, 20), gold);
      const gem = new Mesh(new SphereGeometry(0.75, 14, 10), ctx.lib.trim('ruby'));
      gem.scale.set(1, 1, 0.6);
      const plume = new Mesh(new ConeGeometry(0.55, 4.8, 10, 4, true), ctx.lib.trim('feather'));
      plume.position.set(0.3, 2.6, -0.6);
      plume.rotation.set(-0.45, 0, -0.18);
      const pearl = new Mesh(new SphereGeometry(0.32, 10, 8), ctx.lib.trim('pearl'));
      pearl.position.set(0, -1.35, 0.15);
      this.ornament.add(ring, gem, plume, pearl);
      this.ornament.traverse((o) => (o.frustumCulled = false));
      this.ornament.matrixAutoUpdate = false;
      this.group.add(this.ornament);
    }
    if (this.p.tail) {
      this.tail = new ClothDrape(ctx, fabric, { style: 'tail', length: 0.62, width: 0.16 });
      this.group.add(this.tail.group);
    }
  }

  reset(rig: BodyRig, shape: BodyShape) {
    this.tail?.reset(rig, shape);
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    const g = this.grid;
    const rows = g.rows;
    const cols = g.cols;
    const pagdi = this.p.style === 'pagdi';
    const top = (pagdi ? 1.05 : 1.22) * this.p.height;
    const layers = pagdi ? 5 : 7;
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1); // 0 brim .. 1 crown
      for (let j = 0; j < cols; j++) {
        const th = (j / cols) * TAU;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        // brim tilts: higher at the forehead, lower at the nape
        const brimY = 0.22 + 0.2 * cs;
        const y = lerp(brimY, top + (pagdi ? 0.05 : 0.12) * cs, t);
        // dome profile
        const dome = Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.5 + Math.PI * 0.5 * smoothstep(0.55, 1, t));
        const bulge = 1 + 0.16 * Math.sin(t * Math.PI) - 0.08 * t;
        let rx = 0.63 * bulge;
        let rz = 0.74 * bulge;
        const close = 1 - smoothstep(0.7, 1, t);
        rx *= lerp(0.18, 1, close) * (0.8 + 0.2 * dome);
        rz *= lerp(0.25, 1, close) * (0.8 + 0.2 * dome);
        // wrapped folds crossing at the front
        const tilt = 0.9 * sn * (1 - 0.4 * t);
        const fold = Math.pow(Math.abs(Math.sin(Math.PI * layers * (t + tilt * 0.12))), 0.45);
        const r = 1 + 0.07 * fold * (1 - smoothstep(0.75, 1, t)) - 0.03;
        const fwdShift = (pagdi ? 0.02 : 0.06) * t;
        headPoint(shape, sn * rx * r, y, cs * rz * r + fwdShift - 0.02, v0);
        g.set(i, j, v0);
      }
    }
    g.computeNormals();
    g.commit();

    if (this.p.kalgi) {
      const hd = shape.head;
      const s = hd.earW * 0.085;
      headPoint(shape, 0, 0.62, 0.8, v0);
      m4.makeBasis(hd.side, hd.up, hd.fwd).scale(new Vector3(s, s, s)).setPosition(v0);
      this.ornament.matrix.copy(m4);
      this.ornament.matrixWorldNeedsUpdate = true;
    }
    this.tail?.update(rig, shape, dt);
  }

  dispose() {
    this.tail?.dispose();
    this.ornament.traverse((o) => (o as Mesh).geometry?.dispose());
    super.dispose();
  }
}

/** Gandhi / Nehru topi: boat-shaped cap pinched into a centre ridge. */
export class TopiGarment extends Garment {
  private grid: GridMesh;
  constructor(ctx: GarmentContext, fabric: FabricSpec) {
    super(ctx, fabric);
    this.stage = Stage.Accessory;
    this.grid = new GridMesh(8, 40, true, [{ r0: 0, r1: 7, material: 0, uv: 'body' }], 2, 1);
    this.mesh(this.grid.geometry, [ctx.lib.body(fabric)]);
  }
  update(_rig: BodyRig, shape: BodyShape) {
    const g = this.grid;
    for (let i = 0; i < g.rows; i++) {
      const t = i / (g.rows - 1);
      for (let j = 0; j < g.cols; j++) {
        const th = (j / g.cols) * TAU;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        const baseY = 0.78 + 0.08 * cs;
        const y = baseY + t * (0.42 - 0.08 * Math.abs(cs));
        const pinch = lerp(1, 0.05, Math.pow(t, 1.4));
        headPoint(shape, sn * 0.62 * pinch, y, cs * 0.86 * (1 - 0.12 * t), v0);
        g.set(i, j, v0);
      }
    }
    g.computeNormals();
    g.commit();
  }
}
