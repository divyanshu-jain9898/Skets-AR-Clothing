import { create } from 'zustand';
import type { Engine } from '../engine/Engine';
import { OUTFITS, OUTFIT_MAP, PIECE_MAP, selectionFromOutfit, slotStateFromRef } from '../engine/catalog/catalog';
import type { OutfitSelection, SlotId, SlotState } from '../engine/catalog/types';
import type { EngineStats, Gender, QualityLevel, SourceMode, TrackingStatus } from '../engine/core/types';
import type { MannequinPose } from '../engine/tracking/SyntheticPose';
import type { BackdropState } from '../engine/Engine';
import { DEFAULT_BACKGROUND } from '../engine/backgrounds/catalog';

export type Occasion = 'All' | 'Wedding' | 'Festive' | 'Everyday' | 'Ceremonial';

export interface Capture {
  id: string;
  kind: 'photo' | 'clip';
  url: string;
  blob: Blob;
  name: string;
  outfit: string;
  createdAt: number;
}

export interface Toast {
  id: number;
  text: string;
  tone?: 'info' | 'error';
}

let engineRef: Engine | null = null;
export const setEngine = (e: Engine | null) => (engineRef = e);
export const getEngine = () => engineRef;

const isMobile = () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760);

const PREFS_KEY = 'vastra-prefs-v1';
function loadPrefs(): Partial<{ quality: QualityLevel; mirror: boolean; skeleton: boolean; occlusion: boolean; autoLight: boolean; fit: 'cover' | 'contain'; gender: Gender; onboarded: boolean; bgId: string; bgAnimate: boolean; officeWindows: boolean; accessories: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function savePrefs(p: object) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable (private mode / sandbox) */
  }
}

const prefs = loadPrefs();

/**
 * Jewellery and decorative headwear are the accessories; "None" leaves them
 * off every outfit. Religious headwear (a Sikh dastar, a taqiyah) is attire,
 * not an accessory, and stays.
 */
const ACCESSORY_SLOTS: SlotId[] = ['head', 'jewelry'];
function withoutAccessories(sel: OutfitSelection): OutfitSelection {
  const slots = { ...sel.slots };
  for (const k of ACCESSORY_SLOTS) {
    const st = slots[k];
    if (st && !PIECE_MAP.get(st.pieceId)?.attire) delete slots[k];
  }
  return { ...sel, slots };
}
const outfitSelection = (o: Parameters<typeof selectionFromOutfit>[0], accessories: boolean) => {
  const sel = selectionFromOutfit(o);
  return accessories ? sel : withoutAccessories(sel);
};
const reducedMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export type PanelTab = 'outfits' | 'customise' | 'backgrounds';
const initialGender: Gender = prefs.gender ?? 'women';
const initialOutfit = OUTFITS.find((o) => o.gender === initialGender)!;

export interface AppState {
  mode: SourceMode;
  status: TrackingStatus;
  statusMsg: string | null;
  progress: number;
  hint: string | null;
  stats: EngineStats;
  gender: Gender;
  occasion: Occasion;
  outfitId: string | null;
  selection: OutfitSelection;
  activeSlot: SlotId;
  quality: QualityLevel;
  mirror: boolean;
  skeleton: boolean;
  occlusion: boolean;
  autoLight: boolean;
  fit: 'cover' | 'contain';
  pose: MannequinPose;
  autoRotate: boolean;
  panel: PanelTab;
  sheetExpanded: boolean;
  onboarded: boolean;
  settingsOpen: boolean;
  captures: Capture[];
  viewer: string | null;
  toasts: Toast[];
  thumbs: Record<string, string>;
  timer: 0 | 3 | 10;
  countdown: number;
  recording: boolean;
  recordStart: number;
  hasMultipleCameras: boolean;
  /** Wear the outfit's headwear and jewellery (false = "None"). */
  accessories: boolean;
  /** Selected background id (see engine/backgrounds/catalog). */
  bgId: string;
  /** A picture background is being painted. */
  bgPainting: boolean;
  /** Person cut-out (segmentation) readiness. */
  bgCutout: BackdropState;
  bgMsg: string | null;
  bgThumbs: Record<string, string>;
  bgUploads: { id: string; name: string }[];
  /** A photo of the office has been provided (in-app upload). */
  officeCustom: boolean;
  /** Turn bright windows in the office photo into a fireworks night sky. */
  officeWindows: boolean;
  /** Twinkling lights and live fireworks. */
  bgAnimate: boolean;

