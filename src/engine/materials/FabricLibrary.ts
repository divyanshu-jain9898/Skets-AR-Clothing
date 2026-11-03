import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
} from 'three';
import {
  drawBorder,
  drawDrape,
  drawPalluEnd,
  drawPattern,
  drawWeaveNormal,
  type BorderId,
  type PatternColors,
  type PatternId,
  type TexturePair,
  type WeaveKind,
} from './patterns';

export type FabricType = 'cotton' | 'khadi' | 'linen' | 'silk' | 'satin' | 'velvet' | 'georgette' | 'brocade';

export interface FabricSpec {
  type: FabricType;
  pattern: PatternId;
  border: BorderId;
  colors: PatternColors;
  /** Pattern size multiplier (1 = default). */
  scale?: number;
}

interface FabricParams {
  label: string;
  roughness: number;
  sheen: number;
  sheenRoughness: number;
  normalScale: number;
  weave: WeaveKind;
  weaveRepeat: number;
  opacity: number;
  clearcoat?: number;
}

export const FABRICS: Record<FabricType, FabricParams> = {
  cotton: { label: 'Cotton', roughness: 0.93, sheen: 0.35, sheenRoughness: 0.8, normalScale: 0.45, weave: 'plain', weaveRepeat: 26, opacity: 1 },
  khadi: { label: 'Khadi', roughness: 0.96, sheen: 0.25, sheenRoughness: 0.9, normalScale: 0.8, weave: 'plain', weaveRepeat: 16, opacity: 1 },
  linen: { label: 'Linen', roughness: 0.9, sheen: 0.3, sheenRoughness: 0.85, normalScale: 0.6, weave: 'twill', weaveRepeat: 20, opacity: 1 },
  silk: { label: 'Silk', roughness: 0.42, sheen: 1, sheenRoughness: 0.32, normalScale: 0.2, weave: 'satin', weaveRepeat: 34, opacity: 1 },
  satin: { label: 'Satin', roughness: 0.3, sheen: 0.8, sheenRoughness: 0.25, normalScale: 0.12, weave: 'satin', weaveRepeat: 40, opacity: 1, clearcoat: 0.15 },
  velvet: { label: 'Velvet', roughness: 0.98, sheen: 1, sheenRoughness: 0.5, normalScale: 0.15, weave: 'velvet', weaveRepeat: 30, opacity: 1 },
  georgette: { label: 'Georgette', roughness: 0.78, sheen: 0.7, sheenRoughness: 0.45, normalScale: 0.3, weave: 'plain', weaveRepeat: 30, opacity: 0.84 },
  brocade: { label: 'Brocade', roughness: 0.55, sheen: 0.8, sheenRoughness: 0.4, normalScale: 0.35, weave: 'twill', weaveRepeat: 28, opacity: 1 },
};

export type TrimKind = 'gold' | 'antiqueGold' | 'silver' | 'pearl' | 'ruby' | 'emerald' | 'feather' | 'thread';

/**
 * Builds and caches physically-based fabric materials. Pattern and border
 * textures come from the procedural textile generator; zari (metallic
 * thread) is encoded in the ORM map so it reflects light like real gold.
 */
export class FabricLibrary {
  private pairs = new Map<string, TexturePair>();
  private textures = new Map<string, Texture>();
  private materials = new Map<string, MeshPhysicalMaterial | MeshStandardMaterial>();
  private weaves = new Map<WeaveKind, HTMLCanvasElement>();
  maxAnisotropy = 4;

  private pair(key: string, make: () => TexturePair): TexturePair {
    let p = this.pairs.get(key);
    if (!p) {
      p = make();
      this.pairs.set(key, p);
    }
    return p;
  }

  private tex(key: string, canvas: HTMLCanvasElement, srgb: boolean, repeat: Vector2): Texture {
    const k = `${key}|${repeat.x.toFixed(3)},${repeat.y.toFixed(3)}`;
    let t = this.textures.get(k);
    if (!t) {
      t = new CanvasTexture(canvas);
      t.wrapS = t.wrapT = RepeatWrapping;
      t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
      t.anisotropy = this.maxAnisotropy;
      t.repeat.copy(repeat);
      t.needsUpdate = true;
      this.textures.set(k, t);
    }
    return t;
  }

  private weave(kind: WeaveKind) {
    let c = this.weaves.get(kind);
    if (!c) {
      c = drawWeaveNormal(kind, 256);
      this.weaves.set(kind, c);
    }
    return c;
  }

  private build(key: string, pairKey: string, pair: TexturePair, f: FabricSpec, repeat: Vector2, weaveScale: number, sheer = false) {
    const cached = this.materials.get(key);
    if (cached) return cached as MeshPhysicalMaterial;
    const fp = FABRICS[f.type];
    // garments are lined; only free-hanging drapes show their sheerness
    const opacity = sheer ? fp.opacity : 1;
    const m = new MeshPhysicalMaterial({
      color: 0xffffff,
      map: this.tex(pairKey + ':c', pair.color, true, repeat),
      roughnessMap: this.tex(pairKey + ':o', pair.orm, false, repeat),
      metalnessMap: this.tex(pairKey + ':o', pair.orm, false, repeat),
      roughness: Math.min(1, Math.max(0.28, fp.roughness / 0.92)),
      metalness: 1,
      sheen: fp.sheen,
      sheenRoughness: fp.sheenRoughness,
      sheenColor: new Color(f.colors.base).lerp(new Color(0xffffff), 0.45),
      normalMap: this.tex('weave:' + fp.weave, this.weave(fp.weave), false, new Vector2(fp.weaveRepeat * weaveScale, fp.weaveRepeat * weaveScale)),
      normalScale: new Vector2(fp.normalScale, fp.normalScale),
      side: DoubleSide,
      transparent: opacity < 1,
      opacity,
      clearcoat: fp.clearcoat ?? 0,
      envMapIntensity: 0.9,
    });
    if (opacity < 1) m.depthWrite = false;
    this.materials.set(key, m);
    return m;
  }

