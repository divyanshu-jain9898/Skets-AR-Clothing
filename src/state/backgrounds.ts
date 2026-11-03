import { BackgroundLibrary } from '../engine/backgrounds/BackgroundLibrary';
import { BACKGROUNDS, DEFAULT_BACKGROUND } from '../engine/backgrounds/catalog';
import { getEngine, persist, useApp } from './store';

/**
 * Background selection: paints (or loads) the picture for the selected
 * background and hands it to the engine. Switching never touches the camera
 * or the tracker, so it is instant once a picture is painted.
 */
const library = new BackgroundLibrary();
const st = () => useApp.getState();
let portrait = false;
let request = 0;
let initialised = false;

let loading: Promise<void> | null = null;

/** Loads stored pictures and starts the previews (once per page). */
function loadOnce() {
  loading ??= (async () => {
    library.officeWindows = st().officeWindows;
    try {
      await library.init();
    } catch (err) {
      console.warn('[backgrounds] storage unavailable', err);
    }
    useApp.setState({ bgUploads: [...library.uploads], officeCustom: library.officeCustom });
    if (!library.def(st().bgId)) useApp.setState({ bgId: DEFAULT_BACKGROUND });
    initialised = true;
    // previews: office first, then the collection, then the user's pictures
    const ids = ['office', ...BACKGROUNDS.filter((b) => b.kind === 'scene').map((b) => b.id), ...library.uploads.map((u) => u.id)];
    for (const id of ids) void thumb(id);
  })();
  return loading;
}

/** Call whenever an engine is created: applies the saved selection to it. */
export async function initBackgrounds() {
  const e = getEngine();
  if (!e) return;
  e.setBackdropAnimation(st().bgAnimate);
  portrait = e.viewPortrait;
  await loadOnce();
  if (getEngine() === e) await apply(st().bgId);
}

async function thumb(id: string) {
  try {
    const url = await library.thumbnail(id);
    useApp.setState((s) => ({ bgThumbs: { ...s.bgThumbs, [id]: url } }));
  } catch (err) {
    console.warn('[backgrounds] thumbnail failed', id, err);
  }
}

export function selectBackground(id: string) {
  if (!library.def(id)) return;
  useApp.setState({ bgId: id });
  persist(st());
  void apply(id);
}

async function apply(id: string) {
  const e = getEngine();
  const def = library.def(id);
  if (!e || !def) return;
  const token = ++request;
  if (def.kind === 'camera' || def.kind === 'none') {
    useApp.setState({ bgPainting: false, bgMsg: null });
    e.setBackdrop({ kind: def.kind });
    return;
  }
  useApp.setState({ bgPainting: true, bgMsg: `Painting ${def.name}…` });
  try {
    const b = await library.backdrop(id, portrait);
    if (token !== request) return;
    getEngine()?.setBackdrop(b);
    useApp.setState({ bgPainting: false, bgMsg: null });
  } catch (err) {
    if (token !== request) return;
    useApp.setState({ bgPainting: false, bgMsg: null });
    st().toast(`Could not prepare "${def.name}": ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

/** The view changed orientation (phone rotated, window resized): repaint to fit. */
export function onFrameOrientation(p: boolean) {
  if (p === portrait) return;
  portrait = p;
  if (!initialised) return;
  const def = library.def(st().bgId);
  if (def && def.kind !== 'camera' && def.kind !== 'none') void apply(def.id);
}

export function setBackgroundAnimation(on: boolean) {
  useApp.setState({ bgAnimate: on });
  persist(st());
  getEngine()?.setBackdropAnimation(on);
}

export async function setOfficeWindows(on: boolean) {
  useApp.setState({ officeWindows: on });
  persist(st());
  library.officeWindows = on;
  await refreshOffice();
}

async function refreshOffice() {
  useApp.setState((s) => {
    const bgThumbs = { ...s.bgThumbs };
    delete bgThumbs.office;
    return { bgThumbs };
  });
  void thumb('office');
  if (st().bgId === 'office') await apply('office');
}

/** Opens the file picker and calls `fn` with the chosen image. */
function pickImage(fn: (f: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) fn(f);
  };
  input.click();
}

export function pickBackgroundPicture() {
  pickImage((f) => void addBackgroundPicture(f));
}

export function pickOfficePhoto() {
  pickImage((f) => void setOfficePhoto(f));
}

export async function addBackgroundPicture(file: File) {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i.test(file.name)) {
    st().toast('Please choose an image file (JPEG, PNG or WebP).', 'error');
    return;
  }
  try {
    const info = await library.addUpload(file, file.name);
    useApp.setState({ bgUploads: [...library.uploads] });
    void thumb(info.id);
    selectBackground(info.id);
    st().toast('Your picture is now behind you');
  } catch (err) {
    st().toast(err instanceof Error ? err.message : String(err), 'error');
  }
}

export async function removeBackgroundPicture(id: string) {
  await library.removeUpload(id);
  useApp.setState((s) => {
    const bgThumbs = { ...s.bgThumbs };
    if (bgThumbs[id]) URL.revokeObjectURL(bgThumbs[id]);
    delete bgThumbs[id];
    return { bgUploads: [...library.uploads], bgThumbs };
  });
  if (st().bgId === id) selectBackground(DEFAULT_BACKGROUND);
}

/** Uses a photo of the office for "My Office – Diwali Edition" (null = built-in). */
export async function setOfficePhoto(file: File | null) {
  try {
    await library.setOfficePhoto(file);
    useApp.setState({ officeCustom: library.officeCustom, bgId: 'office' });
    persist(st());
    await refreshOffice();
    if (st().bgId !== 'office') selectBackground('office');
    st().toast(file ? 'Your office is now a Diwali canvas painting' : 'Back to the built-in office painting');
  } catch (err) {
    st().toast(err instanceof Error ? err.message : String(err), 'error');
  }
}
