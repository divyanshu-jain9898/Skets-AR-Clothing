import { Vector3 } from 'three';

/**
 * A horizontal cross-section of the body/garment: a super-ellipse in the
 * plane spanned by `side` (person's right -> left) and `fwd` (body front),
 * centred at `c`, with separate front/back depths.
 *
 * Angle convention: theta = 0 front centre, +PI/2 person's left side,
 * PI back centre, -PI/2 (= 3PI/2) person's right side.
 */
export class Section {
  readonly c = new Vector3();
  readonly side = new Vector3(1, 0, 0);
  readonly up = new Vector3(0, 1, 0);
  readonly fwd = new Vector3(0, 0, 1);
  a = 1;
  bF = 1;
  bB = 1;
  n = 2;

  copy(s: Section) {
    this.c.copy(s.c);
    this.side.copy(s.side);
    this.up.copy(s.up);
    this.fwd.copy(s.fwd);
    this.a = s.a;
    this.bF = s.bF;
    this.bB = s.bB;
    this.n = s.n;
    return this;
  }

  /** Re-orthonormalise side/fwd around `up`. */
  orthonormalize() {
    this.up.normalize();
    this.side.addScaledVector(this.up, -this.side.dot(this.up));
    if (this.side.lengthSq() < 1e-8) this.side.set(1, 0, 0);
    this.side.normalize();
    this.fwd.crossVectors(this.side, this.up).normalize();
    return this;
  }

  /** Local (x along side, z along fwd) coordinates of the ring point at theta. */
  local(theta: number, grow = 0, out = { x: 0, z: 0 }) {
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    const e = 2 / this.n;
    const px = Math.sign(s) * Math.pow(Math.abs(s), e);
    const pz = Math.sign(c) * Math.pow(Math.abs(c), e);
    out.x = px * (this.a + grow);
    out.z = pz * ((c >= 0 ? this.bF : this.bB) + grow);
    return out;
  }

  point(theta: number, out: Vector3, grow = 0): Vector3 {
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    const e = 2 / this.n;
    const px = Math.sign(s) * Math.pow(Math.abs(s), e);
    const pz = Math.sign(c) * Math.pow(Math.abs(c), e);
    const x = px * (this.a + grow);
    const z = pz * ((c >= 0 ? this.bF : this.bB) + grow);
    return out.copy(this.c).addScaledVector(this.side, x).addScaledVector(this.fwd, z);
  }

  /** Point from local coordinates (x along side, y along up, z along fwd). */
  fromLocal(x: number, y: number, z: number, out: Vector3) {
    return out.copy(this.c).addScaledVector(this.side, x).addScaledVector(this.up, y).addScaledVector(this.fwd, z);
  }
}
