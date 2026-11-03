import { Group, InstancedMesh, Material, Mesh, Object3D, Vector3 } from 'three';
import type { BodyRig } from '../body/BodyRig';
import type { BodyShape } from '../body/BodyShape';
import type { FabricLibrary, FabricSpec } from '../materials/FabricLibrary';
import type { Gender } from '../core/types';
import { clamp, crVec, damp } from '../core/math';

export interface GarmentContext {
  lib: FabricLibrary;
  /** Mesh resolution multiplier 0.5..1 */
  detail: number;
  gender: Gender;
  clothIterations: number;
}

/** Order in which garments are updated each frame (base layers first, drapes after). */
export const enum Stage {
  Base = 0,
  Layer = 1,
  Drape = 2,
  Accessory = 3,
}

export abstract class Garment {
  readonly group = new Group();
  stage: Stage = Stage.Base;

  constructor(
    protected ctx: GarmentContext,
    public fabric: FabricSpec,
  ) {
    this.group.matrixAutoUpdate = false;
  }

  /** Called every frame after the body shape was updated. */
  abstract update(rig: BodyRig, shape: BodyShape, dt: number): void;

  /** Teleport physics state to the current body (tracking re-acquired / new outfit). */
  reset(_rig: BodyRig, _shape: BodyShape): void {}

  protected add(obj: Object3D) {
    obj.frustumCulled = false;
    obj.matrixAutoUpdate = obj instanceof InstancedMesh ? false : obj.matrixAutoUpdate;
    this.group.add(obj);
    return obj;
  }

  protected mesh(geometry: Mesh['geometry'], material: Material | Material[]) {
    const m = new Mesh(geometry, material);
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    this.group.add(m);
    return m;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.group.removeFromParent();
  }
}

/** Smooth path sampler through control points (Catmull-Rom, parameter = segment index + t). */
export function samplePath(pts: Vector3[], u: number, out: Vector3) {
  const n = pts.length;
  const uu = clamp(u, 0, n - 1);
  const k = Math.min(n - 2, Math.floor(uu));
  const t = uu - k;
  return crVec(pts[Math.max(0, k - 1)], pts[k], pts[k + 1], pts[Math.min(n - 1, k + 2)], t, out);
}

export function sampleScalar(vals: number[], u: number) {
  const n = vals.length;
  const uu = clamp(u, 0, n - 1);
  const k = Math.min(n - 2, Math.floor(uu));
  const t = uu - k;
  return vals[k] + (vals[k + 1] - vals[k]) * t;
}

/**
 * Damped springs that let lower rows of skirts/kurtas lag behind the body
 * (secondary motion) and twist when the wearer turns.
 */
export class SwaySystem {
  readonly offset: Vector3[];
  readonly yawLag: Float32Array;
  private pos: Vector3[];
  private vel: Vector3[];
  private yawPos: Float32Array;
  private yawVel: Float32Array;
  private tmp = new Vector3();
  private ready = false;

  constructor(public count: number) {
    this.offset = Array.from({ length: count }, () => new Vector3());
    this.pos = Array.from({ length: count }, () => new Vector3());
    this.vel = Array.from({ length: count }, () => new Vector3());
    this.yawLag = new Float32Array(count);
    this.yawPos = new Float32Array(count);
    this.yawVel = new Float32Array(count);
  }

  reset() {
    this.ready = false;
  }

  /**
   * @param targets rest positions of each row centre
   * @param freedom 0 (rigidly attached) .. 1 (fully free) per row
   * @param maxOff  maximum lag distance in scene px
   */
  update(targets: Vector3[], freedom: Float32Array, yaw: number, dt: number, maxOff: number, amount: number) {
    if (!this.ready) {
      for (let i = 0; i < this.count; i++) {
        this.pos[i].copy(targets[i]);
        this.vel[i].set(0, 0, 0);
        this.offset[i].set(0, 0, 0);
        this.yawPos[i] = yaw;
        this.yawVel[i] = 0;
        this.yawLag[i] = 0;
      }
      this.ready = true;
      return;
    }
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / (1 / 90))));
    const h = dt / steps;
    for (let i = 0; i < this.count; i++) {
      const f = freedom[i] * amount;
      if (f <= 0.001) {
        this.pos[i].copy(targets[i]);
        this.vel[i].set(0, 0, 0);
        this.offset[i].set(0, 0, 0);
        this.yawPos[i] = yaw;
        this.yawLag[i] = 0;
        continue;
      }
      const k = 220 - 170 * f; // stiffness falls towards the hem
      const c = 2 * Math.sqrt(k) * 0.38; // under-damped -> a little swing
      // unwrap yaw target near the tracked value
      let yt = yaw;
      while (yt - this.yawPos[i] > Math.PI) yt -= Math.PI * 2;
      while (yt - this.yawPos[i] < -Math.PI) yt += Math.PI * 2;
      for (let s = 0; s < steps; s++) {
        this.tmp.copy(targets[i]).sub(this.pos[i]).multiplyScalar(k);
        this.tmp.addScaledVector(this.vel[i], -c);
        this.vel[i].addScaledVector(this.tmp, h);
        this.pos[i].addScaledVector(this.vel[i], h);
        const ka = 90 - 70 * f;
        const ca = 2 * Math.sqrt(ka) * 0.3;
        const acc = (yt - this.yawPos[i]) * ka - this.yawVel[i] * ca;
        this.yawVel[i] += acc * h;
        this.yawPos[i] += this.yawVel[i] * h;
      }
      this.offset[i].copy(this.pos[i]).sub(targets[i]).multiplyScalar(f);
      const l = this.offset[i].length();
      const lim = maxOff * f;
      if (l > lim) {
        this.offset[i].multiplyScalar(lim / l);
        this.pos[i].copy(targets[i]).add(this.offset[i]);
        this.vel[i].multiplyScalar(0.5);
      }
      this.yawLag[i] = clamp(this.yawPos[i] - yt, -1.2, 1.2) * f;
    }
  }
}

/** Smoothly follows a scalar (e.g. twirl flare) */
export class Smoothed {
  v = 0;
  constructor(private rate: number) {}
  update(target: number, dt: number) {
    this.v += (target - this.v) * damp(this.rate, dt);
    return this.v;
  }
}