  // actions
  setMode: (m: SourceMode) => void;
  setStatus: (s: TrackingStatus, msg?: string | null, progress?: number) => void;
  setHint: (h: string | null) => void;
  setStats: (s: EngineStats) => void;
  setGender: (g: Gender) => void;
  setOccasion: (o: Occasion) => void;
  chooseOutfit: (id: string) => void;
  cycleOutfit: (dir: 1 | -1) => void;
  setActiveSlot: (s: SlotId) => void;
  setPiece: (slot: SlotId, pieceId: string | null) => void;
  updateSlot: (slot: SlotId, patch: Partial<SlotState> & { colors?: Partial<SlotState['fabric']['colors']> }) => void;
  setParam: (slot: SlotId, key: string, value: unknown) => void;
  resetOutfit: () => void;
  setSetting: <K extends 'quality' | 'mirror' | 'skeleton' | 'occlusion' | 'autoLight' | 'fit'>(k: K, v: AppState[K]) => void;
  setPose: (p: MannequinPose) => void;
  setAutoRotate: (v: boolean) => void;
  setPanel: (p: PanelTab) => void;
  setSheetExpanded: (v: boolean) => void;
  setOnboarded: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  addCapture: (c: Capture) => void;
  removeCapture: (id: string) => void;
  setViewer: (id: string | null) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  setThumb: (id: string, url: string) => void;
  setTimer: (t: 0 | 3 | 10) => void;
  setCountdown: (n: number) => void;
  setRecording: (v: boolean) => void;
  setHasMultipleCameras: (v: boolean) => void;
  setAccessories: (v: boolean) => void;
}

let toastId = 1;

function pushSelection(sel: OutfitSelection) {
  engineRef?.setSelection(sel);
}

export function persist(s: AppState) {
  savePrefs({
    quality: s.quality,
    mirror: s.mirror,
    skeleton: s.skeleton,
    occlusion: s.occlusion,
    autoLight: s.autoLight,
    fit: s.fit,
    gender: s.gender,
    onboarded: s.onboarded,
    bgId: s.bgId,
    bgAnimate: s.bgAnimate,
    officeWindows: s.officeWindows,
    accessories: s.accessories,
  });
}

