# Vastra AR (वस्त्र)

A browser-based augmented-reality fitting room for Indian traditional wear.
It tracks your body through the camera and drapes 3D outfits on you in real
time: sarees, lehengas, anarkalis, salwar kameez, sherwanis, bandhgalas,
kurtas, dhotis, veshtis, turbans and jewellery. Nothing to install, and no
video ever leaves the device.

**Diwali edition:** try outfits on while standing in front of painted Diwali
scenes, or in your own office turned into a festive canvas painting. The
camera background is cut out live and replaced behind you and your outfit.

## Quick start

**Windows, no setup:** double-click **`Start Vastra.bat`**. It serves the
prebuilt app from `dist\` at http://localhost:5173 using a tiny PowerShell
server (no Node.js needed) and opens your browser. Allow the camera when the
browser asks. Keep the black window open while you use the app.

**Developers:**

```bash
npm install        # also copies the MediaPipe runtime and downloads the pose models into /public
npm run dev        # http://localhost:5173  (the camera works on localhost)
```

**On a phone.** Browsers only allow the camera on `https://` or `localhost`.
- Same Wi-Fi: run `npm run dev:https` and open `https://<your-computer-ip>:5173` on the phone. Accept the self-signed certificate warning.
- Or deploy the static build (below) to any HTTPS host.

**Production build.**

```bash
npm run build      # outputs ./dist (all paths are relative)
npm run preview    # serve ./dist locally
```

`dist/` is a fully static site. Upload it to Netlify, Vercel, GitHub Pages,
Cloudflare Pages, S3 or any web server with HTTPS. It is about 43 MB, mostly
the self-hosted MediaPipe WebAssembly runtime (about 14 MB) and the two pose
models (6 MB and 9 MB). The browser only downloads what it needs.

## Features

| Area | What it does |
| --- | --- |
| Real-time AR try-on | Live camera with the outfit rendered over you at camera frame rate. Mirror view for the front camera. Switch between front and back cameras. |
| Body tracking | MediaPipe Pose Landmarker (33 landmarks plus metric 3D world landmarks), GPU delegate with automatic CPU fallback, One-Euro smoothing, and recovery of out-of-frame hips and legs from body proportions. Also corrects left/right swaps after someone turns around. |
| Proportions | Shoulder, hip, torso, arm, leg and head sizes are learnt per person. Garment cross-sections come from a calibration study of landmarks against person-segmentation silhouettes. |
| 3D garments | Procedural 3D meshes rebuilt every frame on the body: lofted torso sections, tube sleeves and trouser legs, flared skirts with kalis and pleats, gharara and dhoti cuts, safa, dastar, topi and taqiyah headwear, collars, plackets, buttons, side slits and zari borders. |
| Deformation and physics | Garments twist with the shoulders and hips, bend with the elbows and spread with the legs. Hems sway on damped springs, and lehengas and anarkalis flare when you twirl. Dupattas, stoles, the saree pallu and turban tails are real Verlet cloth that collides with your body and arms. |
| Realistic rendering | PBR fabrics (cotton, khadi, linen, silk, satin, velvet, sheer georgette, brocade) with sheen and woven normal maps. Metallic zari is encoded in roughness/metalness maps. Lighting matches the room: colour, brightness and key-light direction are estimated from the camera image. Depth-only body proxies keep your real head, neck, arms and hands in front of the clothes. |
| Clothing library | 31 real traditional outfits: 13 for men and 18 for women, from Varanasi, Kerala, Gujarat, Rajasthan, Maharashtra, Lucknow, Punjab, Bengal, Hyderabad, Andhra, Tamil Nadu, Assam, Sikkim and Mumbai. Includes outfits of different faith communities: Sikh (kurta pyjama with dastar, Phulkari Patiala suit), Muslim (Eid kurta with taqiyah, Lucknowi gharara), Syrian Christian (chatta and mundu with kavani), Parsi (gara saree, dagli) and Buddhist (Sikkimese bakhu for men and women). Built from 50 mix-and-match pieces. |
| Customisation | Swap any piece (top, jacket, bottom, drape, headwear, jewellery), or switch **Accessories** to **None** to leave jewellery and decorative headwear off every outfit (religious headwear such as a dastar stays). Change length on a measuring tape (waist to floor), sleeves, fit, neckline, flare, kalis, trouser cut and draping style. Choose fabric, 13 textile patterns (paisley, booti, bandhani, leheriya, ikat, Banarasi brocade, chikankari, block print, madras checks, jaal, pinstripe, kalidar panels) and 7 borders (temple, vine, gota patti, mirror work, zari lines, kasavu). Pick base, motif, border and zari colours from a named Indian palette or a custom picker. |
| Capture and share | Photo capture with a 3 s or 10 s self-timer, plus video clips up to 15 s. A gallery with download and Web Share. Where file sharing isn't available, photos are copied to the clipboard. |
| Other modes | Photo try-on (upload a picture) and a 3D mannequin with poses (relaxed, arms out, hands on hips, namaste, walk, twirl) and drag-to-turn, for browsing without a camera. |
| Performance | Fast, Balanced and Sharp presets (model, mesh detail, pixel ratio, anti-aliasing, cloth iterations). Quality steps down automatically if frames get slow. Rendering is synced to `requestVideoFrameCallback`, the hot loops don't allocate, and processing pauses in hidden tabs. |
| Diwali backgrounds | A **Backgrounds** tab (and the diya button in the top bar) with thumbnail cards. Six painted scenes: Diwali Crackers, Diya Decorations, Illuminated House, Festive Decoration, Diwali Night Scene and Traditional Interior. **My Office – Diwali Edition** turns a photo of your office into a Diwali canvas painting. Also: **Camera** (the original background, i.e. reset), **None** (background removed, plain backdrop) and **Upload** (your own pictures, kept on the device; drag and drop works on desktop). Switching is instant and never restarts the camera. Lights twinkle and live fireworks burst in the open sky; turn it off in the tab. |
| Background replacement | MediaPipe selfie segmenter (250 KB) on a small copy of each frame, steered by the tracked skeleton (fills gaps along the limbs, removes stray detections) and smoothed over time. Edges, including hair, are refined against the full-resolution camera image on the GPU, with light wrap and a colour match to the scene. It only runs while a background other than Camera is selected, and it never touches body tracking, so garments stay aligned. Works in camera, photo and mannequin modes. |
| UI | Responsive: a side panel on desktop and a bottom sheet on phones. Keyboard support (left/right arrows flick through outfits), visible focus, reduced-motion support and screen-reader labels. |

