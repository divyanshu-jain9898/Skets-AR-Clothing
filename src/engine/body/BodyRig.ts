import { Vector3 } from 'three';
import { OneEuroFilter } from '../tracking/OneEuro';
import type { PoseInput } from '../core/types';
import { clamp, damp, smoothstep } from '../core/math';

export const LM = {
  NOSE: 0,
  L_EYE: 2,
  R_EYE: 5,
  L_EAR: 7,
  R_EAR: 8,
  MOUTH_L: 9,
  MOUTH_R: 10,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_PINKY: 17,
  R_PINKY: 18,
  L_INDEX: 19,
  R_INDEX: 20,
  L_THUMB: 21,
  R_THUMB: 22,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28,
  L_HEEL: 29,
  R_HEEL: 30,
  L_FOOT: 31,
  R_FOOT: 32,
} as const;

const N = 33;
/** Left/right landmark pairs (MediaPipe pose topology). */
const LR_PAIRS: [number, number][] = [
  [1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22],
  [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
];
const swapL: PoseInput['landmarks'] = [];
const swapW: PoseInput['world'] = [];
/**
 * After someone turns round, the tracker sometimes keeps left/right swapped.
 * If the face is clearly visible the person faces the camera, so their left
 * shoulder must appear on the image's right: otherwise swap every pair back.
 */
function fixLeftRight(input: PoseInput): PoseInput {
  const L = input.landmarks;
  const v = (i: number) => L[i].visibility ?? 1;
  const faceVisible = v(0) > 0.75 && v(2) > 0.6 && v(5) > 0.6;
  if (!faceVisible || L[11].x >= L[12].x) return input;
  swapL.length = 0;
  swapW.length = 0;
  for (let i = 0; i < N; i++) {
    swapL.push(L[i]);
    swapW.push(input.world[i]);
  }
  for (const [a, b] of LR_PAIRS) {
    swapL[a] = L[b];
    swapL[b] = L[a];
    swapW[a] = input.world[b];
    swapW[b] = input.world[a];
  }
  return { ...input, landmarks: swapL, world: swapW };
}
/** Landmark pairs used to estimate pixels-per-metre: [a, b, weight]. */
const SCALE_PAIRS: [number, number, number][] = [
  [11, 12, 1.0],
  [11, 23, 1.0],
  [12, 24, 1.0],
  [23, 24, 0.5],
  [11, 13, 0.5],
  [12, 14, 0.5],
  [13, 15, 0.3],
  [14, 16, 0.3],
];
/** Landmarks belonging to fast-moving extremities get a more responsive filter. */
const EXTREMITY = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 26, 27, 28, 29, 30, 31, 32]);

interface Metrics {
  sw: number;
  hw: number;
  tl: number;
  thigh: number;
  shin: number;
  upperArm: number;
  forearm: number;
  head: number;
}

/**
 * Converts raw pose landmarks into a smoothed, scene-space body rig.
 *
 * Scene space = source-frame pixels, origin at frame centre, X right, Y up,
 * Z towards the viewer. X/Y come from the 2D landmarks (pixel exact so
 * garments line up with the video) and Z from MediaPipe's metric world
 * landmarks scaled into pixels, which gives a consistent 3D skeleton for
 * orientation, depth ordering and occlusion.
 */
export class BodyRig {
  readonly p: Vector3[] = Array.from({ length: N }, () => new Vector3());
  readonly vis = new Float32Array(N);
  private raw: Vector3[] = Array.from({ length: N }, () => new Vector3());
  private fx = Array.from({ length: N }, (_, i) => new OneEuroFilter(EXTREMITY.has(i) ? 2.2 : 1.4, 0.012, 1));
  private fy = Array.from({ length: N }, (_, i) => new OneEuroFilter(EXTREMITY.has(i) ? 2.2 : 1.4, 0.012, 1));
  private fz = Array.from({ length: N }, () => new OneEuroFilter(0.7, 0.004, 1));

  frameW = 1280;
  frameH = 720;
  /** Pixels per metre (smoothed). */
  scale = 400;
  /** 0..1, how confidently a body is present (smoothed). */
  presence = 0;
  hasPose = false;
  /** True for one update after the body re-appeared far from where it was. */
  jumped = false;
  /** Seconds since the rig was last fed a pose. */
  lostFor = 0;

  // Derived points
  readonly shoulderMid = new Vector3();
  readonly hipMid = new Vector3();
  readonly neck = new Vector3();
  readonly headCenter = new Vector3();
  readonly earMid = new Vector3();
  readonly eyeMid = new Vector3();
  readonly mouthMid = new Vector3();
  readonly handL = new Vector3();
  readonly handR = new Vector3();
  readonly kneeMid = new Vector3();
  readonly ankleMid = new Vector3();

