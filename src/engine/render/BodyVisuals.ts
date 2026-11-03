import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import { GridMesh } from '../garments/GridMesh';
import { samplePath } from '../garments/Garment';
import { SectionTable, writeTube } from '../garments/helpers';
import { H, type BodyShape, type LimbPath } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import { Section } from '../body/Section';
import { TAU } from '../core/math';

const v0 = new Vector3();
const v1 = new Vector3();
const q = new Quaternion();
const m4 = new Matrix4();
const sc = new Vector3();
const Yaxis = new Vector3(0, 1, 0);
const sec = new Section();

const ca = new Vector3();
const cb = new Vector3();
const cdir = new Vector3();
const cmid = new Vector3();
/** Orients a unit cylinder between a and b (inputs may alias module temps). */
function placeCapsule(mesh: Mesh, a: Vector3, b: Vector3, r: number) {
  ca.copy(a);
  cb.copy(b);
  cdir.copy(cb).sub(ca);
  const len = Math.max(1e-3, cdir.length());
  q.setFromUnitVectors(Yaxis, cdir.divideScalar(len));
  cmid.copy(ca).add(cb).multiplyScalar(0.5);
  m4.compose(cmid, q, sc.set(r, len, r));
  mesh.matrix.copy(m4);
  mesh.matrixWorldNeedsUpdate = true;
}

function placeEllipsoid(mesh: Mesh, c: Vector3, side: Vector3, up: Vector3, fwd: Vector3, rx: number, ry: number, rz: number) {
  m4.makeBasis(side, up, fwd);
  m4.scale(sc.set(rx, ry, rz));
  m4.setPosition(c);
  mesh.matrix.copy(m4);
  mesh.matrixWorldNeedsUpdate = true;
}

/**
 * Invisible depth-only proxies of the real body. They write depth but no
 * colour, so garment fragments behind the user's actual head, neck, arms
 * and hands are discarded and the camera image shows through - e.g. a hand
 * resting on the chest stays in front of the kurta.
 */
export class Occluders {
  readonly group = new Group();
  private mat = new MeshBasicMaterial({ colorWrite: false });
  private head: Mesh;
  private neck: Mesh;
  private limbs: Mesh[] = [];
  private hands: Mesh[] = [];
  private joints: Mesh[] = [];

  constructor() {
    const sphere = new SphereGeometry(1, 20, 14);
    const cyl = new CylinderGeometry(1, 1, 1, 14, 1, true);
    const mk = (g: BufferGeometry) => {
      const m = new Mesh(g, this.mat);
      m.matrixAutoUpdate = false;
      m.frustumCulled = false;
      m.renderOrder = -5;
      this.group.add(m);
      return m;
    };
    this.head = mk(sphere);
    this.neck = mk(cyl);
    for (let i = 0; i < 4; i++) this.limbs.push(mk(cyl));
    for (let i = 0; i < 2; i++) this.hands.push(mk(sphere));
    for (let i = 0; i < 4; i++) this.joints.push(mk(sphere));
  }

  update(rig: BodyRig, shape: BodyShape) {
    const hd = shape.head;
    placeEllipsoid(this.head, hd.c, hd.side, hd.up, hd.fwd, hd.rx * 0.98, hd.ry * 1.05, hd.rz);
    const neck = shape.anchors[0];
    placeCapsule(this.neck, neck.c, v1.copy(hd.c).addScaledVector(hd.up, -hd.ry * 0.3), neck.a * 0.86);
    const arms: LimbPath[] = [shape.armL, shape.armR];
    arms.forEach((L, k) => {
      placeCapsule(this.limbs[k * 2], L.pts[1], L.pts[2], L.r[1] * 0.85);
      placeCapsule(this.limbs[k * 2 + 1], L.pts[2], L.pts[3], L.r[2] * 0.85);
      const j0 = this.joints[k * 2];
      const j1 = this.joints[k * 2 + 1];
      m4.makeScale(L.r[2] * 0.85, L.r[2] * 0.85, L.r[2] * 0.85).setPosition(L.pts[2]);
      j0.matrix.copy(m4);
      m4.makeScale(L.r[3], L.r[3], L.r[3]).setPosition(L.pts[3]);
      j1.matrix.copy(m4);
      j0.matrixWorldNeedsUpdate = j1.matrixWorldNeedsUpdate = true;
      // hand: ellipsoid from wrist towards palm centre
      const wrist = L.pts[3];
      const palm = L.pts[4];
      const len = wrist.distanceTo(palm);
      const r = Math.max(len * 1.05, rig.sw * 0.1);
      placeCapsule(this.hands[k], wrist, v0.copy(palm).sub(wrist).multiplyScalar(1.6).add(wrist), r * 0.85);
    });
  }
}

/** Display mannequin used in 3D preview mode. */
export class Mannequin {
  readonly group = new Group();
  private torso: GridMesh;
  private table = new SectionTable(60);
  private arms: { grid: GridMesh; rowU: number[]; limb: 'L' | 'R' }[] = [];
  private legs: { grid: GridMesh; rowT: number[]; limb: 'L' | 'R' }[] = [];
  private head: Mesh;
  private hands: Mesh[] = [];
  private feet: Mesh[] = [];
  private hTop = -0.55;
  private hBot = H.CROTCH + 0.05;