## How it works

```
camera / photo / mannequin poser
        │  33 landmarks (image x,y) + world landmarks (metres)
        ▼
PoseTracker (MediaPipe)  ──►  BodyRig ──► BodyShape ──► Wardrobe (garments) ──► ARRenderer (Three.js)
                              smoothing,   cross-sections,   torso / skirt / pants /    ortho camera in video
                              scale (px/m), limb paths,       saree / cloth drapes /     pixels, video background,
                              frames, yaw   head ellipsoid    headwear / jewellery       occluders, light estimation
```

- **Pixel-exact alignment.** The scene is laid out in source-frame pixels and rendered with an orthographic camera. A landmark at pixel (x, y) is drawn at exactly that pixel of the video. Depth comes from MediaPipe's metric world landmarks, scaled into pixels, which gives correct 3D orientation, occlusion and lighting.
- **Body model.** `BodyShape` builds super-ellipse cross-sections (neck, shoulders, chest, bust, waist, hips, then around both legs down to the floor) plus arm and leg paths. Every garment is a parametric surface over these, with its own ease, flare, pleats and hem line.
- **Layering.** Garments register how far they extend from the body, so drapes collide with the outermost layer and trousers tuck neatly under long tops.

## Diwali backgrounds

### My Office – Diwali Edition

The office card paints a festive canvas painting from a photo of an office:

1. The photo is cropped to the camera's orientation so the decorations stay in view.
2. Windows are found (large, bright, low-saturation regions in the upper part) and turned into a Diwali night sky with city lights and fireworks. Live fireworks then keep bursting there.
3. An evening grade makes the room warmer and dimmer, so the festive lights carry it.
4. Marigold garlands, fairy lights, akash kandil lanterns, rows of diyas and a rangoli are added around the edges, leaving the room's architecture and furniture visible.
5. An anisotropic Kuwahara filter (oil paint) with brush streaks and canvas weave turns everything into a painting. Then the flames, bulbs and glows are painted on top.

To use **your** office, either:

- in the app: **Backgrounds > Paint my office from a photo** (stored only on that device), or
- for everyone who opens your deployment: save the photo as `public/backgrounds/my-office.jpg` (`.png` and `.webp` also work) and rebuild (restart `npm run dev` if it is running). With the GitHub Pages workflow, committing the photo to `main` is enough. The app paints it on first use.

Until a photo is provided, a built-in modern office is painted and converted the same way. If the detector mistakes a white wall for a window, turn off **Night sky in the windows** under the office card.

### How it works

All backgrounds are painted on the device (no image assets to download). Scenes are drawn with Canvas 2D and run through the same GPU oil-paint filter, in a Web Worker when the browser supports OffscreenCanvas with WebGL 2, otherwise on the main thread. They are painted for the camera's orientation (landscape on laptops, portrait on phones) at up to 1920 px.

```
camera frame ─┬─► PoseTracker ─► garments (unchanged)
              └─► PersonSegmenter (256 px copy) + skeleton prior + temporal smoothing
                        │ person mask
                        ▼
   Backdrop shader: mask refined against the camera image ─► person over the painted scene
                    + light wrap, colour match, twinkle, live fireworks ─► garments on top
```

