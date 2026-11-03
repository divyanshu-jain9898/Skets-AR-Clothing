import { useEffect, useRef } from 'react';
import { Engine } from '../engine/Engine';
import { ThumbnailStudio } from '../engine/ThumbnailStudio';
import { OUTFITS, selectionFromOutfit } from '../engine/catalog/catalog';
import { getEngine, setEngine, useApp } from '../state/store';
import { initBackgrounds, onFrameOrientation } from '../state/backgrounds';

/** Hosts the WebGL canvas, owns the engine lifecycle and renders library thumbnails. */
export function Stage({ children }: { children?: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mode = useApp((s) => s.mode);
  const drag = useRef<{ x: number; yaw: number } | null>(null);
  const yaw = useRef(0);

  useEffect(() => {
    const s = useApp.getState();
    const engine = new Engine(canvas.current!, s.quality, {
      onStatus: (status, msg, progress) => useApp.getState().setStatus(status, msg ?? null, progress),
      onStats: (st) => useApp.getState().setStats(st),
      onHint: (h) => useApp.getState().setHint(h),
      onMode: (m) => useApp.getState().setMode(m),
      onQuality: (level, reason) => {
        useApp.setState({ quality: level });
        useApp.getState().toast(reason);
      },
      onBackdrop: (state, msg) => {
        useApp.setState({ bgCutout: state });
        if (state === 'error' && msg) useApp.getState().toast(msg, 'error');
      },
      onOrientation: (portrait) => onFrameOrientation(portrait),
    });
    engine.occlusion = s.occlusion;
    engine.autoLighting = s.autoLight;
    engine.setShowSkeleton(s.skeleton);
    engine.setMirror(s.mirror);
    engine.renderer.fit = s.fit;
    setEngine(engine);
    const ro = new ResizeObserver(() => {
      const r = host.current!.getBoundingClientRect();
      engine.resize(r.width, r.height);
    });
    ro.observe(host.current!);
    engine.setSelection(s.selection);
    engine.showMannequin();
    engine.start();
    void initBackgrounds();

    // Library thumbnails, rendered progressively with the same garment engine.
    let cancelled = false;
    let studio: ThumbnailStudio | null = null;
    const queue = [...OUTFITS].sort((a, b) => (a.gender === s.gender ? 0 : 1) - (b.gender === s.gender ? 0 : 1));
    const next = () => {
      if (cancelled) return;
      const o = queue.shift();
      if (!o) {
        studio?.dispose();
        studio = null;
        return;
      }
      try {
        studio ??= new ThumbnailStudio(engine.lib);
        useApp.getState().setThumb(o.id, studio.render(selectionFromOutfit(o)));
      } catch (err) {
        console.warn('[thumbs]', err);
      }
      setTimeout(next, 30);
    };
    const kick = setTimeout(next, 400);
    return () => {
      cancelled = true;
      clearTimeout(kick);
      ro.disconnect();
      studio?.dispose();
      engine.destroy();
      setEngine(null);
    };
  }, []);

  // keyboard shortcuts: arrows cycle outfits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') useApp.getState().cycleOutfit(1);
      if (e.key === 'ArrowLeft') useApp.getState().cycleOutfit(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // drag to turn the mannequin
  const onDown = (e: React.PointerEvent) => {
    if (useApp.getState().mode !== 'mannequin') return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, yaw: yaw.current };
    useApp.getState().setAutoRotate(false);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    yaw.current = drag.current.yaw + (e.clientX - drag.current.x) * 0.012;
    getEngine()?.setMannequinYaw(yaw.current, false);
  };
  const onUp = () => {
    drag.current = null;
  };
  const autoRotate = useApp((s) => s.autoRotate);
  useEffect(() => {
    if (autoRotate) {
      yaw.current = 0;
      getEngine()?.setMannequinYaw(0, true);
    }
  }, [autoRotate]);

  return (
    <div className={`stage${mode === 'mannequin' ? ' grab' : ''}`} ref={host}>
      <canvas ref={canvas} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label="Try-on view" role="img" />
      {children}
      <div id="flash" />
    </div>
  );
}
