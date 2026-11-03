import { Vector3 } from 'three';
import type { Gender, LandmarkIn, PoseInput } from '../core/types';
import { clamp, damp, lerp } from '../core/math';

export type MannequinPose = 'relaxed' | 'apose' | 'hips' | 'namaste' | 'twirl' | 'walk';

interface BodyDims {
  height: number;
  shoulderHalf: number;
  shoulderY: number;
  hipHalf: number;
  hipY: number;
  kneeY: number;
  ankleY: number;
  upper: number;
  fore: number;
  earY: number;
}

const DIMS: Record<Gender, BodyDims> = {
  women: { height: 1.66, shoulderHalf: 0.163, shoulderY: 1.38, hipHalf: 0.097, hipY: 0.88, kneeY: 0.48, ankleY: 0.085, upper: 0.285, fore: 0.24, earY: 1.565 },
  men: { height: 1.77, shoulderHalf: 0.183, shoulderY: 1.47, hipHalf: 0.1, hipY: 0.93, kneeY: 0.5, ankleY: 0.085, upper: 0.305, fore: 0.26, earY: 1.665 },
};

interface ArmTarget {
  wrist: Vector3; // relative to shoulder (x outward = +, y up, z forward)
  pole: Vector3; // elbow bend direction
}

const PRESETS: Record<MannequinPose, ArmTarget> = {
  relaxed: { wrist: new Vector3(0.1, -0.5, 0.07), pole: new Vector3(0.2, 0, -1) },
  apose: { wrist: new Vector3(0.36, -0.37, 0.03), pole: new Vector3(0, -0.3, -1) },
  hips: { wrist: new Vector3(0.05, -0.44, -0.02), pole: new Vector3(1, 0, -0.6) },
  namaste: { wrist: new Vector3(-0.13, -0.24, 0.22), pole: new Vector3(0.3, -1, -0.1) },
  twirl: { wrist: new Vector3(0.48, -0.08, 0.05), pole: new Vector3(0, -1, -0.4) },
  walk: { wrist: new Vector3(0.08, -0.5, 0.06), pole: new Vector3(0.2, 0, -1) },
};

const tmp = new Vector3();
const tmp2 = new Vector3();
const nvec = new Vector3();

