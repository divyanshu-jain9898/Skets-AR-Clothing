import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

export interface Band {
  /** First and last logical row (inclusive). */
  r0: number;
  r1: number;
  /** Material slot index for this band. */
  material: number;
  /** 'body' = tiled pattern (global UVs); 'band' = border strip (v spans the band). */
  uv: 'body' | 'band';
  flipV?: boolean;
  /** Repeats of the texture across the full width of the grid. */
  uRepeat?: number;
  /** Run the band texture along the rows instead of across the columns (vertical trims). */
  swap?: boolean;
}

/**
 * A rows x cols grid surface whose vertices are rewritten every frame.
 * Rows run "down" the garment, columns run around it (closed) or across it.
 * Bands split the rows into separately-textured strips (e.g. fabric body +
 * zari hem border); rows on band boundaries are duplicated so each band can
 * have its own UV layout. Normals are computed on the logical grid so the
 * shading is continuous across bands.
 */
export class GridMesh {
  readonly rows: number;
  readonly cols: number;
  readonly closed: boolean;
  /** Logical positions, rows * cols * 3. */
  readonly P: Float32Array;
  readonly N: Float32Array;
  readonly geometry = new BufferGeometry();
  readonly bands: Band[];
  private pos: Float32Array;
  private nor: Float32Array;
  private vcols: number;
  private bandOffset: number[] = [];
  private posAttr: BufferAttribute;
  private norAttr: BufferAttribute;

  constructor(
    rows: number,
    cols: number,
    closed: boolean,
    bands: Band[],
    uRepeat = 4,
    vRepeat = 4,
    /** Return true to leave the quad between rows i..i+1 and columns j..j+1 open (slits, gaps). */
    skip?: (row: number, col: number) => boolean,
  ) {
    this.rows = rows;
    this.cols = cols;
    this.closed = closed;
    this.bands = bands;
    this.P = new Float32Array(rows * cols * 3);
    this.N = new Float32Array(rows * cols * 3);
    this.vcols = closed ? cols + 1 : cols;
    let vcount = 0;
    for (const b of bands) {
      this.bandOffset.push(vcount);
      vcount += (b.r1 - b.r0 + 1) * this.vcols;
    }
    this.pos = new Float32Array(vcount * 3);
    this.nor = new Float32Array(vcount * 3);
    const uv = new Float32Array(vcount * 2);
    const index: number[] = [];
    const uDen = closed ? cols : Math.max(1, cols - 1);
    bands.forEach((b, bi) => {
      const off = this.bandOffset[bi];
      const nr = b.r1 - b.r0 + 1;
      for (let r = 0; r < nr; r++) {
        const i = b.r0 + r;
        for (let j = 0; j < this.vcols; j++) {
          const k = off + r * this.vcols + j;
          const uf = j / uDen;
          if (b.uv === 'body') {
            uv[k * 2] = uf * uRepeat;
            uv[k * 2 + 1] = 1 - (i / Math.max(1, rows - 1)) * vRepeat;
          } else if (b.swap) {
            const vf = nr > 1 ? r / (nr - 1) : 0;
            uv[k * 2] = vf * (b.uRepeat ?? uRepeat);
            uv[k * 2 + 1] = b.flipV ? uf : 1 - uf;
          } else {
            const vf = nr > 1 ? r / (nr - 1) : 0;
            uv[k * 2] = uf * (b.uRepeat ?? uRepeat);
            uv[k * 2 + 1] = b.flipV ? vf : 1 - vf;
          }
        }
      }
      const start = index.length;
      for (let r = 0; r < nr - 1; r++) {
        for (let j = 0; j < this.vcols - 1; j++) {
          if (skip && skip(b.r0 + r, j % cols)) continue;
          const v00 = off + r * this.vcols + j;
          const v01 = v00 + 1;
          const v10 = v00 + this.vcols;
          const v11 = v10 + 1;
          index.push(v00, v10, v11, v00, v11, v01);
        }
      }
      this.geometry.addGroup(start, index.length - start, b.material);
    });
    this.posAttr = new BufferAttribute(this.pos, 3);
    this.norAttr = new BufferAttribute(this.nor, 3);
    this.posAttr.setUsage(35048 /* DynamicDrawUsage */);
    this.norAttr.setUsage(35048);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('normal', this.norAttr);
    this.geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    this.geometry.setIndex(index);
  }

  set(i: number, j: number, v: Vector3) {
    const k = (i * this.cols + j) * 3;
    this.P[k] = v.x;
    this.P[k + 1] = v.y;
    this.P[k + 2] = v.z;
  }

  get(i: number, j: number, out: Vector3) {
    const k = (i * this.cols + j) * 3;
    return out.set(this.P[k], this.P[k + 1], this.P[k + 2]);
  }

  /** Normals from central differences: N = dP/drow x dP/dcol. */
  computeNormals() {
    const { rows, cols, P, N, closed } = this;
    for (let i = 0; i < rows; i++) {
      const ia = Math.max(0, i - 1);
      const ib = Math.min(rows - 1, i + 1);
      for (let j = 0; j < cols; j++) {
        const ja = closed ? (j - 1 + cols) % cols : Math.max(0, j - 1);
        const jb = closed ? (j + 1) % cols : Math.min(cols - 1, j + 1);
        const a = (ia * cols + j) * 3;
        const b = (ib * cols + j) * 3;
        const c = (i * cols + ja) * 3;
        const d = (i * cols + jb) * 3;
        const vx = P[b] - P[a];
        const vy = P[b + 1] - P[a + 1];
        const vz = P[b + 2] - P[a + 2];
        const ux = P[d] - P[c];
        const uy = P[d + 1] - P[c + 1];
        const uz = P[d + 2] - P[c + 2];
        let nx = vy * uz - vz * uy;
        let ny = vz * ux - vx * uz;
        let nz = vx * uy - vy * ux;
        const l = Math.hypot(nx, ny, nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        const k = (i * cols + j) * 3;
        N[k] = nx;
        N[k + 1] = ny;
        N[k + 2] = nz;
      }
    }
  }

  /** Scatter logical positions/normals into the band vertex buffers and flag for upload. */
  commit() {
    const { cols, P, N, pos, nor, vcols } = this;
    this.bands.forEach((b, bi) => {
      const off = this.bandOffset[bi];
      for (let i = b.r0; i <= b.r1; i++) {
        const r = i - b.r0;
        for (let j = 0; j < vcols; j++) {
          const src = (i * cols + (j % cols)) * 3;
          const dst = (off + r * vcols + j) * 3;
          pos[dst] = P[src];
          pos[dst + 1] = P[src + 1];
          pos[dst + 2] = P[src + 2];
          nor[dst] = N[src];
          nor[dst + 1] = N[src + 1];
          nor[dst + 2] = N[src + 2];
        }
      }
    });
    this.posAttr.needsUpdate = true;
    this.norAttr.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
  }
}
