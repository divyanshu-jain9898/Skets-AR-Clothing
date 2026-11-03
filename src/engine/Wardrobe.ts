import type { Group } from 'three';
import type { BodyRig } from './body/BodyRig';
import type { BodyShape } from './body/BodyShape';
import { PIECE_MAP } from './catalog/catalog';
import { SLOT_ORDER, type OutfitSelection, type SlotId, type SlotState } from './catalog/types';
import type { Garment, GarmentContext } from './garments/Garment';
import { TorsoGarment, type TorsoParams } from './garments/TorsoGarment';
import { SkirtGarment, type SkirtParams } from './garments/SkirtGarment';
import { PantsGarment, type PantsParams } from './garments/PantsGarment';
import { ClothDrape, type DrapeParams, type DrapeStyle } from './garments/ClothDrape';
import { SareeGarment, type SareeParams } from './garments/SareeGarment';
import { TopiGarment, TurbanGarment, type TopiParams, type TurbanParams } from './garments/Headwear';
import { JewelryGarment, type JewelryParams } from './garments/Jewelry';

export function createGarment(state: SlotState, ctx: GarmentContext): Garment | null {
  const def = PIECE_MAP.get(state.pieceId);
  if (!def) return null;
  const params = state.params;
  switch (def.kind) {
    case 'torso':
      return new TorsoGarment(ctx, state.fabric, params as Partial<TorsoParams>);
    case 'skirt':
      return new SkirtGarment(ctx, state.fabric, params as Partial<SkirtParams>);
    case 'pants':
      return new PantsGarment(ctx, state.fabric, params as Partial<PantsParams>);
    case 'drape':
      return new ClothDrape(ctx, state.fabric, { ...(params as Partial<DrapeParams>), style: (params.style as DrapeStyle) ?? 'dupatta-front' });
    case 'saree':
      return new SareeGarment(ctx, state.fabric, params as Partial<SareeParams>);
    case 'turban':
      return new TurbanGarment(ctx, state.fabric, params as Partial<TurbanParams>);
    case 'topi':
      return new TopiGarment(ctx, state.fabric, params as Partial<TopiParams>);
    case 'jewelry':
      return new JewelryGarment(ctx, state.fabric, params as Partial<JewelryParams>);
    default:
      return null;
  }
}

/** Keeps the garments for each outfit slot in sync with the selection. */
export class Wardrobe {
  private items = new Map<SlotId, { key: string; g: Garment }>();
  private ordered: Garment[] = [];
  private needsReset = new Set<Garment>();

  constructor(
    public ctx: GarmentContext,
    private parent: Group,
  ) {}

  apply(sel: OutfitSelection | null) {
    const sareeWorn = sel?.slots.bottom && PIECE_MAP.get(sel.slots.bottom.pieceId)?.kind === 'saree';
    for (const slot of SLOT_ORDER) {
      let st = sel?.slots[slot] ?? null;
      if (slot === 'drape' && sareeWorn) st = null;
      const key = st ? `${JSON.stringify(st)}|${this.ctx.detail}|${this.ctx.gender}` : '';
      const cur = this.items.get(slot);
      if (cur && cur.key === key) continue;
      if (cur) {
        cur.g.dispose();
        this.items.delete(slot);
      }
      if (!st) continue;
      try {
        const g = createGarment(st, this.ctx);
        if (g) {
          this.parent.add(g.group);
          this.items.set(slot, { key, g });
          this.needsReset.add(g);
        }
      } catch (err) {
        console.error(`[wardrobe] failed to build ${slot}`, err);
      }
    }
    this.ordered = [...this.items.values()].map((x) => x.g).sort((a, b) => a.stage - b.stage);
  }

  /** Rebuild everything (quality change). */
  rebuild(sel: OutfitSelection | null) {
    this.clear();
    this.apply(sel);
  }

  resetPhysics() {
    for (const g of this.ordered) this.needsReset.add(g);
  }

  update(rig: BodyRig, shape: BodyShape, dt: number) {
    for (const g of this.ordered) {
      if (this.needsReset.has(g)) {
        this.needsReset.delete(g);
        try {
          g.reset(rig, shape);
        } catch (err) {
          console.error('[wardrobe] reset failed', err);
        }
      }
      g.update(rig, shape, dt);
    }
  }

  get count() {
    return this.ordered.length;
  }

  clear() {
    for (const { g } of this.items.values()) g.dispose();
    this.items.clear();
    this.ordered = [];
  }
}
