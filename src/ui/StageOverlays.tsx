import { useShallow } from 'zustand/react/shallow';
import { useEffect, useState } from 'react';
import { useApp } from '../state/store';
import { flipCamera, pickPhoto, startCamera, takePhoto, toggleRecording, useMannequin } from '../state/actions';
import type { MannequinPose } from '../engine/tracking/SyntheticPose';
import { IconCamera, IconFlip, IconGallery, IconGear, IconMannequin, IconPhoto, IconRecord, IconRotate, IconStop, IconTimer } from './icons';

export function TopBar() {
  const mode = useApp((s) => s.mode);
  const setSettingsOpen = useApp((s) => s.setSettingsOpen);
  return (
    <header className="topbar">
      <div className="wordmark" aria-label="Vastra AR">
        <b>Vastra</b>
        <span lang="hi">वस्त्र</span>
      </div>
      <nav className="sources" aria-label="Try-on source">
        <button aria-pressed={mode === 'camera'} onClick={() => void startCamera()} title="Live camera try-on">
          <IconCamera />
          <span>Camera</span>
        </button>
        <button aria-pressed={mode === 'photo'} onClick={pickPhoto} title="Try outfits on a photo">
          <IconPhoto />
          <span>Photo</span>
        </button>
        <button aria-pressed={mode === 'mannequin'} onClick={useMannequin} title="3D mannequin">
          <IconMannequin />
          <span>Mannequin</span>
        </button>
      </nav>
      <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
        <IconGear />
      </button>
    </header>
  );
}

export function StatusChip() {
  const { mode, status, statusMsg, stats } = useApp(useShallow((s) => ({ mode: s.mode, status: s.status, statusMsg: s.statusMsg, stats: s.stats })));
  if (mode === 'mannequin' || status === 'loading') return null;
  let text = statusMsg ?? '';
  if (status === 'tracking') text = mode === 'photo' ? 'Photo try-on' : `Tracking at ${Math.round(stats.fps)} fps`;
  if (status === 'searching') text = statusMsg ?? 'Looking for you…';
  if (status === 'error') text = 'Tracking unavailable';
  if (!text) return null;
  return (
    <div className="status" data-s={status} role="status" aria-live="polite">
      <i />
      {text}
    </div>
  );
}

/** Model download / startup progress, drawn as a measuring tape unrolling. */
export function LoadingTape() {
  const { status, statusMsg, progress } = useApp(useShallow((s) => ({ status: s.status, statusMsg: s.statusMsg, progress: s.progress })));
  if (status !== 'loading') return null;
  const pct = Math.round(Math.max(0.03, Math.min(1, progress)) * 100);
  return (
    <div className="tape" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={statusMsg ?? 'Loading'}>
      <p>{statusMsg ?? 'Loading body tracking'}</p>
      <div className="track">
        <div className="fill" style={{ width: `${pct}%` }} />
        <span className="num">{pct}%</span>
      </div>
    </div>
  );
}

export function Hint() {
  const hint = useApp((s) => s.hint);
  const mode = useApp((s) => s.mode);
  if (!hint || mode !== 'camera') return null;
  return (
    <div className="hint" role="status" aria-live="polite">
      {hint}
    </div>
  );
}

export function Countdown() {
  const n = useApp((s) => s.countdown);
  if (!n) return null;
  return (
    <div className="countdown" aria-live="assertive">
      {n}
    </div>
  );
}

const POSES: { id: MannequinPose; label: string }[] = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'apose', label: 'Arms out' },
  { id: 'hips', label: 'Hands on hips' },
  { id: 'namaste', label: 'Namaste' },
  { id: 'walk', label: 'Walk' },
  { id: 'twirl', label: 'Twirl' },
];

export function MannequinControls() {
  const { mode, pose, autoRotate, setPose, setAutoRotate } = useApp(useShallow((s) => ({ mode: s.mode, pose: s.pose, autoRotate: s.autoRotate, setPose: s.setPose, setAutoRotate: s.setAutoRotate })));
  if (mode !== 'mannequin') return null;
  return (
    <div className="mq">
      <small>Drag the mannequin to turn it</small>
      <div className="chips" role="group" aria-label="Mannequin pose">
        {POSES.map((p) => (
          <button key={p.id} className="chip" aria-pressed={pose === p.id} onClick={() => setPose(p.id)}>
            {p.label}
          </button>
        ))}
        <button className="chip" aria-pressed={autoRotate} onClick={() => setAutoRotate(!autoRotate)} title="Slowly turn the mannequin">
          <IconRotate style={{ width: 15, height: 15, verticalAlign: '-3px', marginRight: 4 }} />
          Auto-turn
        </button>
      </div>
    </div>
  );
}

function RecordTime() {
  const start = useApp((s) => s.recordStart);
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    const t = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - start) / 1000));
  return <span className="rec-time">0:{String(s).padStart(2, '0')}</span>;
}

export function ShutterBar() {
  const { mode, timer, setTimer, recording, captures, setViewer, multi } = useApp(useShallow((s) => ({
    mode: s.mode,
    timer: s.timer,
    setTimer: s.setTimer,
    recording: s.recording,
    captures: s.captures,
    setViewer: s.setViewer,
    multi: s.hasMultipleCameras,
  })));
  const last = captures[0];
  const nextTimer = timer === 0 ? 3 : timer === 3 ? 10 : 0;
  return (
    <div className="shutterbar">
      <button className="thumb-btn" onClick={() => last && setViewer(last.id)} aria-label={last ? 'Open gallery' : 'Gallery is empty'} disabled={!last}>
        {last ? last.kind === 'photo' ? <img src={last.url} alt="" /> : <video src={last.url} muted playsInline /> : <IconGallery style={{ width: 18, height: 18, opacity: 0.6 }} />}
      </button>
      <button className="icon-btn timer-btn" aria-pressed={timer > 0} onClick={() => setTimer(nextTimer)} aria-label={timer ? `Self-timer ${timer} seconds` : 'Self-timer off'} title="Self-timer">
        {timer ? `${timer}s` : <IconTimer />}
      </button>
      <button className="shutter" onClick={() => void takePhoto()} aria-label="Take photo" title="Take photo" />
      <button className="icon-btn rec" aria-pressed={recording} onClick={() => void toggleRecording()} aria-label={recording ? 'Stop recording' : 'Record a clip (up to 15 s)'} title="Record a clip">
        {recording ? <IconStop /> : <IconRecord />}
        {recording && <RecordTime />}
      </button>
      {mode === 'camera' && multi ? (
        <button className="icon-btn" onClick={() => void flipCamera()} aria-label="Switch camera" title="Switch camera">
          <IconFlip />
        </button>
      ) : (
        <span style={{ width: 40 }} aria-hidden />
      )}
    </div>
  );
}