  // Frames
  readonly up = new Vector3(0, 1, 0);
  readonly side = new Vector3(1, 0, 0);
  readonly fwd = new Vector3(0, 0, 1);
  readonly hipSide = new Vector3(1, 0, 0);
  readonly hipFwd = new Vector3(0, 0, 1);
  readonly headSide = new Vector3(1, 0, 0);
  readonly headUp = new Vector3(0, 1, 0);
  readonly headFwd = new Vector3(0, 0, 1);

  // Measurements in scene pixels
  sw = 120;
  hw = 68;
  tl = 185;
  thigh = 160;
  shin = 150;
  upperArm = 105;
  forearm = 90;
  headW = 52;

  yaw = 0;
  yawRate = 0;
  readonly hipVel = new Vector3();

  private m: Metrics = { sw: 0.33, hw: 0.2, tl: 0.47, thigh: 0.42, shin: 0.4, upperArm: 0.28, forearm: 0.25, head: 0.15 };
  private prevHip = new Vector3();
  private prevYaw = 0;
  private t = 0;
  private tmp = new Vector3();
  private tmp2 = new Vector3();

  /** Forget filter history (new source, photo mode, re-detection). */
  reset() {
    for (let i = 0; i < N; i++) {
      this.fx[i].reset();
      this.fy[i].reset();
      this.fz[i].reset();
    }
    this.hasPose = false;
    this.presence = 0;
  }

  /**
   * @param input pose observation or null when nobody was detected
   * @param t     timestamp in seconds
   * @param snap  bypass smoothing (single photos)
   */
  update(input: PoseInput | null, t: number, snap = false) {
    const dt = clamp(t - this.t, 1 / 240, 0.25);
    this.t = t;
    this.jumped = false;
    if (!input) {
      this.lostFor += dt;
      this.presence = Math.max(0, this.presence - dt * 2.5);
      if (this.lostFor > 0.6) this.hasPose = false;
      return;
    }
    input = fixLeftRight(input);
    const wasLost = !this.hasPose || this.lostFor > 0.6;
    this.lostFor = 0;
    this.frameW = input.width;
    this.frameH = input.height;
    const W = input.width;
    const H = input.height;
    const L = input.landmarks;
    const Wl = input.world;

    // --- pixels per metre from bone lengths (image px vs world metres)
    let num = 0;
    let den = 0;
    for (const [a, b, w0] of SCALE_PAIRS) {
      const w = w0 * Math.min(L[a].visibility ?? 1, L[b].visibility ?? 1);
      if (w < 0.2) continue;
      const img = Math.hypot((L[a].x - L[b].x) * W, (L[a].y - L[b].y) * H);
      const wrl = Math.hypot(Wl[a].x - Wl[b].x, Wl[a].y - Wl[b].y);
      if (wrl < 0.03) continue;
      num += w * img;
      den += w * wrl;
    }
    if (den > 0) {
      const s = num / den;
      this.scale = snap || wasLost ? s : this.scale + (s - this.scale) * damp(3, dt);
    }

    // --- learned body metrics (metres); slow EMA, only from well-visible landmarks
    const vis = (i: number) => L[i].visibility ?? 1;
    const wd = (a: number, b: number) => Math.hypot(Wl[a].x - Wl[b].x, Wl[a].y - Wl[b].y, Wl[a].z - Wl[b].z);
    const k = snap ? 1 : damp(wasLost ? 4 : 0.8, dt);
    const learn = (key: keyof Metrics, value: number, ok: boolean) => {
      if (ok && Number.isFinite(value) && value > 0.02) this.m[key] += (value - this.m[key]) * k;
    };
    const shOK = vis(11) > 0.6 && vis(12) > 0.6;
    const hipOK = vis(23) > 0.6 && vis(24) > 0.6;
    learn('sw', wd(11, 12), shOK);
    learn('hw', wd(23, 24), hipOK);
    if (shOK && hipOK) {
      const tl = Math.hypot(
        (Wl[11].x + Wl[12].x - Wl[23].x - Wl[24].x) / 2,
        (Wl[11].y + Wl[12].y - Wl[23].y - Wl[24].y) / 2,
        (Wl[11].z + Wl[12].z - Wl[23].z - Wl[24].z) / 2,
      );
      learn('tl', tl, true);
    }
    learn('thigh', (wd(23, 25) + wd(24, 26)) / 2, Math.min(vis(23), vis(24), vis(25), vis(26)) > 0.6);
    learn('shin', (wd(25, 27) + wd(26, 28)) / 2, Math.min(vis(25), vis(26), vis(27), vis(28)) > 0.6);
    learn('upperArm', (wd(11, 13) + wd(12, 14)) / 2, Math.min(vis(13), vis(14)) > 0.6);
    learn('forearm', (wd(13, 15) + wd(14, 16)) / 2, Math.min(vis(15), vis(16)) > 0.6);
    learn('head', wd(7, 8), vis(7) > 0.5 && vis(8) > 0.5);
    // Keep metrics anatomically plausible relative to shoulder width.
    const m = this.m;
    m.hw = clamp(m.hw, m.sw * 0.42, m.sw * 0.8);
    m.tl = clamp(m.tl, m.sw * 1.15, m.sw * 1.9);
    m.thigh = clamp(m.thigh, m.sw * 0.95, m.sw * 1.6);
    m.shin = clamp(m.shin, m.sw * 0.9, m.sw * 1.5);
    m.head = clamp(m.head, m.sw * 0.32, m.sw * 0.55);
    const sc = this.scale;
    this.sw = m.sw * sc;
    this.hw = m.hw * sc;
    this.tl = m.tl * sc;
    this.thigh = m.thigh * sc;
    this.shin = m.shin * sc;
    this.upperArm = m.upperArm * sc;
    this.forearm = m.forearm * sc;
    this.headW = m.head * sc;

    // --- raw scene positions
    for (let i = 0; i < N; i++) {
      this.raw[i].set((L[i].x - 0.5) * W, (0.5 - L[i].y) * H, -Wl[i].z * sc);
    }
    this.applyFallbacks(L);

    // --- temporal filtering
    const betaScale = 720 / Math.max(240, H);
    const tf = t;
    for (let i = 0; i < N; i++) {
      const r = this.raw[i];
      const v = L[i].visibility ?? 1;
      if (snap || wasLost) {
        this.fx[i].reset(r.x, tf);
        this.fy[i].reset(r.y, tf);
        this.fz[i].reset(r.z, tf);
        this.p[i].copy(r);
        this.vis[i] = v;
      } else {
        this.fx[i].beta = this.fy[i].beta = 0.012 * betaScale;
        this.p[i].set(this.fx[i].filter(r.x, tf), this.fy[i].filter(r.y, tf), this.fz[i].filter(r.z, tf));
        this.vis[i] += (v - this.vis[i]) * damp(8, dt);
      }
    }

    this.derive(dt, snap || wasLost);
    // re-acquired after losing the body: physics must restart from the new pose
    if (wasLost) this.jumped = true;
    this.hasPose = true;
    const conf = Math.min(this.vis[11], this.vis[12]);
    const target = conf > 0.35 ? 1 : 0;
    this.presence = snap ? target : this.presence + (target - this.presence) * damp(6, dt);
  }

