import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/rozha-one/latin-400.css';
import '@fontsource/rozha-one/devanagari-400.css';
import '@fontsource-variable/anek-latin';
import './styles/app.css';
import App from './App';

const root = document.getElementById('root')!;

function unsupported(msg: string) {
  root.innerHTML = `<div style="padding:32px;max-width:520px;margin:10vh auto;font:16px/1.5 system-ui;color:#f1e8d4"><h1 style="font:28px Georgia,serif;margin:0 0 12px">Vastra needs WebGL</h1><p>${msg}</p></div>`;
}

const gl = document.createElement('canvas').getContext('webgl2');
if (!gl) {
  unsupported('This browser or device does not support WebGL 2, which the 3D try-on needs. Please try a recent Chrome, Edge, Safari or Firefox.');
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
