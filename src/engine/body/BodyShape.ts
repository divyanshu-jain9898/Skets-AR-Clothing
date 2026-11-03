import { Vector3 } from 'three';
import { Section } from './Section';
import type { BodyRig } from './BodyRig';
import { clamp, crScalar, crVec, lerp } from '../core/math';

/**
 * Body "height" coordinate used by every garment (roughly in shoulder-width
 * units of length along the body). Garments specify where they start/end in
 * these units, e.g. a kurta hem at H.KNEE.
 */
export const H = {
  NECK: 0,
  SHOULDER: 0.16,
  CHEST: 0.52,
  BUST: 0.72,
  WAIST: 1.06,
  HIGHHIP: 1.4,
  HIP: 1.71,
  CROTCH: 2.05,
  THIGH: 2.6,
  KNEE: 3.2,
  CALF: 3.85,
  ANKLE: 4.5,
  FLOOR: 4.68,
} as const;

const ANCHOR_H = [H.NECK, H.SHOULDER, H.CHEST, H.BUST, H.WAIST, H.HIGHHIP, H.HIP, H.CROTCH, H.THIGH, H.KNEE, H.CALF, H.ANKLE, H.FLOOR];
const A_HIP = 6;
/** Fraction of the shoulder->hip distance for torso anchors CHEST..HIGHHIP. */
const TORSO_F = [0, 0, 0.22, 0.36, 0.58, 0.8, 1];
/** Leg parameter (0 hip, 1 knee, 2 ankle) for lower anchors CROTCH..FLOOR. */
const LEG_T = [0.22, 0.6, 1, 1.45, 2, 2.14];

/**
 * Proportions measured from a calibration set (MediaPipe landmarks vs. person
 * segmentation silhouettes), expressed in shoulder-joint widths.
 */
export const PROP = {
  neckR: 0.235,
  shoulderHalf: 0.53,
  chestHalf: 0.5,
  bustHalf: 0.49,
  waistHalf: 0.43,
  highHipHalf: 0.49,
  hipHalf: 0.56,
  upperArmR: 0.15,
  elbowR: 0.125,
  forearmR: 0.12,
  wristR: 0.09,
  thighR: 0.26,
  kneeR: 0.165,
  calfR: 0.17,
  ankleR: 0.105,
};

export interface LimbPath {
  /** Control points along the limb axis. */
  pts: Vector3[];
  /** Base (skin) radius at each control point. */
  r: number[];
  /** Approximate visibility of the limb end (0..1). */
  vis: number;
}

const legRadius = (t: number) => {
  if (t <= 1) return lerp(PROP.thighR, PROP.kneeR, Math.pow(t, 0.8));
  if (t <= 1.45) return lerp(PROP.kneeR, PROP.calfR, (t - 1) / 0.45);
  return lerp(PROP.calfR, PROP.ankleR, clamp((t - 1.45) / 0.55, 0, 1));
};

/**
 * Per-frame analytic description of the wearer's body built from the rig:
 * torso/leg cross-sections, limb paths and the head ellipsoid. Garments,
 * cloth collisions and occluders are all derived from this.
 */
export class BodyShape {
  readonly anchors: Section[] = ANCHOR_H.map(() => new Section());
  readonly armL: LimbPath = { pts: Array.from({ length: 5 }, () => new Vector3()), r: [0, 0, 0, 0, 0], vis: 1 };
  readonly armR: LimbPath = { pts: Array.from({ length: 5 }, () => new Vector3()), r: [0, 0, 0, 0, 0], vis: 1 };
  readonly legL: LimbPath = { pts: Array.from({ length: 4 }, () => new Vector3()), r: [0, 0, 0, 0], vis: 1 };
  readonly legR: LimbPath = { pts: Array.from({ length: 4 }, () => new Vector3()), r: [0, 0, 0, 0], vis: 1 };
  readonly head = {
    c: new Vector3(),
    side: new Vector3(1, 0, 0),
    up: new Vector3(0, 1, 0),
    fwd: new Vector3(0, 0, 1),
    rx: 30,
    ry: 40,
    rz: 34,
    earW: 52,
    earMid: new Vector3(),
  };
  /** Extra outward growth per height bin registered by worn layers (for drape collisions). */
  readonly layerGrow = new Float32Array(64);
  sw = 120;
  /** Bust prominence 0..1 (set by women's garments) */
  bust = 0;
  private hipProj: number[] = [];
  private legProj: number[] = [];
  private legAxis = new Vector3(0, -1, 0);
  private hipMid = new Vector3();
  private torsoUp = new Vector3(0, 1, 0);
  private t1 = new Vector3();
  private t2 = new Vector3();
  private s0 = new Section();