  /** Replace unreliable lower-body landmarks with proportion-based estimates. */
  private applyFallbacks(L: PoseInput['landmarks']) {
    const r = this.raw;
    const v = (i: number) => L[i].visibility ?? 1;
    const sMid = this.tmp.copy(r[11]).add(r[12]).multiplyScalar(0.5);
    // in-plane "down" perpendicular to the shoulder line
    const sx = r[11].x - r[12].x;
    const sy = r[11].y - r[12].y;
    const sl = Math.hypot(sx, sy) || 1;
    const down = this.tmp2.set(sy / sl, -sx / sl, 0);
    if (down.y > 0) down.negate();
    const side2x = sx / sl;
    const side2y = sy / sl;

    const blend = (i: number, ex: number, ey: number, ez: number) => {
      const w = smoothstep(0.04, 0.3, v(i));
      r[i].set(ex + (r[i].x - ex) * w, ey + (r[i].y - ey) * w, ez + (r[i].z - ez) * w);
    };
    // hips
    const hx = sMid.x + down.x * this.tl;
    const hy = sMid.y + down.y * this.tl;
    blend(23, hx + side2x * this.hw * 0.5, hy + side2y * this.hw * 0.5, r[11].z * 0.3);
    blend(24, hx - side2x * this.hw * 0.5, hy - side2y * this.hw * 0.5, r[12].z * 0.3);
    // knees, ankles, feet follow from the (possibly estimated) hips
    for (const [hip, knee, ankle, heel, foot] of [
      [23, 25, 27, 29, 31],
      [24, 26, 28, 30, 32],
    ]) {
      blend(knee, r[hip].x + down.x * this.thigh, r[hip].y + down.y * this.thigh, r[hip].z);
      blend(ankle, r[knee].x + down.x * this.shin, r[knee].y + down.y * this.shin, r[knee].z);
      blend(heel, r[ankle].x, r[ankle].y - this.sw * 0.1, r[ankle].z - this.sw * 0.12);
      blend(foot, r[ankle].x, r[ankle].y - this.sw * 0.12, r[ankle].z + this.sw * 0.35);
    }
  }

