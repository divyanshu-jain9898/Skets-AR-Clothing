import { CameraSource, type Facing } from '../engine/camera/CameraSource';
import { OUTFIT_MAP, PIECE_MAP } from '../engine/catalog/catalog';
import { getEngine, useApp, type Capture } from './store';

const st = () => useApp.getState();

export async function startCamera(facing?: Facing) {
  const e = getEngine();
  if (!e) return;
  st().setOnboarded(true);
  st().setStatus('loading', 'Starting camera…');
  try {
    await e.startCamera(facing);
    CameraSource.cameraCount().then((n) => st().setHasMultipleCameras(n > 1));
  } catch (err) {
    const msg = CameraSource.describeError(err);
    st().setStatus('error', msg);
    st().toast(msg, 'error');
    e.showMannequin();
  }
}

export async function flipCamera() {
  const e = getEngine();
  if (!e || e.mode !== 'camera') return;
  try {
    await e.flipCamera();
  } catch (err) {
    st().toast(CameraSource.describeError(err), 'error');
  }
}

export async function usePhoto(file: File) {
  const e = getEngine();
  if (!e) return;
  st().setOnboarded(true);
  st().setStatus('loading', 'Finding you in the photo…');
  try {
    await e.loadPhoto(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    st().setStatus(e.mode === 'camera' ? 'tracking' : 'idle');
    st().toast(msg, 'error');
  }
}

export function useMannequin() {
  const e = getEngine();
  st().setOnboarded(true);
  e?.showMannequin();
}

/** Opens the system file picker for a photo try-on. */
export function pickPhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void usePhoto(f);
  };
  input.click();
}

function outfitCaption() {
  const s = st();
  if (s.outfitId) return OUTFIT_MAP.get(s.outfitId)?.name ?? 'My look';
  const names = Object.values(s.selection.slots)
    .map((x) => (x ? PIECE_MAP.get(x.pieceId)?.name : null))
    .filter(Boolean);
  return names.slice(0, 3).join(', ') || 'My look';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let busy = false;

export async function takePhoto() {
  const e = getEngine();
  if (!e || busy) return;
  busy = true;
  try {
    for (let n = st().timer; n > 0; n--) {
      st().setCountdown(n);
      await sleep(1000);
    }
    st().setCountdown(0);
    const caption = outfitCaption();
    const blob = await e.capture(caption);
    flash();
    const id = `c${Date.now()}`;
    const cap: Capture = { id, kind: 'photo', url: URL.createObjectURL(blob), blob, name: `vastra-${slug(caption)}-${stamp()}.jpg`, outfit: caption, createdAt: Date.now() };
    st().addCapture(cap);
    st().toast('Photo saved to your gallery');
  } catch (err) {
    st().toast(`Could not take the photo: ${err instanceof Error ? err.message : err}`, 'error');
  } finally {
    st().setCountdown(0);
    busy = false;
  }
}

let stopTimer: number | null = null;
export async function toggleRecording() {
  const e = getEngine();
  if (!e) return;
  if (e.recording) {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = null;
    try {
      const blob = await e.stopRecording();
      const caption = outfitCaption();
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      st().addCapture({ id: `v${Date.now()}`, kind: 'clip', url: URL.createObjectURL(blob), blob, name: `vastra-${slug(caption)}-${stamp()}.${ext}`, outfit: caption, createdAt: Date.now() });
      st().toast('Clip saved to your gallery');
    } catch (err) {
      st().toast(`Recording failed: ${err instanceof Error ? err.message : err}`, 'error');
    }
    st().setRecording(false);
    return;
  }
  try {
    e.startRecording();
    st().setRecording(true);
    stopTimer = window.setTimeout(() => void toggleRecording(), 15000);
  } catch (err) {
    st().toast(err instanceof Error ? err.message : String(err), 'error');
  }
}

export function downloadCapture(c: Capture) {
  const a = document.createElement('a');
  a.href = c.url;
  a.download = c.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function canShareFiles(c: Capture) {
  try {
    const file = new File([c.blob], c.name, { type: c.blob.type });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareCapture(c: Capture) {
  const file = new File([c.blob], c.name, { type: c.blob.type });
  try {
    if (canShareFiles(c)) {
      await navigator.share({ files: [file], title: 'My Vastra look', text: `Trying on ${c.outfit} with Vastra AR` });
      return;
    }
    if (c.kind === 'photo' && 'ClipboardItem' in window && navigator.clipboard?.write) {
      const png = await toPng(c.blob);
      await navigator.clipboard.write([new ClipboardItem({ [png.type]: png })]);
      st().toast('Image copied - paste it into any chat or post');
      return;
    }
    downloadCapture(c);
    st().toast('Sharing is not available here, so the file was downloaded instead');
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return;
    downloadCapture(c);
  }
}

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('png failed'))), 'image/png'));
}

function flash() {
  const el = document.getElementById('flash');
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