  update(rig: BodyRig) {
    const sw = rig.sw;
    this.sw = sw;
    const A = this.anchors;
    const p = rig.p;
    this.hipMid.copy(rig.hipMid);
    this.torsoUp.copy(rig.up);
    const hipScale = Math.pow(clamp(rig.hw / sw / 0.57, 0.82, 1.3), 0.75);

    // ---- neck
    const neck = A[0];
    neck.c.copy(rig.neck);
    neck.up.copy(rig.headCenter).sub(rig.neck).normalize().add(rig.up).normalize();
    neck.side.copy(rig.side);
    neck.orthonormalize();
    neck.a = neck.bF = neck.bB = PROP.neckR * sw;
    neck.n = 2;

    // ---- torso anchors: interpolate shoulder & hip frames
    const half = [0, PROP.shoulderHalf, PROP.chestHalf, PROP.bustHalf, PROP.waistHalf * lerp(1, hipScale, 0.4), PROP.highHipHalf * lerp(1, hipScale, 0.7), PROP.hipHalf * hipScale];
    const dF = [0, 0.22, 0.31, 0.3 + this.bust * 0.06, 0.27, 0.27, 0.28];
    const dB = [0, 0.22, 0.27, 0.26, 0.25, 0.29, 0.33];
    const nn = [2, 2.7, 2.5, 2.4, 2.3, 2.35, 2.4];
    for (let k = 1; k <= A_HIP; k++) {
      const s = A[k];
      const f = TORSO_F[k];
      s.c.lerpVectors(rig.shoulderMid, rig.hipMid, f);
      if (k === 1) s.c.addScaledVector(rig.up, sw * 0.03).addScaledVector(rig.fwd, -sw * 0.03);
      s.up.copy(rig.up);
      s.side.copy(rig.side).lerp(rig.hipSide, f);
      s.orthonormalize();
      s.a = half[k] * sw;
      s.bF = dF[k] * sw;
      s.bB = dB[k] * sw;
      s.n = nn[k];
    }

    // ---- legs
    this.limbLeg(this.legL, p[23], p[25], p[27], p[31], rig.vis[27]);
    this.limbLeg(this.legR, p[24], p[26], p[28], p[32], rig.vis[28]);
    for (let i = 0; i < LEG_T.length; i++) {
      const s = A[A_HIP + 1 + i];
      const t = LEG_T[i];
      const pl = this.legPoint(this.legL, t, this.t1);
      const pr = this.legPoint(this.legR, t, this.t2);
      s.c.copy(pl).add(pr).multiplyScalar(0.5);
      s.side.copy(pl).sub(pr);
    }
    for (let i = 0; i < LEG_T.length; i++) {
      const k = A_HIP + 1 + i;
      const s = A[k];
      const t = LEG_T[i];
      s.up.copy(A[k - 1].c).sub(s.c);
      if (s.up.lengthSq() < 1e-6) s.up.copy(rig.up);
      s.up.normalize().lerp(rig.up, i === 0 ? 0.5 : 0.15).normalize();
      const span = s.side.length();
      if (span < sw * 0.05) s.side.copy(rig.hipSide);
      s.orthonormalize();
      // enclose both legs
      const pl = this.legPoint(this.legL, t, this.t1).sub(s.c);
      const pr = this.legPoint(this.legR, t, this.t2).sub(s.c);
      const r = legRadius(t) * sw;
      const xl = Math.abs(pl.dot(s.side));
      const xr = Math.abs(pr.dot(s.side));
      const zl = pl.dot(s.fwd);
      const zr = pr.dot(s.fwd);
      s.a = Math.max(xl, xr) + r;
      s.bF = Math.max(zl, zr, 0) + r * 0.95;
      s.bB = Math.max(-zl, -zr, 0) + r * 1.05;
      s.n = 2.2;
      if (i === 0) {
        s.a = Math.max(s.a, A[A_HIP].a * 0.96);
        s.bB = Math.max(s.bB, A[A_HIP].bB * 0.9);
      }
    }

    // ---- arms
    this.limbArm(this.armL, rig, 11, 13, 15, rig.handL, rig.vis[15]);
    this.limbArm(this.armR, rig, 12, 14, 16, rig.handR, rig.vis[16]);

    // ---- head ellipsoid
    const hd = this.head;
    hd.earW = rig.headW;
    hd.earMid.copy(rig.earMid);
    hd.side.copy(rig.headSide);
    hd.up.copy(rig.headUp);
    hd.fwd.copy(rig.headFwd);
    hd.c.copy(rig.earMid).addScaledVector(hd.up, rig.headW * 0.22).addScaledVector(hd.fwd, rig.headW * 0.04);
    hd.rx = rig.headW * 0.58;
    hd.ry = rig.headW * 0.8;
    hd.rz = rig.headW * 0.68;

    // ---- projections for height lookups
    this.hipProj.length = 0;
    for (let k = 0; k <= A_HIP; k++) this.hipProj.push(this.t1.copy(A[k].c).sub(this.hipMid).dot(this.torsoUp));
    this.legAxis.copy(rig.ankleMid).sub(rig.hipMid);
    if (this.legAxis.lengthSq() < 1e-6) this.legAxis.set(0, -1, 0);
    this.legAxis.normalize();
    this.legProj.length = 0;
    for (let k = A_HIP; k < A.length; k++) this.legProj.push(this.t1.copy(A[k].c).sub(this.hipMid).dot(this.legAxis));
    this.layerGrow.fill(0);
  }