export const useApp = create<AppState>((set, get) => ({
  mode: 'mannequin',
  status: 'idle',
  statusMsg: null,
  progress: 0,
  hint: null,
  stats: { fps: 0, inferMs: 0, renderMs: 0, segMs: 0, delegate: '-' },
  gender: initialGender,
  occasion: 'All',
  outfitId: initialOutfit.id,
  selection: outfitSelection(initialOutfit, prefs.accessories ?? true),
  activeSlot: 'top',
  quality: prefs.quality ?? (isMobile() ? 'balanced' : 'quality'),
  mirror: prefs.mirror ?? true,
  skeleton: prefs.skeleton ?? false,
  occlusion: prefs.occlusion ?? true,
  autoLight: prefs.autoLight ?? true,
  fit: prefs.fit ?? 'cover',
  pose: 'relaxed',
  autoRotate: true,
  panel: 'outfits',
  sheetExpanded: false,
  onboarded: prefs.onboarded ?? false,
  settingsOpen: false,
  captures: [],
  viewer: null,
  toasts: [],
  thumbs: {},
  timer: 0,
  countdown: 0,
  recording: false,
  recordStart: 0,
  hasMultipleCameras: false,
  accessories: prefs.accessories ?? true,
  bgId: prefs.bgId ?? DEFAULT_BACKGROUND,
  bgPainting: false,
  bgCutout: 'idle',
  bgMsg: null,
  bgThumbs: {},
  bgUploads: [],
  officeCustom: false,
  officeWindows: prefs.officeWindows ?? true,
  bgAnimate: prefs.bgAnimate ?? !reducedMotion,

  setMode: (mode) => set({ mode }),
  setStatus: (status, msg = null, progress) => set((s) => ({ status, statusMsg: msg, progress: progress ?? s.progress })),
  setHint: (hint) => set({ hint }),
  setStats: (stats) => set({ stats }),
  setGender: (gender) => {
    if (gender === get().gender) return;
    const first = OUTFITS.find((o) => o.gender === gender && (get().occasion === 'All' || o.occasion === get().occasion)) ?? OUTFITS.find((o) => o.gender === gender)!;
    const selection = outfitSelection(first, get().accessories);
    set({ gender, outfitId: first.id, selection, activeSlot: 'top' });
    pushSelection(selection);
    persist(get());
  },
  setOccasion: (occasion) => set({ occasion }),
  chooseOutfit: (id) => {
    const o = OUTFIT_MAP.get(id);
    if (!o) return;
    const selection = outfitSelection(o, get().accessories);
    set({ outfitId: id, selection, gender: o.gender, activeSlot: 'top' });
    pushSelection(selection);
  },
  cycleOutfit: (dir) => {
    const { gender, occasion, outfitId } = get();
    const list = OUTFITS.filter((o) => o.gender === gender && (occasion === 'All' || o.occasion === occasion));
    if (!list.length) return;
    const i = list.findIndex((o) => o.id === outfitId);
    const next = list[(i + dir + list.length) % list.length];
    get().chooseOutfit(next.id);
  },
  setActiveSlot: (activeSlot) => set({ activeSlot }),
  setPiece: (slot, pieceId) => {
    const sel = get().selection;
    const slots = { ...sel.slots };
    if (!pieceId) delete slots[slot];
    else {
      const prev = slots[slot];
      const st = slotStateFromRef({ piece: pieceId });
      if (!st) return;
      // keep the user's colours when swapping between pieces of the same slot
      if (prev && !PIECE_MAP.get(pieceId)?.noFabric && !PIECE_MAP.get(prev.pieceId)?.noFabric) st.fabric = { ...st.fabric, colors: { ...prev.fabric.colors } };
      slots[slot] = st;
      // a saree brings its own pallu, so it replaces a separate drape
      if (slot === 'bottom' && PIECE_MAP.get(pieceId)?.kind === 'saree') delete slots.drape;
      if (slot === 'drape' && slots.bottom && PIECE_MAP.get(slots.bottom.pieceId)?.kind === 'saree') delete slots.bottom;
    }
    const selection = { ...sel, slots };
    // picking a headwear or jewellery piece turns accessories back on
    const accessories = pieceId && ACCESSORY_SLOTS.includes(slot) ? true : get().accessories;
    set({ selection, outfitId: null, activeSlot: slot, accessories });
    pushSelection(selection);
    persist(get());
  },
  updateSlot: (slot, patch) => {
    const sel = get().selection;
    const cur = sel.slots[slot];
    if (!cur) return;
    const next: SlotState = {
      ...cur,
      ...patch,
      fabric: { ...cur.fabric, ...(patch.fabric ?? {}), colors: { ...cur.fabric.colors, ...(patch.fabric?.colors ?? {}), ...(patch.colors ?? {}) } },
      params: { ...cur.params, ...(patch.params ?? {}) },
    };
    const selection = { ...sel, slots: { ...sel.slots, [slot]: next } };
    set({ selection, outfitId: null });
    pushSelection(selection);
  },
  setParam: (slot, key, value) => get().updateSlot(slot, { params: { [key]: value } }),
  resetOutfit: () => {
    const { outfitId, gender } = get();
    const o = (outfitId && OUTFIT_MAP.get(outfitId)) || OUTFITS.find((x) => x.gender === gender)!;
    get().chooseOutfit(o.id);
  },
  setSetting: (k, v) => {
    set({ [k]: v } as Partial<AppState>);
    const e = engineRef;
    if (e) {
      if (k === 'quality') e.setQuality(v as QualityLevel);
      if (k === 'mirror') e.setMirror(v as boolean);
      if (k === 'skeleton') e.setShowSkeleton(v as boolean);
      if (k === 'occlusion') e.occlusion = v as boolean;
      if (k === 'autoLight') e.autoLighting = v as boolean;
      if (k === 'fit') e.setFit(v as 'cover' | 'contain');
    }
    persist(get());
  },
  setPose: (pose) => {
    set({ pose });
    engineRef?.setMannequinPose(pose);
  },
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setPanel: (panel) => set({ panel }),
  setSheetExpanded: (sheetExpanded) => set({ sheetExpanded }),
  setOnboarded: (onboarded) => {
    set({ onboarded });
    persist(get());
  },
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  addCapture: (c) => set((s) => ({ captures: [c, ...s.captures].slice(0, 40) })),
  removeCapture: (id) =>
    set((s) => {
      const c = s.captures.find((x) => x.id === id);
      if (c) URL.revokeObjectURL(c.url);
      const captures = s.captures.filter((x) => x.id !== id);
      return { captures, viewer: s.viewer === id ? (captures[0]?.id ?? null) : s.viewer };
    }),
  setViewer: (viewer) => set({ viewer }),
  toast: (text, tone = 'info') => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
    setTimeout(() => get().dismissToast(id), tone === 'error' ? 6500 : 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setThumb: (id, url) => set((s) => ({ thumbs: { ...s.thumbs, [id]: url } })),
  setTimer: (timer) => set({ timer }),
  setCountdown: (countdown) => set({ countdown }),
  setRecording: (recording) => set({ recording, recordStart: recording ? performance.now() : 0 }),
  setHasMultipleCameras: (hasMultipleCameras) => set({ hasMultipleCameras }),
  setAccessories: (accessories) => {
    const { selection, outfitId } = get();
    let next: OutfitSelection;
    if (!accessories) next = withoutAccessories(selection);
    else {
      // bring back the chosen outfit's own headwear and jewellery, keep everything else
      const o = outfitId ? OUTFIT_MAP.get(outfitId) : null;
      const restore = o ? selectionFromOutfit(o).slots : {};
      next = { ...selection, slots: { ...selection.slots } };
      for (const k of ACCESSORY_SLOTS) if (restore[k] && !next.slots[k]) next.slots[k] = restore[k];
    }
    set({ accessories, selection: next, activeSlot: !accessories && ACCESSORY_SLOTS.includes(get().activeSlot) ? 'top' : get().activeSlot });
    pushSelection(next);
    persist(get());
  },
}));