  private static colorsKey(c: PatternColors) {
    return `${c.base}${c.accent}${c.border}${c.zari}`;
  }

  /** Main fabric material (tiled pattern). */
  body(f: FabricSpec): MeshPhysicalMaterial {
    const s = f.scale ?? 1;
    const pk = `pat:${f.pattern}:${FabricLibrary.colorsKey(f.colors)}`;
    const pair = this.pair(pk, () => drawPattern(f.pattern, f.colors, 512));
    return this.build(`body|${pk}|${f.type}|${s}`, pk, pair, f, new Vector2(1 / s, 1 / s), 1);
  }

  /** Border / hem band material. */
  border(f: FabricSpec): MeshPhysicalMaterial {
    const pk = `bor:${f.border}:${FabricLibrary.colorsKey(f.colors)}`;
    const pair = this.pair(pk, () => drawBorder(f.border, f.colors, 512, 128));
    return this.build(`border|${pk}|${f.type}`, pk, pair, f, new Vector2(1, 1), 0.5);
  }

  /** Long drape (dupatta / pallu body) with borders along both long edges. */
  drape(f: FabricSpec): MeshPhysicalMaterial {
    const pk = `drp:${f.pattern}:${f.border}:${FabricLibrary.colorsKey(f.colors)}`;
    const pair = this.pair(pk, () => drawDrape(f.pattern, f.border, f.colors, 512));
    return this.build(`drape|${pk}|${f.type}`, pk, pair, f, new Vector2(1, 1), 1, true);
  }

  /** Decorated pallu / dupatta end panel. */
  palluEnd(f: FabricSpec): MeshPhysicalMaterial {
    const pk = `end:${f.pattern}:${FabricLibrary.colorsKey(f.colors)}`;
    const pair = this.pair(pk, () => drawPalluEnd(f.pattern, f.colors, 512, 512));
    return this.build(`end|${pk}|${f.type}`, pk, pair, f, new Vector2(1, 1), 1, true);
  }

  /** Solid fabric in one colour (linings, piping, waistbands). */
  solid(color: string, type: FabricType = 'cotton'): MeshPhysicalMaterial {
    return this.body({ type, pattern: 'plain', border: 'none', colors: { base: color, accent: color, border: color, zari: '#d4af37' } });
  }

  trim(kind: TrimKind, color?: string): MeshStandardMaterial | MeshPhysicalMaterial {
    const key = `trim|${kind}|${color ?? ''}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    let m: MeshStandardMaterial | MeshPhysicalMaterial;
    switch (kind) {
      case 'gold':
        m = new MeshStandardMaterial({ color: color ?? '#e0b04f', metalness: 1, roughness: 0.28 });
        break;
      case 'antiqueGold':
        m = new MeshStandardMaterial({ color: color ?? '#b9862f', metalness: 1, roughness: 0.42 });
        break;
      case 'silver':
        m = new MeshStandardMaterial({ color: color ?? '#d5d8de', metalness: 1, roughness: 0.25 });
        break;
      case 'pearl':
        m = new MeshPhysicalMaterial({ color: color ?? '#f6f0e4', metalness: 0, roughness: 0.25, sheen: 0.6, clearcoat: 1, clearcoatRoughness: 0.15 });
        break;
      case 'ruby':
        m = new MeshPhysicalMaterial({ color: color ?? '#a50d2c', metalness: 0, roughness: 0.08, clearcoat: 1, specularIntensity: 1 });
        break;
      case 'emerald':
        m = new MeshPhysicalMaterial({ color: color ?? '#0e7a52', metalness: 0, roughness: 0.08, clearcoat: 1, specularIntensity: 1 });
        break;
      case 'feather':
        m = new MeshPhysicalMaterial({ color: color ?? '#fbf6ea', roughness: 0.9, sheen: 1, sheenRoughness: 0.4, side: DoubleSide });
        break;
      default:
        m = new MeshPhysicalMaterial({ color: color ?? '#ffffff', roughness: 0.8, sheen: 0.5, side: DoubleSide });
    }
    this.materials.set(key, m);
    return m;
  }

  /** Display-mannequin body material. */
  mannequin(): MeshPhysicalMaterial {
    const key = 'mannequin';
    const cached = this.materials.get(key);
    if (cached) return cached as MeshPhysicalMaterial;
    const m = new MeshPhysicalMaterial({
      color: '#e9e2da',
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.35,
      sheen: 0.25,
      sheenRoughness: 0.6,
      sheenColor: new Color('#ffffff'),
    });
    this.materials.set(key, m);
    return m;
  }

  /** Free textures/materials built for colourways no longer in use. */
  prune(keep: Set<string> | null = null) {
    if (this.materials.size < 160 && this.pairs.size < 120) return;
    for (const [k, m] of this.materials) {
      if (keep?.has(k)) continue;
      if (k.startsWith('trim') || k === 'mannequin') continue;
      m.dispose();
      this.materials.delete(k);
    }
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.pairs.clear();
  }
}