  private limbArm(L: LimbPath, rig: BodyRig, s: number, e: number, w: number, hand: Vector3, vis: number) {
    const sw = rig.sw;
    const S = rig.p[s];
    L.pts[0].copy(S).lerp(rig.neck, 0.32).addScaledVector(rig.up, -sw * 0.14);
    L.pts[1].copy(S).addScaledVector(rig.up, -sw * 0.12);
    L.pts[2].copy(rig.p[e]);
    L.pts[3].copy(rig.p[w]);
    L.pts[4].copy(hand);
    L.r[0] = PROP.upperArmR * 1.0 * sw;
    L.r[1] = PROP.upperArmR * sw;
    L.r[2] = PROP.elbowR * sw;
    L.r[3] = PROP.wristR * sw;
    L.r[4] = PROP.wristR * 1.05 * sw;
    L.vis = vis;
  }

  private limbLeg(L: LimbPath, hip: Vector3, knee: Vector3, ankle: Vector3, foot: Vector3, vis: number) {
    L.pts[0].copy(hip);
    L.pts[1].copy(knee);
    L.pts[2].copy(ankle);
    L.pts[3].copy(ankle).lerp(foot, 0.35);
    L.r[0] = PROP.thighR * this.sw;
    L.r[1] = PROP.kneeR * this.sw;
    L.r[2] = PROP.ankleR * this.sw;
    L.r[3] = PROP.ankleR * this.sw;
    L.vis = vis;
  }

  /** Point along a leg: t=0 hip, 1 knee, 2 ankle, >2 extrapolated. */
  legPoint(L: LimbPath, t: number, out: Vector3) {
    if (t <= 1) return out.lerpVectors(L.pts[0], L.pts[1], t);
    if (t <= 2) return out.lerpVectors(L.pts[1], L.pts[2], t - 1);
    return out.copy(L.pts[2]).sub(L.pts[1]).multiplyScalar(t - 2).add(L.pts[2]);
  }

  /** Interpolated section at height h (smooth Catmull-Rom between anchors). */
  sectionAt(h: number, out: Section): Section {
    const A = this.anchors;
    const n = ANCHOR_H.length;
    let k = 0;
    if (h <= ANCHOR_H[0]) {
      out.copy(A[0]);
      const d = h - ANCHOR_H[0];
      if (d < 0) out.c.addScaledVector(A[0].up, -d * this.sw);
      return out;
    }
    if (h >= ANCHOR_H[n - 1]) {
      out.copy(A[n - 1]);
      out.c.addScaledVector(A[n - 1].up, -(h - ANCHOR_H[n - 1]) * this.sw);
      return out;
    }
    while (k < n - 2 && h > ANCHOR_H[k + 1]) k++;
    const t = (h - ANCHOR_H[k]) / (ANCHOR_H[k + 1] - ANCHOR_H[k]);
    const a0 = A[Math.max(0, k - 1)];
    const a1 = A[k];
    const a2 = A[k + 1];
    const a3 = A[Math.min(n - 1, k + 2)];
    crVec(a0.c, a1.c, a2.c, a3.c, t, out.c);
    out.up.lerpVectors(a1.up, a2.up, t);
    out.side.lerpVectors(a1.side, a2.side, t);
    out.orthonormalize();
    out.a = crScalar(a0.a, a1.a, a2.a, a3.a, t);
    out.bF = crScalar(a0.bF, a1.bF, a2.bF, a3.bF, t);
    out.bB = crScalar(a0.bB, a1.bB, a2.bB, a3.bB, t);
    out.n = lerp(a1.n, a2.n, t);
    return out;
  }

