import { H } from '../body/BodyShape';
import type { FabricSpec } from '../materials/FabricLibrary';
import type { Gender } from '../core/types';
import type { OutfitDef, OutfitSelection, PieceDef, SlotState, StyleControl } from './types';

const ZARI_GOLD = '#d4af37';
const ZARI_SILVER = '#c3c7cf';

const fab = (base: string, accent: string, border: string, zari = ZARI_GOLD, extra: Partial<FabricSpec> = {}): FabricSpec => ({
  type: 'cotton',
  pattern: 'plain',
  border: 'simple',
  colors: { base, accent, border, zari },
  ...extra,
});

// ---------- reusable style controls ----------
const LENGTH_TOP: StyleControl = {
  key: 'hem',
  label: 'Length',
  options: [
    { label: 'Waist', value: H.WAIST + 0.18 },
    { label: 'Hip', value: H.HIP + 0.1 },
    { label: 'Thigh', value: H.THIGH },
    { label: 'Knee', value: H.KNEE },
    { label: 'Calf', value: H.CALF },
    { label: 'Floor', value: H.FLOOR },
  ],
};
const SLEEVES: StyleControl = {
  key: 'sleeve',
  label: 'Sleeves',
  options: [
    { label: 'Sleeveless', value: 0 },
    { label: 'Cap', value: 0.2 },
    { label: 'Short', value: 0.4 },
    { label: 'Elbow', value: 0.6 },
    { label: '¾', value: 0.8 },
    { label: 'Full', value: 1 },
  ],
};
const FIT: StyleControl = {
  key: 'ease',
  label: 'Fit',
  options: [
    { label: 'Slim', value: 0.035 },
    { label: 'Regular', value: 0.07 },
    { label: 'Relaxed', value: 0.11 },
    { label: 'Loose', value: 0.16 },
  ],
};
const NECK: StyleControl = {
  key: 'neckline',
  label: 'Neckline',
  options: [
    { label: 'Round', value: 'round' },
    { label: 'V-neck', value: 'v' },
    { label: 'Mandarin', value: 'mandarin' },
    { label: 'Boat', value: 'boat' },
    { label: 'Sweetheart', value: 'sweetheart' },
  ],
};
const FLARE: StyleControl = { key: 'flare', label: 'Flare', min: 0, max: 1.4, step: 0.05 };
const SKIRT_FLARE: StyleControl = { key: 'flare', label: 'Flare', min: 0.1, max: 1.6, step: 0.05 };
const PLEATS: StyleControl = {
  key: 'pleats',
  label: 'Kalis (panels)',
  options: [
    { label: 'None', value: 0 },
    { label: '12', value: 12 },
    { label: '24', value: 24 },
    { label: '36', value: 36 },
  ],
};
const PANTS_STYLE: StyleControl = {
  key: 'style',
  label: 'Cut',
  options: [
    { label: 'Churidar', value: 'churidar' },
    { label: 'Pyjama', value: 'pyjama' },
    { label: 'Salwar', value: 'salwar' },
    { label: 'Palazzo', value: 'palazzo' },
    { label: 'Sharara', value: 'sharara' },
    { label: 'Dhoti', value: 'dhoti' },
    { label: 'Jodhpuri', value: 'jodhpuri' },
  ],
};
const DRAPE_STYLE: StyleControl = {
  key: 'style',
  label: 'Draping',
  options: [
    { label: 'Across front', value: 'dupatta-front' },
    { label: 'One shoulder', value: 'dupatta-shoulder' },
    { label: 'Stole', value: 'stole' },
  ],
};