  constructor(material: Material) {
    const rows = 34;
    const cols = 40;
    this.torso = new GridMesh(rows, cols, true, [{ r0: 0, r1: rows - 1, material: 0, uv: 'body' }], 1, 1);
    this.add(new Mesh(this.torso.geometry, material));
    const sphere = new SphereGeometry(1, 28, 20);
    this.head = this.add(new Mesh(sphere, material));
    for (const limb of ['L', 'R'] as const) {
      const rowU = Array.from({ length: 20 }, (_, i) => 0.35 + (i / 19) * 2.75);
      const grid = new GridMesh(rowU.length, 18, true, [{ r0: 0, r1: rowU.length - 1, material: 0, uv: 'body' }], 1, 1);
      this.add(new Mesh(grid.geometry, material));
      this.arms.push({ grid, rowU, limb });
      const rowT = Array.from({ length: 22 }, (_, i) => 0.05 + (i / 21) * 2.0);
      const lg = new GridMesh(rowT.length, 20, true, [{ r0: 0, r1: rowT.length - 1, material: 0, uv: 'body' }], 1, 1);
      this.add(new Mesh(lg.geometry, material));
      this.legs.push({ grid: lg, rowT, limb });
      this.hands.push(this.add(new Mesh(sphere, material)));
      this.feet.push(this.add(new Mesh(sphere, material)));
    }
  }

  private add<T extends Mesh>(m: T): T {
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    this.group.add(m);
    return m;
  }

  update(rig: BodyRig, shape: BodyShape) {
    const g = this.torso;
    this.table.build(shape, this.hTop, this.hBot);
    for (let i = 0; i < g.rows; i++) {
      const h = this.hTop + (this.hBot - this.hTop) * (i / (g.rows - 1));
      const s = this.table.sample(h, sec);
      // neck column is slimmer than the collar ring
      const neckSlim = h < 0.02 ? 0.74 : h < 0.12 ? 0.74 + (h - 0.02) * 2.6 : 1;
      for (let j = 0; j < g.cols; j++) {
        const th = (j / g.cols) * TAU;
        const sn = Math.sin(th);
        const cs = Math.cos(th);
        const ex = 2 / s.n;
        const x = Math.sign(sn) * Math.pow(Math.abs(sn), ex) * s.a * neckSlim * 0.97;
        const z = Math.sign(cs) * Math.pow(Math.abs(cs), ex) * (cs >= 0 ? s.bF : s.bB) * neckSlim * 0.97;
        v0.copy(s.c).addScaledVector(s.side, x).addScaledVector(s.fwd, z);
        g.set(i, j, v0);
      }
    }
    g.computeNormals();
    g.commit();
    for (const a of this.arms) {
      const L = a.limb === 'L' ? shape.armL : shape.armR;
      writeTube(a.grid, a.rowU, (u, out) => samplePath(L.pts, u, out), (u) => {
        const k = Math.min(3, Math.floor(u));
        const t = u - k;
        return (L.r[k] + (L.r[Math.min(4, k + 1)] - L.r[k]) * t) * 0.92;
      }, rig.fwd);
    }
    for (const l of this.legs) {
      const L = l.limb === 'L' ? shape.legL : shape.legR;
      writeTube(l.grid, l.rowT, (t, out) => shape.legPoint(L, t, out), (t) => {
        const base = t <= 1 ? L.r[0] + (L.r[1] - L.r[0]) * Math.pow(t, 0.8) : L.r[1] + (L.r[2] - L.r[1]) * (t - 1);
        const calf = t > 1 ? Math.sin(Math.min(1, (t - 1) / 0.8) * Math.PI) * 0.03 * rig.sw : 0;
        return base * 0.95 + calf;
      }, rig.hipFwd);
    }
    const hd = shape.head;
    v0.copy(hd.c).addScaledVector(hd.up, -hd.ry * 0.12);
    placeEllipsoid(this.head, v0, hd.side, hd.up, hd.fwd, hd.rx * 0.92, hd.ry * 1.08, hd.rz * 0.95);
    [shape.armL, shape.armR].forEach((L, k) => {
      const len = L.pts[3].distanceTo(L.pts[4]);
      placeCapsule(this.hands[k], L.pts[3], v1.copy(L.pts[4]).sub(L.pts[3]).multiplyScalar(2.2).add(L.pts[3]), Math.max(len * 0.7, rig.sw * 0.07));
    });
    [shape.legL, shape.legR].forEach((L, k) => {
      const ankle = L.pts[2];
      const toe = rig.p[k === 0 ? 31 : 32];
      v0.copy(ankle).lerp(toe, 0.55).addScaledVector(rig.up, -rig.sw * 0.06);
      v1.copy(toe).sub(ankle);
      const len = Math.max(v1.length(), rig.sw * 0.3);
      placeCapsule(this.feet[k], v0.copy(ankle).addScaledVector(rig.up, -rig.sw * 0.07), v1.copy(toe).addScaledVector(rig.up, -rig.sw * 0.02), len * 0.18);
    });
  }
}

const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 31], [28, 32], [15, 19], [16, 20], [0, 2], [0, 5], [2, 7], [5, 8], [9, 10],
];

/** Tracking visualisation (landmarks + bones). */
export class Skeleton {
  readonly lines: LineSegments;
  private pos: Float32Array;
  constructor() {
    this.pos = new Float32Array(BONES.length * 6);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.lines = new LineSegments(g, new LineBasicMaterial({ color: '#5ef2d6', depthTest: false, transparent: true, opacity: 0.9 }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 50;
  }
  update(rig: BodyRig) {
    BONES.forEach(([a, b], i) => {
      const pa = rig.p[a];
      const pb = rig.p[b];
      this.pos.set([pa.x, pa.y, 3000, pb.x, pb.y, 3000], i * 6);
    });
    (this.lines.geometry.attributes.position as BufferAttribute).needsUpdate = true;
  }
}