  /** Approximate body height coordinate of an arbitrary scene point. */
  heightOf(p: Vector3): number {
    const d = this.t1.copy(p).sub(this.hipMid);
    const yUp = d.dot(this.torsoUp);
    if (yUp >= 0) {
      const P = this.hipProj; // index 0 = neck ... A_HIP = hip (0)
      for (let k = A_HIP; k > 0; k--) {
        if (yUp <= P[k - 1]) {
          const t = (yUp - P[k]) / Math.max(1e-3, P[k - 1] - P[k]);
          return lerp(ANCHOR_H[k], ANCHOR_H[k - 1], t);
        }
      }
      return ANCHOR_H[0] - (yUp - P[0]) / this.sw;
    }
    const yd = d.dot(this.legAxis);
    const P = this.legProj; // 0 = hip
    for (let k = 1; k < P.length; k++) {
      if (yd <= P[k]) {
        const t = (yd - P[k - 1]) / Math.max(1e-3, P[k] - P[k - 1]);
        return lerp(ANCHOR_H[A_HIP + k - 1], ANCHOR_H[A_HIP + k], t);
      }
    }
    return ANCHOR_H[ANCHOR_H.length - 1];
  }

  /** Register that a worn layer extends `grow` px beyond the body at heights [h0,h1]. */
  registerLayer(h0: number, h1: number, grow: number) {
    const bins = this.layerGrow.length;
    for (let i = 0; i < bins; i++) {
      const h = (i / (bins - 1)) * H.FLOOR;
      if (h >= h0 - 0.05 && h <= h1 + 0.05) this.layerGrow[i] = Math.max(this.layerGrow[i], grow);
    }
  }

  layerAt(h: number) {
    const i = Math.round(clamp(h / H.FLOOR, 0, 1) * (this.layerGrow.length - 1));
    return this.layerGrow[i];
  }

  /**
   * Keeps a point outside the clothed body. mode: 0 = nearest surface,
   * 1 = force to the front, -1 = force to the back.
   * Returns true when the point was moved.
   */
  pushOut(p: Vector3, margin: number, mode: 0 | 1 | -1 = 0): boolean {
    const h = this.heightOf(p);
    if (h < -0.6) return false;
    const s = this.sectionAt(h, this.s0);
    const grow = this.layerAt(h) + margin;
    const d = this.t2.copy(p).sub(s.c);
    const x = d.dot(s.side);
    const z = d.dot(s.fwd);
    const y = d.dot(s.up);
    const a = s.a + grow;
    let ax = Math.abs(x) / a;
    if (mode < 0 && h > H.CHEST && ax > 1.1) {
      // drapes hanging down the back fall behind the body, not out to the side
      const xc = Math.sign(x) * a * 1.1;
      s.fromLocal(xc, y, Math.min(z, -(s.bB + grow) * 0.35), p);
      return true;
    }
    if (mode !== 0) {
      ax = Math.min(ax, 0.999);
      if (Math.abs(x) / a >= 1) return false;
      const b = (mode > 0 ? s.bF : s.bB) + grow;
      const zs = b * Math.pow(1 - Math.pow(ax, s.n), 1 / s.n);
      if (mode > 0 && z < zs) {
        s.fromLocal(x, y, zs, p);
        return true;
      }
      if (mode < 0 && z > -zs) {
        s.fromLocal(x, y, -zs, p);
        return true;
      }
      return false;
    }
    const b = (z >= 0 ? s.bF : s.bB) + grow;
    const r = Math.pow(ax, s.n) + Math.pow(Math.abs(z) / b, s.n);
    if (r >= 1) return false;
    if (r < 1e-6) {
      s.fromLocal(x, y, b, p);
      return true;
    }
    const k = Math.pow(r, -1 / s.n);
    s.fromLocal(x * k, y, z * k, p);
    return true;
  }

  /** Pushes a point out of a capsule (segment a-b, radius r). */
  static pushOutCapsule(p: Vector3, a: Vector3, b: Vector3, r: number, tmp: Vector3): boolean {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;
    const l2 = abx * abx + aby * aby + abz * abz || 1;
    let t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2;
    t = clamp(t, 0, 1);
    tmp.set(a.x + abx * t, a.y + aby * t, a.z + abz * t);
    const dx = p.x - tmp.x;
    const dy = p.y - tmp.y;
    const dz = p.z - tmp.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2) || 1e-3;
    p.set(tmp.x + (dx / d) * r, tmp.y + (dy / d) * r, tmp.z + (dz / d) * r);
    return true;
  }
}