// ---------- pieces ----------
export const PIECES: PieceDef[] = [
  // ===== Men: tops
  {
    id: 'kurta-classic',
    name: 'Classic Kurta',
    slot: 'top',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.KNEE, ease: 0.08, flare: 0.1, neckline: 'mandarin', collarHeight: 0.1, opening: 'placket', placketLen: 0.85, buttons: 4, buttonStyle: 'pearl', slits: H.HIP + 0.15, hemCurve: 0.12, hemBorder: 0.05, cuffBorder: 0.05 },
    fabric: fab('#f4ecd8', '#e8dcc0', '#e0d2b2', ZARI_GOLD, { type: 'cotton', pattern: 'chikankari', border: 'simple' }),
    controls: [LENGTH_TOP, SLEEVES, FIT, NECK, FLARE],
  },
  {
    id: 'kurta-short',
    name: 'Short Kurta',
    slot: 'top',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.THIGH, ease: 0.08, flare: 0.06, neckline: 'mandarin', collarHeight: 0.09, opening: 'placket', placketLen: 0.8, buttons: 3, buttonStyle: 'gold', slits: H.HIP + 0.1, hemBorder: 0.06, cuffBorder: 0.05 },
    fabric: fab('#e9a23b', '#c77d19', '#7a2e12', ZARI_GOLD, { type: 'silk', pattern: 'plain', border: 'simple' }),
    controls: [LENGTH_TOP, SLEEVES, FIT, NECK],
  },
  {
    id: 'pathani',
    name: 'Pathani Kurta',
    slot: 'top',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.KNEE + 0.1, ease: 0.11, flare: 0.08, neckline: 'mandarin', collarHeight: 0.13, opening: 'placket', placketLen: 0.95, buttons: 5, buttonStyle: 'silver', slits: H.HIP + 0.2, hemCurve: 0.35, hemBorder: 0, cuffBorder: 0.09 },
    fabric: fab('#3a3a3c', '#2c2c2e', '#2a2a2c', ZARI_SILVER, { type: 'linen', pattern: 'plain', border: 'none' }),
    controls: [LENGTH_TOP, SLEEVES, FIT],
  },
  {
    id: 'sherwani',
    name: 'Sherwani',
    slot: 'top',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.KNEE + 0.25, ease: 0.08, flare: 0.16, neckline: 'mandarin', collarHeight: 0.14, opening: 'full', buttons: 8, buttonStyle: 'gold', slits: H.HIP + 0.35, hemBorder: 0.16, neckBorder: 0, cuffBorder: 0.12, waistFit: 0.25 },
    fabric: fab('#efe0bd', '#cfa65a', '#7a1325', ZARI_GOLD, { type: 'brocade', pattern: 'brocade', border: 'vine' }),
    controls: [LENGTH_TOP, FIT, FLARE],
  },
  {
    id: 'bandhgala',
    name: 'Bandhgala Coat',
    slot: 'top',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.HIP + 0.32, ease: 0.07, flare: 0.04, neckline: 'mandarin', collarHeight: 0.13, opening: 'full', buttons: 6, buttonStyle: 'gold', slits: H.HIP + 0.1, hemBorder: 0, cuffBorder: 0, waistFit: 0.35 },
    fabric: fab('#1d2647', '#283462', '#1d2647', ZARI_GOLD, { type: 'velvet', pattern: 'plain', border: 'none' }),
    controls: [LENGTH_TOP, FIT],
  },
  {
    id: 'shirt-half',
    name: 'Half-sleeve Shirt',
    slot: 'top',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.HIP + 0.18, ease: 0.08, flare: 0.02, neckline: 'mandarin', collarHeight: 0.07, opening: 'full', buttons: 5, buttonStyle: 'pearl', sleeve: 0.4, hemBorder: 0, cuffBorder: 0, hemCurve: 0.1 },
    fabric: fab('#f7f5ef', '#ebe6da', '#ebe6da', ZARI_GOLD, { type: 'cotton', pattern: 'plain', border: 'none' }),
    controls: [SLEEVES, FIT],
  },
  // ===== Men: layers
  {
    id: 'nehru-jacket',
    name: 'Nehru Jacket',
    slot: 'layer',
    gender: 'men',
    kind: 'torso',
    params: { hem: H.HIP + 0.22, ease: 0.06, flare: 0.02, neckline: 'mandarin', collarHeight: 0.12, opening: 'full', buttons: 6, buttonStyle: 'gold', sleeve: 0, armhole: 1, layer: 1, hemBorder: 0, waistFit: 0.4, slits: H.HIP + 0.05 },
    fabric: fab('#6b1424', '#a0702a', '#6b1424', ZARI_GOLD, { type: 'brocade', pattern: 'jaal', border: 'none' }),
    controls: [FIT],
  },
  // ===== Men: bottoms
  { id: 'churidar-m', name: 'Churidar', slot: 'bottom', gender: 'unisex', kind: 'pants', params: { style: 'churidar', hemT: 2.06 }, fabric: fab('#f1e8d6', '#e6dac2', '#e6dac2', ZARI_GOLD, { type: 'silk' }), controls: [PANTS_STYLE] },
  { id: 'pyjama', name: 'Pyjama', slot: 'bottom', gender: 'men', kind: 'pants', params: { style: 'pyjama', hemT: 2.05 }, fabric: fab('#f6f2e9', '#efe9dc', '#efe9dc', ZARI_GOLD, { type: 'cotton' }), controls: [PANTS_STYLE] },
  { id: 'dhoti', name: 'Dhoti', slot: 'bottom', gender: 'men', kind: 'pants', params: { style: 'dhoti', hemT: 1.75, hemBorder: 0.1 }, fabric: fab('#f3ead6', '#e9dcc0', '#9c2a1a', ZARI_GOLD, { type: 'cotton', border: 'simple' }), controls: [PANTS_STYLE] },
  { id: 'salwar-m', name: 'Pathani Salwar', slot: 'bottom', gender: 'men', kind: 'pants', params: { style: 'salwar', hemT: 2.02 }, fabric: fab('#3a3a3c', '#2c2c2e', '#2a2a2c', ZARI_SILVER, { type: 'linen' }), controls: [PANTS_STYLE] },
  { id: 'jodhpuri', name: 'Jodhpuri Breeches', slot: 'bottom', gender: 'men', kind: 'pants', params: { style: 'jodhpuri', hemT: 2.04 }, fabric: fab('#e8dcc4', '#d8c9aa', '#d8c9aa', ZARI_GOLD, { type: 'linen' }), controls: [PANTS_STYLE] },
  {
    id: 'veshti',
    name: 'Veshti / Mundu',
    slot: 'bottom',
    gender: 'men',
    kind: 'skirt',
    params: { top: H.WAIST + 0.18, hem: H.ANKLE + 0.05, ease: 0.05, flare: 0.12, pleats: 5, pleatDepth: 0.01, waistBand: 0, hemBorder: 0.14, wrapEdge: 0.45, sway: 0.5 },
    fabric: fab('#f8f4ea', '#efe8d8', '#c9a227', ZARI_GOLD, { type: 'cotton', border: 'kasavu' }),
    controls: [],
  },
  // ===== Men: drapes / head / jewellery
  { id: 'stole', name: 'Stole', slot: 'drape', gender: 'unisex', kind: 'drape', params: { style: 'stole', length: 1.8, width: 0.17 }, fabric: fab('#7a1325', '#a0302d', '#7a1325', ZARI_GOLD, { type: 'velvet', pattern: 'plain', border: 'gota' }), controls: [DRAPE_STYLE] },
  { id: 'angavastram', name: 'Angavastram', slot: 'drape', gender: 'men', kind: 'drape', params: { style: 'stole', length: 1.6, width: 0.22 }, fabric: fab('#f8f4ea', '#efe8d8', '#c9a227', ZARI_GOLD, { type: 'cotton', border: 'kasavu' }), controls: [DRAPE_STYLE] },
  { id: 'safa', name: 'Rajasthani Safa', slot: 'head', gender: 'men', kind: 'turban', params: { style: 'safa', tail: true, kalgi: true }, fabric: fab('#c2185b', '#f2a33a', '#c2185b', ZARI_GOLD, { type: 'silk', pattern: 'leheriya', border: 'none' }), controls: [{ key: 'style', label: 'Style', options: [{ label: 'Safa', value: 'safa' }, { label: 'Pagdi', value: 'pagdi' }] }, { key: 'kalgi', label: 'Kalgi brooch', options: [{ label: 'On', value: true }, { label: 'Off', value: false }] }, { key: 'tail', label: 'Tail', options: [{ label: 'On', value: true }, { label: 'Off', value: false }] }] },
  { id: 'topi', name: 'Gandhi Topi', slot: 'head', gender: 'men', kind: 'topi', params: {}, fabric: fab('#f7f5ef', '#ebe6da', '#ebe6da', ZARI_GOLD, { type: 'khadi' }), controls: [] },
  { id: 'mala', name: 'Groom Mala', slot: 'jewelry', gender: 'men', kind: 'jewelry', params: { necklace: 'mala', earrings: false, tikka: false, metal: 'gold', stone: 'emerald' }, fabric: fab('#ffffff', '#ffffff', '#ffffff'), controls: [], noFabric: true },

  // ===== Women: tops
  {
    id: 'blouse',
    name: 'Saree Blouse',
    slot: 'top',
    gender: 'women',
    kind: 'torso',
    params: { hem: H.WAIST + 0.22, ease: 0.035, flare: 0, waistFit: 0.5, bust: 1, neckline: 'round', neckDepth: 0.24, backDepth: 0.12, opening: 'none', sleeve: 0.4, sleeveEase: 0.03, hemBorder: 0.05, cuffBorder: 0.06, sway: 0 },
    fabric: fab('#c9a227', '#b0122e', '#b0122e', ZARI_GOLD, { type: 'silk', pattern: 'booti', border: 'simple' }),
    controls: [SLEEVES, NECK],
  },
  {
    id: 'choli',
    name: 'Choli',
    slot: 'top',
    gender: 'women',
    kind: 'torso',
    params: { hem: H.WAIST + 0.22, ease: 0.035, flare: 0, waistFit: 0.6, bust: 1, neckline: 'sweetheart', neckDepth: 0.26, backDepth: 0.14, opening: 'none', sleeve: 0.6, sleeveEase: 0.03, hemBorder: 0.07, cuffBorder: 0.07, sway: 0 },
    fabric: fab('#9e0f2c', '#d4af37', '#7a0b22', ZARI_GOLD, { type: 'velvet', pattern: 'booti', border: 'vine' }),
    controls: [SLEEVES, NECK],
  },
  {
    id: 'anarkali',
    name: 'Anarkali',
    slot: 'top',
    gender: 'women',
    kind: 'torso',
    params: { hem: H.FLOOR - 0.12, ease: 0.04, flare: 0.82, flareStart: H.WAIST - 0.05, waistFit: 0.75, bust: 1, neckline: 'round', neckDepth: 0.2, opening: 'none', sleeve: 1, sleeveEase: 0.035, pleats: 28, pleatDepth: 0.045, pleatStart: H.WAIST - 0.05, waistBand: 0.08, hemBorder: 0.2, cuffBorder: 0.08, sway: 1 },
    fabric: fab('#0f5e7a', '#d4af37', '#0b4a60', ZARI_GOLD, { type: 'georgette', pattern: 'booti', border: 'vine' }),
    controls: [SLEEVES, NECK, FLARE, PLEATS],
  },
  {
    id: 'kameez',
    name: 'Kameez',
    slot: 'top',
    gender: 'women',
    kind: 'torso',
    params: { hem: H.KNEE, ease: 0.06, flare: 0.1, waistFit: 0.3, bust: 1, neckline: 'round', neckDepth: 0.2, opening: 'none', sleeve: 0.8, slits: H.HIP + 0.05, hemBorder: 0.07, cuffBorder: 0.06 },
    fabric: fab('#f2c12e', '#d6246e', '#d6246e', ZARI_GOLD, { type: 'cotton', pattern: 'booti', border: 'simple' }),
    controls: [LENGTH_TOP, SLEEVES, FIT, NECK],
  },
  {
    id: 'kurti',
    name: 'A-line Kurti',
    slot: 'top',
    gender: 'women',
    kind: 'torso',
    params: { hem: H.THIGH + 0.25, ease: 0.06, flare: 0.28, flareStart: H.BUST, waistFit: 0.2, bust: 1, neckline: 'v', neckDepth: 0.35, opening: 'none', sleeve: 0.8, hemBorder: 0.06, cuffBorder: 0.05 },
    fabric: fab('#f4ecd8', '#1f3b8f', '#1f3b8f', ZARI_GOLD, { type: 'cotton', pattern: 'block', border: 'simple' }),
    controls: [LENGTH_TOP, SLEEVES, FIT, NECK, FLARE],
  },
  {
    id: 'kurti-short',
    name: 'Short Kurti',
    slot: 'top',
    gender: 'women',
    kind: 'torso',
    params: { hem: H.HIP + 0.2, ease: 0.05, flare: 0.12, waistFit: 0.35, bust: 1, neckline: 'round', neckDepth: 0.22, opening: 'none', sleeve: 0.8, hemBorder: 0.07, cuffBorder: 0.05, slits: H.HIP - 0.05 },
    fabric: fab('#a8d8c0', '#d4af37', '#5e9c84', ZARI_GOLD, { type: 'georgette', pattern: 'chikankari', border: 'gota' }),
    controls: [LENGTH_TOP, SLEEVES, FIT, NECK],
  },
  // ===== Women: bottoms
  {
    id: 'saree',
    name: 'Saree',
    slot: 'bottom',
    gender: 'women',
    kind: 'saree',
    params: { drape: 'nivi' },
    fabric: fab('#a50d2c', '#d4af37', '#6d0f1f', ZARI_GOLD, { type: 'silk', pattern: 'brocade', border: 'temple' }),
    controls: [{ key: 'drape', label: 'Pallu', options: [{ label: 'Left shoulder (Nivi)', value: 'nivi' }, { label: 'Right shoulder', value: 'seedha' }] }],
  },
  {
    id: 'lehenga',
    name: 'Lehenga',
    slot: 'bottom',
    gender: 'women',
    kind: 'skirt',
    params: { top: H.WAIST + 0.12, hem: H.FLOOR, ease: 0.05, flare: 1.0, pleats: 24, pleatDepth: 0.05, waistBand: 0.07, hemBorder: 0.26, midBorder: 0.08, sway: 1 },
    fabric: fab('#9e0f2c', '#d4af37', '#7a0b22', ZARI_GOLD, { type: 'velvet', pattern: 'booti', border: 'vine' }),
    controls: [SKIRT_FLARE, PLEATS],
  },
  {
    id: 'langa',
    name: 'Pattu Langa',
    slot: 'bottom',
    gender: 'women',
    kind: 'skirt',
    params: { top: H.WAIST + 0.12, hem: H.FLOOR, ease: 0.05, flare: 0.65, pleats: 18, pleatDepth: 0.035, waistBand: 0.06, hemBorder: 0.3, midBorder: 0, sway: 0.9 },
    fabric: fab('#0e6b4f', '#d4af37', '#c2185b', ZARI_GOLD, { type: 'silk', pattern: 'jaal', border: 'temple' }),
    controls: [SKIRT_FLARE, PLEATS],
  },
  { id: 'churidar-w', name: 'Churidar', slot: 'bottom', gender: 'women', kind: 'pants', params: { style: 'churidar', hemT: 2.06 }, fabric: fab('#f4ecd8', '#e8dcc0', '#e8dcc0', ZARI_GOLD, { type: 'cotton' }), controls: [PANTS_STYLE] },
  { id: 'salwar', name: 'Salwar', slot: 'bottom', gender: 'women', kind: 'pants', params: { style: 'salwar', hemT: 2.02, hemBorder: 0.05 }, fabric: fab('#d6246e', '#f2c12e', '#f2c12e', ZARI_GOLD, { type: 'cotton', border: 'simple' }), controls: [PANTS_STYLE] },
  { id: 'palazzo', name: 'Palazzo', slot: 'bottom', gender: 'women', kind: 'pants', params: { style: 'palazzo', hemT: 2.08, hemBorder: 0.06 }, fabric: fab('#1f3b8f', '#f4ecd8', '#f4ecd8', ZARI_GOLD, { type: 'cotton', border: 'simple' }), controls: [PANTS_STYLE] },
  { id: 'sharara', name: 'Sharara', slot: 'bottom', gender: 'women', kind: 'pants', params: { style: 'sharara', hemT: 2.1, hemBorder: 0.12 }, fabric: fab('#a8d8c0', '#d4af37', '#5e9c84', ZARI_GOLD, { type: 'georgette', pattern: 'chikankari', border: 'gota' }), controls: [PANTS_STYLE] },
  // ===== Women: drapes / jewellery
  { id: 'dupatta', name: 'Dupatta', slot: 'drape', gender: 'women', kind: 'drape', params: { style: 'dupatta-front' }, fabric: fab('#e48aa0', '#d4af37', '#c2185b', ZARI_GOLD, { type: 'georgette', pattern: 'booti', border: 'gota' }), controls: [DRAPE_STYLE] },
  { id: 'voni', name: 'Voni (half-saree)', slot: 'drape', gender: 'women', kind: 'saree', params: { noSkirt: true, drape: 'nivi', palluWidth: 0.85, palluLength: 0.85 }, fabric: fab('#c2185b', '#d4af37', '#0e6b4f', ZARI_GOLD, { type: 'silk', pattern: 'plain', border: 'temple' }), controls: [{ key: 'drape', label: 'Pallu', options: [{ label: 'Left shoulder', value: 'nivi' }, { label: 'Right shoulder', value: 'seedha' }] }] },
  {
    id: 'bridal-set',
    name: 'Bridal Jewellery',
    slot: 'jewelry',
    gender: 'women',
    kind: 'jewelry',
    params: { necklace: 'haar', earrings: true, tikka: true, metal: 'gold', stone: 'ruby' },
    fabric: fab('#ffffff', '#ffffff', '#ffffff'),
    noFabric: true,
    controls: [
      { key: 'necklace', label: 'Necklace', options: [{ label: 'None', value: 'none' }, { label: 'Choker', value: 'choker' }, { label: 'Haar', value: 'haar' }, { label: 'Pearls', value: 'pearls' }, { label: 'Mala', value: 'mala' }] },
      { key: 'earrings', label: 'Jhumkas', options: [{ label: 'On', value: true }, { label: 'Off', value: false }] },
      { key: 'tikka', label: 'Maang tikka', options: [{ label: 'On', value: true }, { label: 'Off', value: false }] },
      { key: 'metal', label: 'Metal', options: [{ label: 'Gold', value: 'gold' }, { label: 'Antique', value: 'antiqueGold' }, { label: 'Silver', value: 'silver' }] },
      { key: 'stone', label: 'Stone', options: [{ label: 'Ruby', value: 'ruby' }, { label: 'Emerald', value: 'emerald' }, { label: 'Pearl', value: 'pearl' }] },
    ],
  },
];

