import { existsSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `base: './'` keeps every asset URL relative, so the production build can be
// dropped into any static host or sub-folder (GitHub Pages, Netlify, S3, ...).
// `npm run dev:https` (mode "https") serves with a self-signed certificate so the
// camera also works when you open the dev server from a phone on the same Wi-Fi.
// "My Office - Diwali Edition" paints public/backgrounds/my-office.* when present.
// Found at build time so browsers never probe for a missing file.
const officePhoto = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => `my-office.${ext}`).find((f) => existsSync(`public/backgrounds/${f}`)) ?? '';

export default defineConfig(({ mode }) => ({
  base: './',
  define: { 'import.meta.env.VITE_OFFICE_PHOTO': JSON.stringify(officePhoto) },
  plugins: [react(), ...(mode === 'https' ? [basicSsl()] : [])],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/@mediapipe')) return 'mediapipe';
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          return undefined;
        },
      },
    },
  },
}));
