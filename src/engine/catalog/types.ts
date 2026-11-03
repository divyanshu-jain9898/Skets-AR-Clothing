import type { Gender } from '../core/types';
import type { FabricSpec, FabricType } from '../materials/FabricLibrary';
import type { BorderId, PatternColors, PatternId } from '../materials/patterns';

export type SlotId = 'top' | 'layer' | 'bottom' | 'drape' | 'head' | 'jewelry';
export const SLOT_ORDER: SlotId[] = ['top', 'layer', 'bottom', 'drape', 'head', 'jewelry'];
export const SLOT_LABELS: Record<SlotId, string> = {
  top: 'Top',
  layer: 'Jacket',
  bottom: 'Bottom',
  drape: 'Drape',
  head: 'Headwear',
  jewelry: 'Jewellery',
};

export type PieceKind = 'torso' | 'skirt' | 'pants' | 'drape' | 'saree' | 'turban' | 'topi' | 'jewelry';

export interface StyleOption {
  label: string;
  value: number | string | boolean;
}

export interface StyleControl {
  key: string;
  label: string;
  options?: StyleOption[];
  /** range control */
  min?: number;
  max?: number;
  step?: number;
}

export interface PieceDef {
  id: string;
  name: string;
  slot: SlotId;
  gender: Gender | 'unisex';
  kind: PieceKind;
  params: Record<string, unknown>;
  fabric: FabricSpec;
  controls: StyleControl[];
  /** Hide the fabric editor (e.g. jewellery). */
  noFabric?: boolean;
  /** Religious attire (dastar, taqiyah): part of the outfit, kept when accessories are off. */
  attire?: boolean;
}

export interface PieceRef {
  piece: string;
  type?: FabricType;
  pattern?: PatternId;
  border?: BorderId;
  colors?: Partial<PatternColors>;
  params?: Record<string, unknown>;
}

export interface OutfitDef {
  id: string;
  name: string;
  gender: Gender;
  region: string;
  occasion: 'Festive' | 'Wedding' | 'Everyday' | 'Ceremonial';
  /** Faith community the outfit is traditionally associated with, when there is one. */
  community?: string;
  /** Traditions (regional cultures and faiths) the outfit belongs to; ids from TRADITIONS. */
  traditions: string[];
  description: string;
  pieces: Partial<Record<SlotId, PieceRef>>;
}

export interface SlotState {
  pieceId: string;
  fabric: FabricSpec;
  params: Record<string, unknown>;
}

export interface OutfitSelection {
  gender: Gender;
  slots: Partial<Record<SlotId, SlotState>>;
}