export const PIECE_MAP = new Map(PIECES.map((p) => [p.id, p]));

// ---------- outfits ----------
export const OUTFITS: OutfitDef[] = [
  // ----- Men
  {
    id: 'kurta-pyjama',
    name: 'Chikankari Kurta Pyjama',
    gender: 'men',
    region: 'Lucknow',
    occasion: 'Everyday',
    description: 'Breathable cotton kurta with tone-on-tone Lucknowi chikan embroidery, mandarin collar and pearl buttons.',
    pieces: { top: { piece: 'kurta-classic' }, bottom: { piece: 'pyjama' } },
  },
  {
    id: 'kurta-nehru',
    name: 'Kurta with Nehru Jacket',
    gender: 'men',
    region: 'Pan-India',
    occasion: 'Festive',
    description: 'Silk kurta layered with a brocade Nehru (bandi) jacket and slim churidar - a festive classic.',
    pieces: {
      top: { piece: 'kurta-classic', type: 'silk', pattern: 'plain', colors: { base: '#efe3c8', accent: '#e2d3b0', border: '#d4c09a' } },
      layer: { piece: 'nehru-jacket' },
      bottom: { piece: 'churidar-m' },
    },
  },
  {
    id: 'sherwani',
    name: 'Royal Wedding Sherwani',
    gender: 'men',
    region: 'Hyderabad',
    occasion: 'Wedding',
    description: 'Ivory brocade sherwani with zari vine borders, gold buttons, velvet stole, safa with kalgi and a pearl mala.',
    pieces: {
      top: { piece: 'sherwani' },
      bottom: { piece: 'churidar-m' },
      drape: { piece: 'stole' },
      head: { piece: 'safa', type: 'silk', pattern: 'plain', colors: { base: '#8c1328', accent: '#d4af37', border: '#8c1328' }, params: { style: 'safa' } },
      jewelry: { piece: 'mala' },
    },
  },
  {
    id: 'bandhgala',
    name: 'Jodhpuri Bandhgala',
    gender: 'men',
    region: 'Rajasthan',
    occasion: 'Festive',
    description: 'Midnight velvet closed-neck coat with gold buttons, jodhpuri breeches and a leheriya safa.',
    pieces: { top: { piece: 'bandhgala' }, bottom: { piece: 'jodhpuri' }, head: { piece: 'safa' } },
  },
  {
    id: 'dhoti-kurta',
    name: 'Dhoti Kurta',
    gender: 'men',
    region: 'Bengal',
    occasion: 'Ceremonial',
    description: 'Saffron silk short kurta, pleated cotton dhoti with a red border and a kasavu angavastram.',
    pieces: { top: { piece: 'kurta-short' }, bottom: { piece: 'dhoti' }, drape: { piece: 'angavastram' } },
  },
  {
    id: 'veshti',
    name: 'Veshti & Angavastram',
    gender: 'men',
    region: 'Kerala & Tamil Nadu',
    occasion: 'Ceremonial',
    description: 'Crisp white shirt, veshti with a broad gold kasavu border and a matching angavastram.',
    pieces: { top: { piece: 'shirt-half' }, bottom: { piece: 'veshti' }, drape: { piece: 'angavastram' } },
  },
  {
    id: 'pathani',
    name: 'Pathani Suit',
    gender: 'men',
    region: 'Punjab & Peshawar',
    occasion: 'Everyday',
    description: 'Relaxed linen pathani kurta with a curved hem and roomy salwar in charcoal.',
    pieces: { top: { piece: 'pathani' }, bottom: { piece: 'salwar-m' } },
  },
  // ----- Women
  {
    id: 'banarasi',
    name: 'Banarasi Silk Saree',
    gender: 'women',
    region: 'Varanasi',
    occasion: 'Wedding',
    description: 'Crimson brocade silk with a gold temple border, draped Nivi style, with a zari blouse, haar and jhumkas.',
    pieces: {
      top: { piece: 'blouse' },
      bottom: { piece: 'saree' },
      jewelry: { piece: 'bridal-set', params: { tikka: false } },
    },
  },
  {
    id: 'kasavu',
    name: 'Kerala Kasavu Saree',
    gender: 'women',
    region: 'Kerala',
    occasion: 'Festive',
    description: 'Off-white handloom cotton with a broad gold kasavu border, paired with a gold blouse and temple jewellery.',
    pieces: {
      top: { piece: 'blouse', type: 'silk', pattern: 'plain', colors: { base: '#c9a227', accent: '#c9a227', border: '#9c7a17' } },
      bottom: { piece: 'saree', type: 'cotton', pattern: 'plain', border: 'kasavu', colors: { base: '#f6efdc', accent: '#efe5cc', border: '#c9a227' } },
      jewelry: { piece: 'bridal-set', params: { necklace: 'choker', tikka: false, metal: 'antiqueGold', stone: 'emerald' } },
    },
  },
  {
    id: 'bridal-lehenga',
    name: 'Bridal Lehenga Choli',
    gender: 'women',
    region: 'North India',
    occasion: 'Wedding',
    description: 'Velvet lehenga with 24 kalis and double zari borders, sweetheart choli, sheer gota dupatta and bridal jewellery.',
    pieces: {
      top: { piece: 'choli' },
      bottom: { piece: 'lehenga' },
      drape: { piece: 'dupatta', params: { style: 'dupatta-shoulder' }, colors: { base: '#c2185b', accent: '#d4af37', border: '#9e0f2c' } },
      jewelry: { piece: 'bridal-set' },
    },
  },
  {
    id: 'bandhani-lehenga',
    name: 'Bandhani Chaniya Choli',
    gender: 'women',
    region: 'Gujarat',
    occasion: 'Festive',
    description: 'Garba-ready tie-dye bandhani skirt with mirror-work border, contrast choli and a leheriya dupatta.',
    pieces: {
      top: { piece: 'choli', type: 'cotton', pattern: 'plain', border: 'mirror', colors: { base: '#1f3b8f', accent: '#f2c12e', border: '#1f3b8f' } },
      bottom: { piece: 'lehenga', type: 'cotton', pattern: 'bandhani', border: 'mirror', colors: { base: '#b3121f', accent: '#f2c12e', border: '#1f3b8f' }, params: { flare: 1.0, pleats: 36 } },
      drape: { piece: 'dupatta', type: 'cotton', pattern: 'leheriya', border: 'gota', colors: { base: '#f2c12e', accent: '#d6246e', border: '#b3121f' } },
      jewelry: { piece: 'bridal-set', params: { necklace: 'choker', tikka: false, metal: 'silver', stone: 'emerald' } },
    },
  },
  {
    id: 'anarkali',
    name: 'Anarkali Suit',
    gender: 'women',
    region: 'Lucknow',
    occasion: 'Festive',
    description: 'Floor-length peacock-blue anarkali with 28 kalis, zari waistband and hem, churidar and a sheer dupatta.',
    pieces: {
      top: { piece: 'anarkali' },
      bottom: { piece: 'churidar-w' },
      drape: { piece: 'dupatta', colors: { base: '#9fd3dd', accent: '#d4af37', border: '#0f5e7a' } },
      jewelry: { piece: 'bridal-set', params: { necklace: 'none', tikka: false } },
    },
  },
  {
    id: 'salwar-kameez',
    name: 'Punjabi Salwar Kameez',
    gender: 'women',
    region: 'Punjab',
    occasion: 'Everyday',
    description: 'Haldi-yellow kameez with rani-pink booti, roomy salwar and a phulkari-style dupatta.',
    pieces: {
      top: { piece: 'kameez' },
      bottom: { piece: 'salwar' },
      drape: { piece: 'dupatta', type: 'cotton', pattern: 'block', border: 'simple', colors: { base: '#d6246e', accent: '#f2c12e', border: '#f28c28' } },
    },
  },
  {
    id: 'kurti-palazzo',
    name: 'Block-print Kurti & Palazzo',
    gender: 'women',
    region: 'Jaipur',
    occasion: 'Everyday',
    description: 'Sanganeri block-printed A-line kurti with indigo palazzo pants.',
    pieces: { top: { piece: 'kurti' }, bottom: { piece: 'palazzo' } },
  },
  {
    id: 'sharara',
    name: 'Sharara Set',
    gender: 'women',
    region: 'Lucknow',
    occasion: 'Festive',
    description: 'Mint chikankari short kurti with flared gota-trimmed sharara and a matching dupatta.',
    pieces: {
      top: { piece: 'kurti-short' },
      bottom: { piece: 'sharara' },
      drape: { piece: 'dupatta', type: 'georgette', pattern: 'chikankari', colors: { base: '#cfeadc', accent: '#d4af37', border: '#5e9c84' } },
    },
  },
  {
    id: 'half-saree',
    name: 'Half Saree (Langa Voni)',
    gender: 'women',
    region: 'Andhra & Tamil Nadu',
    occasion: 'Ceremonial',
    description: 'Silk pattu langa with a wide temple border, contrast voni draped over the shoulder and temple jewellery.',
    pieces: {
      top: { piece: 'blouse', colors: { base: '#c2185b', accent: '#d4af37', border: '#0e6b4f' }, pattern: 'plain' },
      bottom: { piece: 'langa' },
      drape: { piece: 'voni' },
      jewelry: { piece: 'bridal-set', params: { necklace: 'choker', metal: 'antiqueGold', stone: 'emerald' } },
    },
  },
];

