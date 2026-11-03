import { Vector3 } from 'three';
import { Section } from '../body/Section';
import type { BodyShape } from '../body/BodyShape';
import { GridMesh, type Band } from './GridMesh';
import { lerp } from '../core/math';

/** Sections precomputed at regular heights each frame; vertices interpolate between them. */
export class SectionTable {
  readonly secs: Section[];
  h0 = 0;
  h1 = 1;
  constructor(public count = 72) {
    this.secs = Array.from({ length: count }, () => new Section());
  }
  /**
   * @param monotoneFrom below this height the widths never shrink again
   *   (garments hang from the hips like an A-line instead of hugging the knees)
   */
  build(shape: BodyShape, h0: number, h1: number, monotoneFrom = Infinity) {
    this.h0 = h0;
    this.h1 = h1;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const h = lerp(h0, h1, i / (n - 1));
      const s = shape.sectionAt(h, this.secs[i]);
      if (i > 0 && h > monotoneFrom) {
        const p = this.secs[i - 1];
        s.a = Math.max(s.a, p.a);
        s.bF = Math.max(s.bF, p.bF * 0.98);
        s.bB = Math.max(s.bB, p.bB * 0.98);
      }
    }
  }
  sample(h: number, out: Section): Section {
    const n = this.count;
    const f = ((h - this.h0) / (this.h1 - this.h0)) * (n - 1);
    if (f <= 0) return out.copy(this.secs[0]);
    if (f >= n - 1) return out.copy(this.secs[n - 1]);
    const k = Math.floor(f);
    const t = f - k;
    const a = this.secs[k];
    const b = this.secs[k + 1];
    out.c.lerpVectors(a.c, b.c, t);
    out.side.lerpVectors(a.side, b.side, t);
    out.up.lerpVectors(a.up, b.up, t);
    out.fwd.lerpVectors(a.fwd, b.fwd, t);
    out.a = lerp(a.a, b.a, t);
    out.bF = lerp(a.bF, b.bF, t);
    out.bB = lerp(a.bB, b.bB, t);
    out.n = lerp(a.n, b.n, t);
    return out;
  }
}

export interface SegmentSpec {
  /** fraction range along the garment rows (0 top .. 1 bottom) */
  t0: number;
  t1: number;
  rows: number;
  material: number;
  uv: 'body' | 'band';
  flipV?: boolean;
  uRepeat?: number;
}

/**
 * Turns an ordered list of row segments into per-row t values and GridMesh
 * bands (adjacent segments share their boundary row).
 */
export function layoutRows(segs: SegmentSpec[]) {
  const rowT: number[] = [];
  const bands: Band[] = [];
  for (const s of segs) {
    const start = rowT.length === 0 ? 0 : rowT.length - 1;
    const first = rowT.length === 0 ? 0 : 1;
    for (let r = first; r < s.rows; r++) rowT.push(lerp(s.t0, s.t1, r / Math.max(1, s.rows - 1)));
    bands.push({ r0: start, r1: rowT.length - 1, material: s.material, uv: s.uv, flipV: s.flipV, uRepeat: s.uRepeat });
  }
  return { rowT, bands };
}

const _c = new Vector3();
const _p = new Vector3();
const _T = new Vector3();
const _N = new Vector3();
const _B = new Vector3();
const _prev = new Vector3();
const _next = new Vector3();

/**
 * Writes a tube (sleeve / trouser leg / limb) into a grid. Rows follow the
 * path, columns go around it. Frames are parallel-transported to avoid
 * twisting; phi=0 faces `refN`.
 */
export function writeTube(
  grid: GridMesh,
  rowParam: number[],
  path: (u: number, out: Vector3) => Vector3,
  radius: (u: number, phi: number, row: number) => number,
  refN: Vector3,
  offsets?: Vector3[],
) {
  const rows = grid.rows;
  const cols = grid.cols;
  _N.copy(refN);
  for (let i = 0; i < rows; i++) {
    const u = rowParam[i];
    path(u, _c);
    const ua = rowParam[Math.max(0, i - 1)];
    const ub = rowParam[Math.min(rows - 1, i + 1)];
    path(ua === u ? u - 0.01 : ua, _prev);
    path(ub === u ? u + 0.01 : ub, _next);
    _T.copy(_next).sub(_prev);
    if (_T.lengthSq() < 1e-8) _T.set(0, -1, 0);
    _T.normalize();
    // parallel transport of the reference normal
    _N.addScaledVector(_T, -_N.dot(_T));
    if (_N.lengthSq() < 1e-8) {
      _N.set(0, 0, 1).addScaledVector(_T, -_T.z);
      if (_N.lengthSq() < 1e-8) _N.set(1, 0, 0);
    }
    _N.normalize();
    _B.crossVectors(_N, _T).normalize();
    if (offsets) _c.add(offsets[i]);
    for (let j = 0; j < cols; j++) {
      const phi = (j / cols) * Math.PI * 2;
      const r = radius(u, phi, i);
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      _p.copy(_c).addScaledVector(_N, cp * r).addScaledVector(_B, sp * r);
      grid.set(i, j, _p);
    }
  }
  grid.computeNormals();
  grid.commit();
}

/** Wrap an angle to (-PI, PI]. */
export const wrapAngle = (a: number) => {
  let x = a % (Math.PI * 2);
  if (x > Math.PI) x -= Math.PI * 2;
  if (x <= -Math.PI) x += Math.PI * 2;
  return x;
};

/** Gaussian bump. */
export const bump = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / (w * w));
