/** Phones held upright (and narrow windows): outfits live in a bottom sheet. Must match app.css. */
export const SHEET_LAYOUT = '(max-width: 760px) and (min-height: 521px)';

export const isSheetLayout = () => typeof window !== 'undefined' && !!window.matchMedia?.(SHEET_LAYOUT).matches;