export const OUTFIT_MAP = new Map(OUTFITS.map((o) => [o.id, o]));

export function piecesFor(gender: Gender, slot: string) {
  return PIECES.filter((p) => p.slot === slot && (p.gender === gender || p.gender === 'unisex'));
}

export function slotStateFromRef(ref: { piece: string; type?: FabricSpec['type']; pattern?: FabricSpec['pattern']; border?: FabricSpec['border']; colors?: Partial<FabricSpec['colors']>; params?: Record<string, unknown> }): SlotState | null {
  const def = PIECE_MAP.get(ref.piece);
  if (!def) return null;
  return {
    pieceId: def.id,
    fabric: {
      ...def.fabric,
      type: ref.type ?? def.fabric.type,
      pattern: ref.pattern ?? def.fabric.pattern,
      border: ref.border ?? def.fabric.border,
      colors: { ...def.fabric.colors, ...(ref.colors ?? {}) },
    },
    params: { ...def.params, ...(ref.params ?? {}) },
  };
}

export function selectionFromOutfit(outfit: OutfitDef): OutfitSelection {
  const slots: OutfitSelection['slots'] = {};
  for (const [slot, ref] of Object.entries(outfit.pieces)) {
    const st = ref ? slotStateFromRef(ref) : null;
    if (st) slots[slot as keyof typeof slots] = st;
  }
  return { gender: outfit.gender, slots };
}

