import { useShallow } from 'zustand/react/shallow';
import { useEffect, useRef } from 'react';
import { useApp } from '../state/store';
import { canShareFiles, downloadCapture, pickPhoto, shareCapture, startCamera, useMannequin } from '../state/actions';
import type { QualityLevel } from '../engine/core/types';
import { IconCamera, IconClose, IconDownload, IconMannequin, IconPhoto, IconShare, IconTrash } from './icons';

function useEscape(onClose: () => void) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
}

export function Onboarding() {
  const onboarded = useApp((s) => s.onboarded);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), [onboarded]);
  if (onboarded) return null;
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="dialog onboard">
        <div className="brand">
          <b>Vastra</b>
          <span lang="hi">वस्त्र</span>
        </div>
        <h1 id="ob-title">See yourself in a sherwani, saree or lehenga before you wear one.</h1>
        <p>
          Vastra tracks your body right in the browser and drapes 3D outfits that follow every move. Change colours, fabrics and
          drapes, then save the look as a photo or clip. Your camera feed never leaves this device.
        </p>
        <p className="festive-note">
          <b>Diwali edition:</b> stand in front of painted festive scenes, or in your own office painted as a Diwali canvas. Find them under Backgrounds.
        </p>
        <div className="actions">
          <button ref={first} className="btn primary" onClick={() => void startCamera()}>
            <IconCamera />
            Start camera
          </button>
          <button className="btn" onClick={pickPhoto}>
            <IconPhoto />
            Use a photo
          </button>
          <button className="btn" onClick={useMannequin}>
            <IconMannequin />
            Browse on the mannequin
          </button>
        </div>
        <p className="fineprint">For the best fit, stand 1.5 to 2 metres from the camera in good light, with your shoulders and hips in view.</p>
      </div>
    </div>
  );
}

const QUALITY: { id: QualityLevel; label: string; note: string }[] = [
  { id: 'performance', label: 'Fast', note: 'Lite tracking model, lighter meshes. Best for older phones.' },
  { id: 'balanced', label: 'Balanced', note: 'Lite tracking model with detailed garments.' },
  { id: 'quality', label: 'Sharp', note: 'Full tracking model, finest garment detail and anti-aliasing.' },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Settings() {
  const s = useApp();
  const close = () => s.setSettingsOpen(false);
  useEscape(close);
  if (!s.settingsOpen) return null;
  const q = QUALITY.find((x) => x.id === s.quality)!;
  return (
    <div className="scrim" onClick={close}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="set-title" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn close" onClick={close} aria-label="Close settings">
          <IconClose />
        </button>
        <h2 id="set-title">Settings</h2>
        <div className="field">
          <span className="label">Quality</span>
          <div className="chips" role="group" aria-label="Quality">
            {QUALITY.map((x) => (
              <button key={x.id} className="chip" aria-pressed={s.quality === x.id} onClick={() => s.setSetting('quality', x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <p className="stats">{q.note}</p>
        </div>
        <div className="settings-list">
          <div className="setting">
            <div>
              Mirror view
              <small>Show the front camera like a mirror</small>
            </div>
            <Switch label="Mirror view" checked={s.mirror} onChange={(v) => s.setSetting('mirror', v)} />
          </div>
          <div className="setting">
            <div>
              Hands in front of clothes
              <small>Your real head, arms and hands appear over the outfit</small>
            </div>
            <Switch label="Hands in front of clothes" checked={s.occlusion} onChange={(v) => s.setSetting('occlusion', v)} />
          </div>
          <div className="setting">
            <div>
              Match room lighting
              <small>Lights the outfit like the room you are in</small>
            </div>
            <Switch label="Match room lighting" checked={s.autoLight} onChange={(v) => s.setSetting('autoLight', v)} />
          </div>
          <div className="setting">
            <div>
              Fill the screen
              <small>Off shows the whole camera frame</small>
            </div>
            <Switch label="Fill the screen" checked={s.fit === 'cover'} onChange={(v) => s.setSetting('fit', v ? 'cover' : 'contain')} />
          </div>
          <div className="setting">
            <div>
              Show tracking points
              <small>Draws the detected skeleton</small>
            </div>
            <Switch label="Show tracking points" checked={s.skeleton} onChange={(v) => s.setSetting('skeleton', v)} />
          </div>
        </div>
        {s.mode === 'camera' && (
          <p className="stats">
            {Math.round(s.stats.fps)} fps, body tracking {s.stats.inferMs.toFixed(1)} ms on {s.stats.delegate}, rendering {s.stats.renderMs.toFixed(1)} ms
            {s.stats.segMs > 0.05 && `, background cut-out ${s.stats.segMs.toFixed(1)} ms`}
          </p>
        )}
        <p className="fineprint">Tip: use the left and right arrow keys to flick through outfits.</p>
      </div>
    </div>
  );
}

export function CaptureViewer() {
  const { viewer, captures, setViewer, removeCapture } = useApp(useShallow((s) => ({ viewer: s.viewer, captures: s.captures, setViewer: s.setViewer, removeCapture: s.removeCapture })));
  const close = () => setViewer(null);
  useEscape(close);
  const c = captures.find((x) => x.id === viewer);
  if (!c) return null;
  const date = new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="scrim" onClick={close}>
      <div className="dialog viewer" role="dialog" aria-modal="true" aria-label="Gallery" onClick={(e) => e.stopPropagation()}>
        <div className="media">{c.kind === 'photo' ? <img src={c.url} alt={c.outfit} /> : <video src={c.url} controls autoPlay loop playsInline />}</div>
        <div className="bar">
          <div className="title">
            <b>{c.outfit}</b>
            <small>
              {c.kind === 'photo' ? 'Photo' : 'Clip'}, {date}
            </small>
          </div>
          <button className="btn primary" onClick={() => downloadCapture(c)}>
            <IconDownload />
            Download
          </button>
          <button className="btn" onClick={() => void shareCapture(c)}>
            <IconShare />
            {canShareFiles(c) ? 'Share' : c.kind === 'photo' ? 'Copy image' : 'Share'}
          </button>
          <button className="btn danger" onClick={() => removeCapture(c.id)} aria-label="Delete">
            <IconTrash />
            Delete
          </button>
          <button className="icon-btn" onClick={close} aria-label="Close gallery">
            <IconClose />
          </button>
        </div>
        {captures.length > 1 && (
          <div className="strip" role="group" aria-label="Your captures">
            {captures.map((x) => (
              <button key={x.id} aria-pressed={x.id === c.id} onClick={() => setViewer(x.id)} aria-label={x.outfit}>
                {x.kind === 'photo' ? <img src={x.url} alt="" /> : <video src={x.url} muted playsInline />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'error' ? ' error' : ''}`} onClick={() => dismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
