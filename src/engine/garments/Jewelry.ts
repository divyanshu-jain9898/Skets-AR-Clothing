import {
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { Garment, Stage, type GarmentContext } from './Garment';
import type { BodyShape } from '../body/BodyShape';
import type { BodyRig } from '../body/BodyRig';
import { Section } from '../body/Section';
import type { FabricSpec, TrimKind } from '../materials/FabricLibrary';
import { clamp, damp, lerp } from '../core/math';

export interface JewelryParams {
  necklace: 'none' | 'choker' | 'haar' | 'mala' | 'pearls';
  earrings: boolean;
  tikka: boolean;
  metal: 'gold' | 'antiqueGold' | 'silver';
  stone: 'ruby' | 'emerald' | 'pearl';
}

const sec = new Section();
const v0 = new Vector3();
const v1 = new Vector3();
const nrm = new Vector3();
const q = new Quaternion();
const m4 = new Matrix4();
const sc = new Vector3();
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

interface Strand {
  beads: InstancedMesh;
  count: number;
  drop: number;
  spread: number;
  size: number;
}

/** Bead strands + pendant necklaces, swinging jhumkas and a maang tikka. */
export class JewelryGarment extends Garment {
  readonly p: JewelryParams;
  private strands: Strand[] = [];
  private pendant: Group | null = null;
  private jhumkas: Group[] = [];
  private swing = [new Vector3(), new Vector3()];
  private swingVel = [new Vector3(), new Vector3()];
  private tikka: Group | null = null;
  private chain: InstancedMesh | null = null;

  constructor(ctx: GarmentContext, fabric: FabricSpec, params: Partial<JewelryParams>) {
    super(ctx, fabric);
    this.stage = Stage.Accessory;
    const p = (this.p = { necklace: 'haar', earrings: true, tikka: false, metal: 'gold', stone: 'ruby', ...params });
    const lib = ctx.lib;
    const metal = lib.trim(p.metal as TrimKind);
    const stone = lib.trim(p.stone as TrimKind);
    const bead = new SphereGeometry(1, 10, 8);
    const addStrand = (count: number, drop: number, spread: number, size: number, mat = metal) => {
      const beads = new InstancedMesh(bead, mat, count);
      this.add(beads);
      this.strands.push({ beads, count, drop, spread, size });
    };
    switch (p.necklace) {
      case 'choker':
        addStrand(30, 0.08, 1.35, 0.03);
        addStrand(26, 0.17, 1.25, 0.022, lib.trim('pearl'));
        break;
      case 'haar':
        addStrand(34, 0.24, 1.32, 0.026);
        addStrand(40, 0.42, 1.25, 0.022, lib.trim('pearl'));
        break;
      case 'mala':
        addStrand(56, 0.95, 1.2, 0.03, lib.trim('pearl'));
        addStrand(64, 1.12, 1.15, 0.028, lib.trim('pearl'));
        break;
      case 'pearls':
        addStrand(44, 0.38, 1.25, 0.026, lib.trim('pearl'));
        break;
    }
    if (p.necklace === 'choker' || p.necklace === 'haar' || p.necklace === 'mala') {
      const g = new Group();
      const ring = new Mesh(new TorusGeometry(1, 0.22, 8, 24), metal);
      const gem = new Mesh(new SphereGeometry(0.72, 16, 12), stone);
      gem.scale.set(1, 1.15, 0.55);
      const drop = new Mesh(new SphereGeometry(0.35, 10, 8), lib.trim('pearl'));
      drop.position.set(0, -1.55, 0);
      g.add(ring, gem, drop);
      this.pendant = g;
      this.prep(g);
    }
    if (p.earrings) {
      const bell = new LatheGeometry(
        [new Vector2(0.05, 0.9), new Vector2(0.35, 0.8), new Vector2(0.7, 0.35), new Vector2(0.95, -0.3), new Vector2(1.0, -0.42), new Vector2(0.9, -0.45)],
        18,
      );
      for (let k = 0; k < 2; k++) {
        const g = new Group();
        const stud = new Mesh(new SphereGeometry(0.42, 12, 10), stone);
        stud.position.set(0, 1.55, 0);
        const b = new Mesh(bell, metal);
        const pearls = new InstancedMesh(bead, lib.trim('pearl'), 9);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          m4.makeScale(0.17, 0.17, 0.17).setPosition(Math.cos(a) * 0.95, -0.62, Math.sin(a) * 0.95);
          pearls.setMatrixAt(i, m4);
        }
        g.add(stud, b, pearls);
        this.prep(g);
        this.jhumkas.push(g);
      }
    }
    if (p.tikka) {
      const g = new Group();
      const disc = new Mesh(new SphereGeometry(1, 16, 12), metal);
      disc.scale.set(1, 1, 0.3);
      const gem = new Mesh(new SphereGeometry(0.55, 14, 10), stone);
      gem.position.z = 0.3;
      gem.scale.set(1, 1, 0.6);
      const drop = new Mesh(new SphereGeometry(0.3, 10, 8), lib.trim('pearl'));
      drop.position.y = -1.3;
      g.add(disc, gem, drop);
      this.tikka = g;
      this.prep(g);
      this.chain = new InstancedMesh(bead, metal, 14);
      this.add(this.chain);
    }
  }

  private prep(g: Group) {
    g.matrixAutoUpdate = false;
    g.traverse((o) => (o.frustumCulled = false));
    this.group.add(g);
  }

  /** Necklace path point: s in [-1,1] (person right -> left), lying on the outer clothing layer. */
  private strandPoint(shape: BodyShape, s: number, drop: number, spread: number, lift: number, out: Vector3) {
    const theta = s * spread;
    const h = lerp(0.01, drop, Math.pow(1 - s * s, 1.15));
    shape.sectionAt(h, sec);
    const grow = shape.layerAt(h) + lift;
    sec.point(theta, out, grow);
    return out;
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    const sw = shape.sw;
    for (const st of this.strands) {
      const r = st.size * sw;
      for (let i = 0; i < st.count; i++) {
        const s = lerp(-1, 1, i / (st.count - 1));
        this.strandPoint(shape, s, st.drop, st.spread, r * 1.2 + 0.012 * sw, v0);
        m4.makeScale(r, r, r).setPosition(v0);
        st.beads.setMatrixAt(i, m4);
      }
      st.beads.instanceMatrix.needsUpdate = true;
    }
    if (this.pendant && this.strands.length) {
      const st = this.strands[0];
      const s = 0.07 * sw;
      this.strandPoint(shape, 0, st.drop, st.spread, 0.03 * sw, v0);
      shape.sectionAt(st.drop, sec);
      nrm.copy(sec.fwd);
      v0.addScaledVector(sec.up, -s * 1.1);
      q.setFromUnitVectors(Z, nrm);
      m4.compose(v0, q, sc.set(s, s, s));
      this.pendant.matrix.copy(m4);
      this.pendant.matrixWorldNeedsUpdate = true;
    }
    // jhumkas: pendulum hanging from the ear lobes
    const hd = shape.head;
    const ew = hd.earW;
    for (let k = 0; k < this.jhumkas.length; k++) {
      const ear = rig.p[k === 0 ? 7 : 8];
      const lobe = v0
        .copy(ear)
        .addScaledVector(hd.up, -0.2 * ew)
        .addScaledVector(hd.side, (k === 0 ? 1 : -1) * 0.04 * ew)
        .addScaledVector(hd.fwd, 0.02 * ew);
      // swing: spring towards straight down, excited by head motion
      const sw0 = this.swing[k];
      const vel = this.swingVel[k];
      vel.addScaledVector(sw0, -60 * dt).multiplyScalar(1 - damp(4, dt));
      vel.addScaledVector(rig.hipVel, -0.0004 * dt * 60);
      sw0.addScaledVector(vel, dt);
      sw0.x = clamp(sw0.x, -0.5, 0.5);
      sw0.z = clamp(sw0.z, -0.5, 0.5);
      const down = v1.set(sw0.x, -1, sw0.z).normalize();
      q.setFromUnitVectors(Y, down.clone().negate());
      const s = 0.13 * ew;
      const pos = lobe.addScaledVector(down, s * 1.7);
      m4.compose(pos, q, sc.set(s, s, s));
      this.jhumkas[k].matrix.copy(m4);
      this.jhumkas[k].matrixWorldNeedsUpdate = true;
    }
    if (this.tikka && this.chain) {
      const top = v0.copy(hd.c).addScaledVector(hd.up, hd.ry * 0.93).addScaledVector(hd.fwd, hd.rz * 0.3);
      const fore = v1.copy(rig.eyeMid).addScaledVector(hd.up, 0.5 * ew).addScaledVector(hd.fwd, 0.1 * ew);
      const n = this.chain.count;
      const r = 0.018 * ew;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const p = new Vector3().lerpVectors(top, fore, t);
        // bow outward over the forehead curve
        const out = Math.sin(t * Math.PI) * 0.16 * ew;
        p.addScaledVector(hd.fwd, out).addScaledVector(hd.up, out * 0.3);
        m4.makeScale(r, r, r).setPosition(p);
        this.chain.setMatrixAt(i, m4);
      }
      this.chain.instanceMatrix.needsUpdate = true;
      const s = 0.1 * ew;
      q.setFromUnitVectors(Z, hd.fwd);
      m4.compose(fore.clone().addScaledVector(hd.up, -s * 0.9).addScaledVector(hd.fwd, 0.03 * ew), q, sc.set(s, s, s));
      this.tikka.matrix.copy(m4);
      this.tikka.matrixWorldNeedsUpdate = true;
    }
  }
}
