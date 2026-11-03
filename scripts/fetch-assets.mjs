// Copies the MediaPipe WASM runtime out of node_modules and downloads the
// pose-landmarker models into /public so the app works fully self-hosted
// (no CDN needed at runtime). Runs automatically after `npm install`.
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSrc = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDst = join(root, 'public', 'mediapipe', 'wasm');
const modelDst = join(root, 'public', 'models');

const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

const MODELS = {
  'pose_landmarker_lite.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
  'pose_landmarker_full.task':
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
};

mkdirSync(wasmDst, { recursive: true });
mkdirSync(modelDst, { recursive: true });

if (existsSync(wasmSrc)) {
  for (const f of WASM_FILES) {
    const src = join(wasmSrc, f);
    if (existsSync(src)) copyFileSync(src, join(wasmDst, f));
  }
  console.log('[assets] MediaPipe wasm copied to public/mediapipe/wasm');
} else {
  console.warn('[assets] @mediapipe/tasks-vision not installed yet - skipped wasm copy');
}

for (const [name, url] of Object.entries(MODELS)) {
  const out = join(modelDst, name);
  if (existsSync(out) && statSync(out).size > 1_000_000) continue;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log(`[assets] downloaded ${name}`);
  } catch (err) {
    console.warn(`[assets] could not download ${name} (${err.message}). ` +
      'The app will fall back to loading it from Google\'s CDN at runtime.');
  }
}