Code: `src/engine/backgrounds/` (catalog, painting library, worker, scenes in `paint/scenes/`, office converter in `paint/office.ts`), `src/engine/tracking/PersonSegmenter.ts`, `src/engine/render/Backdrop.ts`, `src/ui/Backgrounds.tsx`. While `npm run dev` is running, `/dev/backgrounds.html?scene=crackers&w=1600&h=900` previews a single scene (`scene=office&photo=<url>` converts a photo).

## Deploy on GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`.

1. On GitHub, open **Settings > Pages** and set **Source** to **GitHub Actions** (one time).
2. Push to `main` (or run the workflow from the **Actions** tab). It installs, downloads the models, builds and publishes `dist/`.
3. The app is then live at `https://<user>.github.io/<repo>/`. Pages is served over HTTPS, so the camera works on phones and tablets too.

## Project layout

```
src/
  engine/
    Engine.ts              main loop and source switching (camera / photo / mannequin), capture, recording
    Wardrobe.ts            builds and rebuilds the garments for each outfit slot
    ThumbnailStudio.ts     renders library thumbnails with the same engine
    tracking/              PoseTracker (MediaPipe), One-Euro filter, synthetic mannequin poser
    body/                  BodyRig (landmarks to rig), BodyShape (sections, limbs, collisions), Section
    garments/              GridMesh, TorsoGarment, SkirtGarment, PantsGarment, ClothDrape,
                           SareeGarment, Headwear (safa, pagdi, topi), Jewelry
    materials/             FabricLibrary (PBR fabrics), patterns.ts (procedural Indian textiles)
    render/                ARRenderer, occluders / mannequin / skeleton
    catalog/               pieces, outfits, palette (all data, easy to extend)
    backgrounds/           background catalog, painting library + worker, Diwali scenes, office converter
  state/                   zustand store and async actions
  ui/                      React components
scripts/fetch-assets.mjs   copies the wasm runtime and downloads the models (run on npm install)
```

## Adding an outfit

Outfits and pieces are plain data in `src/engine/catalog/catalog.ts`.

```ts
// a new piece: any garment kind with style params and a default fabric
{ id: 'angrakha', name: 'Angrakha', slot: 'top', gender: 'women', kind: 'torso',
  params: { hem: H.CALF, flare: 0.6, neckline: 'v', neckDepth: 0.35, sleeve: 0.8, pleats: 16, pleatDepth: 0.03 },
  fabric: fab('#f2c12e', '#b3121f', '#b3121f', '#d4af37', { type: 'cotton', pattern: 'block', border: 'gota' }),
  controls: [LENGTH_TOP, SLEEVES, FLARE] },

// a new outfit: fill slots with pieces and optional colour or fabric overrides
{ id: 'jaipur-angrakha', name: 'Jaipur Angrakha', gender: 'women', region: 'Rajasthan', occasion: 'Festive',
  description: 'Block-printed angrakha with a leheriya dupatta.',
  pieces: { top: { piece: 'angrakha' }, bottom: { piece: 'churidar-w' },
            drape: { piece: 'dupatta', pattern: 'leheriya' } } },
```

The thumbnail renders automatically. Garment parameters are documented in
each garment file (`TorsoParams`, `SkirtParams`, `PantsParams`,
`DrapeParams`, `SareeParams`, ...). Heights use the body coordinate `H`:
`H.WAIST`, `H.HIP`, `H.KNEE`, `H.FLOOR`, and so on.

## Privacy

All tracking and rendering happen locally, and frames are never uploaded.
MediaPipe Tasks 1.x normally sends anonymous usage statistics to Google every
minute. Vastra answers that one request locally, so the app makes no
third-party calls. To allow it, build with
`VITE_ALLOW_MEDIAPIPE_TELEMETRY=true`.

## Browser support

Recent Chrome, Edge, Firefox and Safari, on desktop, iOS 16.4+ and Android.
It needs WebGL 2 and WebAssembly SIMD (a non-SIMD fallback is included).
Video clips are WebM on Chrome and Firefox and MP4 on Safari.

## Tips for the best fit

- Stand 1.5 to 2 m from the camera with your shoulders and hips visible. Full-length outfits look best with your feet in view.
- Use even, front-facing light, and wear fitted clothes.
- Use **Settings, Sharp** on laptops and desktops for the full tracking model. If a phone struggles, use **Fast**.

## Known limitations

- Garments are procedural approximations, not tailored CAD patterns. Very loose real clothing (puffer jackets, wide skirts) can peek out at the edges.
- Occlusion uses body proxies, not hair segmentation, so long hair over the shoulders appears behind the outfit.
- Background replacement works best against a background that contrasts with you, in even light. Very fast movement can leave a soft edge for a frame.
- One person at a time.

## License

MIT for this code. The MediaPipe runtime and models are Apache-2.0 (Google).
Rozha One and Anek Latin are under the SIL Open Font License.