function ik(S: Vector3, T: Vector3, a: number, b: number, pole: Vector3, E: Vector3, W: Vector3) {
  const dir = tmp.copy(T).sub(S);
  let d = dir.length();
  dir.divideScalar(d || 1);
  d = clamp(d, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  W.copy(S).addScaledVector(dir, d);
  const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  nvec.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (nvec.lengthSq() < 1e-8) nvec.set(0, 0, -1);
  nvec.normalize();
  E.copy(S).addScaledVector(dir, a * cosA).addScaledVector(nvec, a * sinA);
}

/**
 * Generates MediaPipe-compatible landmarks for an animated mannequin so the
 * whole try-on pipeline (rig, garments, physics) runs without a camera.
 */
export class SyntheticPose {
  pose: MannequinPose = 'relaxed';
  gender: Gender = 'women';
  /** User-controlled rotation (radians), e.g. from dragging. */
  userYaw = 0;
  autoRotate = true;
  private blend = { ...PRESETS.relaxed, wrist: PRESETS.relaxed.wrist.clone(), pole: PRESETS.relaxed.pole.clone() };
  private spin = 0;
  private yawNow = 0;
  private dims = { ...DIMS.women };
  private j: Record<string, Vector3> = {};

  constructor() {
    for (const k of ['sL', 'sR', 'eL', 'eR', 'wL', 'wR', 'hL', 'hR', 'kL', 'kR', 'aL', 'aR', 'nose', 'earL', 'earR', 'eyeL', 'eyeR', 'mL', 'mR', 'heelL', 'heelR', 'toeL', 'toeR', 'idxL', 'idxR', 'pinL', 'pinR', 'thL', 'thR'])
      this.j[k] = new Vector3();
  }

  generate(t: number, dt: number, width: number, height: number): PoseInput {
    const D = DIMS[this.gender];
    // morph dimensions smoothly when gender switches
    for (const k of Object.keys(D) as (keyof BodyDims)[]) this.dims[k] = lerp(this.dims[k], D[k], damp(5, dt));
    const d = this.dims;
    const target = PRESETS[this.pose];
    this.blend.wrist.lerp(target.wrist, damp(4, dt));
    this.blend.pole.lerp(target.pole, damp(4, dt));

    const J = this.j;
    const breathe = Math.sin(t * 1.6) * 0.004;
    const walk = this.pose === 'walk';
    const sway = walk ? 0 : Math.sin(t * 0.9) * 0.012;
    const step = walk ? Math.sin(t * 4.2) : 0;
    // pelvis
    J.hL.set(d.hipHalf + sway, d.hipY + Math.abs(step) * 0.012, 0);
    J.hR.set(-d.hipHalf + sway, d.hipY + Math.abs(step) * 0.012, 0);
    // legs
    const legSwing = 0.17 * step;
    J.kL.set(d.hipHalf * 1.02 + sway * 0.5, d.kneeY, 0.015 + legSwing);
    J.kR.set(-d.hipHalf * 1.02 + sway * 0.5, d.kneeY, 0.015 - legSwing);
    J.aL.set(d.hipHalf * 1.0, d.ankleY + Math.max(0, -step) * 0.05, -0.02 + legSwing * 1.6);
    J.aR.set(-d.hipHalf * 1.0, d.ankleY + Math.max(0, step) * 0.05, -0.02 - legSwing * 1.6);
    J.heelL.copy(J.aL).add(tmp.set(0, -0.05, -0.06));
    J.heelR.copy(J.aR).add(tmp.set(0, -0.05, -0.06));
    J.toeL.copy(J.aL).add(tmp.set(0.02, -0.07, 0.17));
    J.toeR.copy(J.aR).add(tmp.set(-0.02, -0.07, 0.17));
    // shoulders
    J.sL.set(d.shoulderHalf + sway * 0.4, d.shoulderY + breathe, 0);
    J.sR.set(-d.shoulderHalf + sway * 0.4, d.shoulderY + breathe, 0);
    // arms via IK (mirror x for the right arm)
    for (const side of [1, -1]) {
      const S = side > 0 ? J.sL : J.sR;
      const w = this.blend.wrist;
      const swing = walk ? -side * 0 + step * side * -0.12 : 0;
      tmp2.set(S.x + side * w.x, S.y + w.y, S.z + w.z + swing);
      const pole = new Vector3(side * this.blend.pole.x, this.blend.pole.y, this.blend.pole.z);
      ik(S, tmp2, d.upper, d.fore, pole, side > 0 ? J.eL : J.eR, side > 0 ? J.wL : J.wR);
      const W = side > 0 ? J.wL : J.wR;
      const E = side > 0 ? J.eL : J.eR;
      const fdir = tmp.copy(W).sub(E).normalize();
      (side > 0 ? J.idxL : J.idxR).copy(W).addScaledVector(fdir, 0.085).add(tmp2.set(-side * 0.012, 0, 0.012));
      (side > 0 ? J.pinL : J.pinR).copy(W).addScaledVector(fdir, 0.075).add(tmp2.set(side * 0.025, 0, -0.01));
      (side > 0 ? J.thL : J.thR).copy(W).addScaledVector(fdir, 0.045).add(tmp2.set(-side * 0.03, 0, 0.025));
    }
    // head
    const nod = Math.sin(t * 0.7) * 0.01;
    const ey = d.earY + breathe;
    J.earL.set(0.072 + sway * 0.3, ey, -0.005);
    J.earR.set(-0.072 + sway * 0.3, ey, -0.005);
    J.eyeL.set(0.033 + sway * 0.3, ey + 0.012 + nod, 0.085);
    J.eyeR.set(-0.033 + sway * 0.3, ey + 0.012 + nod, 0.085);
    J.nose.set(sway * 0.3, ey - 0.02 + nod, 0.105);
    J.mL.set(0.024 + sway * 0.3, ey - 0.065 + nod, 0.088);
    J.mR.set(-0.024 + sway * 0.3, ey - 0.065 + nod, 0.088);

    // yaw: user + gentle auto turn, or a continuous spin for "twirl"
    if (this.pose === 'twirl') this.spin += dt * 2.4;
    else this.spin = lerp(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2, damp(2, dt));
    const auto = this.autoRotate && this.pose !== 'twirl' ? Math.sin(t * 0.45) * 0.42 : 0;
    this.yawNow = this.userYaw + auto + this.spin;

    const order: Vector3[] = [
      J.nose, J.eyeL, J.eyeL, J.eyeL, J.eyeR, J.eyeR, J.eyeR, J.earL, J.earR, J.mL, J.mR,
      J.sL, J.sR, J.eL, J.eR, J.wL, J.wR, J.pinL, J.pinR, J.idxL, J.idxR, J.thL, J.thR,
      J.hL, J.hR, J.kL, J.kR, J.aL, J.aR, J.heelL, J.heelR, J.toeL, J.toeR,
    ];
    const cy = Math.cos(this.yawNow);
    const sy = Math.sin(this.yawNow);
    const ppm = (0.86 * height) / d.height;
    const floorY = height * 0.955;
    const pelvisY = d.hipY;
    const landmarks: LandmarkIn[] = [];
    const world: LandmarkIn[] = [];
    order.forEach((p, i) => {
      // eye inner/outer variants
      let x = p.x;
      if (i === 1 || i === 4) x -= Math.sign(p.x) * 0.012;
      if (i === 3 || i === 6) x += Math.sign(p.x) * 0.014;
      const X = x * cy + p.z * sy;
      const Z = -x * sy + p.z * cy;
      landmarks.push({ x: (width / 2 + X * ppm) / width, y: (floorY - p.y * ppm) / height, z: (-Z * ppm) / width, visibility: 0.99, presence: 0.99 });
      world.push({ x: X, y: -(p.y - pelvisY), z: -Z, visibility: 0.99 });
    });
    return { landmarks, world, width, height };
  }
}