  private derive(dt: number, snap: boolean) {
    const p = this.p;
    this.shoulderMid.copy(p[11]).add(p[12]).multiplyScalar(0.5);
    this.hipMid.copy(p[23]).add(p[24]).multiplyScalar(0.5);
    this.kneeMid.copy(p[25]).add(p[26]).multiplyScalar(0.5);
    this.ankleMid.copy(p[27]).add(p[28]).multiplyScalar(0.5);

    // torso frame
    this.up.copy(this.shoulderMid).sub(this.hipMid);
    if (this.up.lengthSq() < 1e-6) this.up.set(0, 1, 0);
    this.up.normalize();
    this.side.copy(p[11]).sub(p[12]);
    this.side.addScaledVector(this.up, -this.side.dot(this.up));
    if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0);
    this.side.normalize();
    this.fwd.crossVectors(this.side, this.up).normalize();

    this.hipSide.copy(p[23]).sub(p[24]);
    this.hipSide.addScaledVector(this.up, -this.hipSide.dot(this.up));
    if (this.hipSide.lengthSq() < 1e-6) this.hipSide.copy(this.side);
    this.hipSide.normalize();
    // keep hips from flipping relative to shoulders (left/right confusions)
    if (this.hipSide.dot(this.side) < 0) this.hipSide.copy(this.side);
    this.hipFwd.crossVectors(this.hipSide, this.up).normalize();

    // head
    this.earMid.copy(p[7]).add(p[8]).multiplyScalar(0.5);
    this.eyeMid.copy(p[2]).add(p[5]).multiplyScalar(0.5);
    this.mouthMid.copy(p[9]).add(p[10]).multiplyScalar(0.5);
    this.headSide.copy(p[7]).sub(p[8]);
    if (this.headSide.lengthSq() < 1e-6) this.headSide.copy(this.side);
    this.headSide.normalize();
    if (this.headSide.dot(this.side) < -0.2) this.headSide.copy(this.side);
    this.headUp.copy(this.eyeMid).sub(this.mouthMid);
    this.headUp.addScaledVector(this.headSide, -this.headUp.dot(this.headSide));
    if (this.headUp.lengthSq() < 1e-6) this.headUp.copy(this.up);
    this.headUp.normalize();
    // the eye-mouth line leans forward ~15deg relative to the skull axis
    this.headFwd.crossVectors(this.headSide, this.headUp).normalize();
    this.headUp.addScaledVector(this.headFwd, 0.25).normalize();
    this.headFwd.crossVectors(this.headSide, this.headUp).normalize();
    this.headCenter
      .copy(this.earMid)
      .addScaledVector(this.headUp, this.headW * 0.12)
      .addScaledVector(this.headFwd, -this.headW * 0.05);

    // neck base (collar line)
    this.neck
      .copy(this.shoulderMid)
      .addScaledVector(this.up, this.sw * 0.17)
      .addScaledVector(this.fwd, -this.sw * 0.04);

    // palm centres
    this.handL.copy(p[15]).add(p[17]).add(p[19]).multiplyScalar(1 / 3);
    this.handR.copy(p[16]).add(p[18]).add(p[20]).multiplyScalar(1 / 3);

    // body yaw + angular rate (used for skirt twirl)
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    if (snap) {
      this.prevYaw = yaw;
      this.yawRate = 0;
      this.hipVel.set(0, 0, 0);
      this.prevHip.copy(this.hipMid);
    }
    let dy = yaw - this.prevYaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    this.yawRate += (dy / dt - this.yawRate) * damp(10, dt);
    this.prevYaw = yaw;
    this.yaw = yaw;
    this.tmp.copy(this.hipMid).sub(this.prevHip).divideScalar(dt);
    this.hipVel.lerp(this.tmp, damp(10, dt));
    this.prevHip.copy(this.hipMid);
  }

  /** Approximate 2D bounding box of the visible body in scene units. */
  bounds(out: { minX: number; maxX: number; minY: number; maxY: number }) {
    out.minX = out.minY = Infinity;
    out.maxX = out.maxY = -Infinity;
    for (let i = 0; i < N; i++) {
      if (this.vis[i] < 0.3) continue;
      const q = this.p[i];
      out.minX = Math.min(out.minX, q.x);
      out.maxX = Math.max(out.maxX, q.x);
      out.minY = Math.min(out.minY, q.y);
      out.maxY = Math.max(out.maxY, q.y);
    }
    return out;
  }
}