/** Named Indian colour palette for the colour pickers. */
export const PALETTE: { name: string; hex: string }[] = [
  { name: 'Sindoor', hex: '#b3121f' },
  { name: 'Maroon', hex: '#6d0f1f' },
  { name: 'Rani pink', hex: '#d6246e' },
  { name: 'Gulabi', hex: '#e48aa0' },
  { name: 'Peach', hex: '#f2b38a' },
  { name: 'Saffron', hex: '#f28c28' },
  { name: 'Haldi', hex: '#f2c12e' },
  { name: 'Mustard', hex: '#c99a1c' },
  { name: 'Mehendi', hex: '#6b7d2a' },
  { name: 'Mint', hex: '#a8d8c0' },
  { name: 'Emerald', hex: '#0e6b4f' },
  { name: 'Teal', hex: '#127475' },
  { name: 'Peacock', hex: '#0f5e7a' },
  { name: 'Royal blue', hex: '#1f3b8f' },
  { name: 'Indigo', hex: '#2b2f6b' },
  { name: 'Lavender', hex: '#a99bd0' },
  { name: 'Jamuni', hex: '#5b2a6e' },
  { name: 'Wine', hex: '#5a1830' },
  { name: 'Rust', hex: '#a4452a' },
  { name: 'Ivory', hex: '#f4ecd8' },
  { name: 'Off-white', hex: '#f8f4ea' },
  { name: 'Beige', hex: '#d9c3a0' },
  { name: 'Charcoal', hex: '#3a3a3c' },
  { name: 'Black', hex: '#141214' },
];

export const ZARI_OPTIONS = [
  { name: 'Gold zari', hex: '#d4af37' },
  { name: 'Antique gold', hex: '#b8862e' },
  { name: 'Silver zari', hex: '#c3c7cf' },
  { name: 'Copper', hex: '#b87333' },
];
