/** Backgrounds offered in the app. Painted scenes are generated on the device. */
export type BackgroundCategory = 'basic' | 'office' | 'diwali' | 'custom';
export type BackgroundKind = 'camera' | 'none' | 'scene' | 'office' | 'custom';

export interface BackgroundDef {
  id: string;
  name: string;
  category: BackgroundCategory;
  kind: BackgroundKind;
  blurb: string;
  /** Scene id for painted scenes. */
  scene?: string;
}

export const OFFICE_CATEGORY = 'My Office – Diwali Edition';

export const BACKGROUNDS: BackgroundDef[] = [
  { id: 'camera', name: 'Camera', category: 'basic', kind: 'camera', blurb: 'Your real surroundings, as the camera sees them' },
  { id: 'none', name: 'None', category: 'basic', kind: 'none', blurb: 'Background removed, plain studio backdrop' },
  { id: 'office', name: 'My Office – Diwali Edition', category: 'office', kind: 'office', blurb: 'The office as a canvas painting, dressed for Diwali with diyas, lanterns and fireworks' },
  { id: 'crackers', name: 'Diwali Crackers', category: 'diwali', kind: 'scene', scene: 'crackers', blurb: 'Fireworks and crackers over the old town' },
  { id: 'diyas', name: 'Diya Decorations', category: 'diwali', kind: 'scene', scene: 'diyas', blurb: 'Earthen diyas glowing in festive rows' },
  { id: 'house', name: 'Illuminated House', category: 'diwali', kind: 'scene', scene: 'house', blurb: 'A home lit with lights, lanterns and diyas' },
  { id: 'festive', name: 'Festive Decoration', category: 'diwali', kind: 'scene', scene: 'festive', blurb: 'Rangoli, marigolds and fairy lights' },
  { id: 'night', name: 'Diwali Night Scene', category: 'diwali', kind: 'scene', scene: 'night', blurb: 'A riverside ghat under a sky of fireworks' },
  { id: 'interior', name: 'Traditional Interior', category: 'diwali', kind: 'scene', scene: 'interior', blurb: 'Carved arches, brass lamps and diyas indoors' },
];

export const BACKGROUND_MAP = new Map(BACKGROUNDS.map((b) => [b.id, b]));

/** Selected on first launch: the festive office painting. */
export const DEFAULT_BACKGROUND = 'office';

/** Built-in office photo. Drop your own at public/backgrounds/my-office.jpg (or .png / .webp). */
export const OFFICE_PHOTO_URLS = ['backgrounds/my-office.jpg', 'backgrounds/my-office.jpeg', 'backgrounds/my-office.png', 'backgrounds/my-office.webp'];
