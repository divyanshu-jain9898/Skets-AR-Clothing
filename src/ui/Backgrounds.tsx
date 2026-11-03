import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useApp } from '../state/store';
import {
  addBackgroundPicture,
  pickBackgroundPicture,
  pickOfficePhoto,
  removeBackgroundPicture,
  selectBackground,
  setBackgroundAnimation,
  setOfficePhoto,
  setOfficeWindows,
} from '../state/backgrounds';
import { BACKGROUNDS, BACKGROUND_MAP, OFFICE_CATEGORY } from '../engine/backgrounds/catalog';
import { IconBan, IconCamera, IconClose, IconUpload } from './icons';

function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const m = window.matchMedia?.(query);
    if (!m) return;
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

const SCENES = BACKGROUNDS.filter((b) => b.category === 'diwali');

function Thumb({ id, label }: { id: string; label: string }) {
  const url = useApp((s) => s.bgThumbs[id]);
  return url ? <img src={url} alt="" draggable={false} /> : <span className="ph" aria-label={`${label} is being painted`}>Painting…</span>;
}

function Card({ id, name, meta, selected, children, onRemove }: { id: string; name: string; meta?: string; selected: boolean; children?: ReactNode; onRemove?: () => void }) {
  return (
    <div className="bg-card-wrap">
      <button className="bg-card" aria-pressed={selected} onClick={() => selectBackground(id)} title={meta ?? name}>
        <div className="img">{children ?? <Thumb id={id} label={name} />}</div>
        <span className="name">{name}</span>
        {meta && <span className="meta">{meta}</span>}
      </button>
      {onRemove && (
        <button className="bg-remove" onClick={onRemove} aria-label={`Remove ${name}`} title="Remove">
          <IconClose />
        </button>
      )}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/** Background picker: shown as a tab in the side panel / bottom sheet. */
export function BackgroundsPanel() {
  const { bgId, uploads, officeCustom, officeWindows, bgAnimate, expanded } = useApp(
    useShallow((s) => ({ bgId: s.bgId, uploads: s.bgUploads, officeCustom: s.officeCustom, officeWindows: s.officeWindows, bgAnimate: s.bgAnimate, expanded: s.sheetExpanded })),
  );
  const compact = useMedia('(max-width: 760px)') && !expanded;
  const [drag, setDrag] = useState(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith('image/'));
    if (f) void addBackgroundPicture(f);
  };
  const dropProps = {
    onDragOver: (e: DragEvent) => {
      if ([...(e.dataTransfer?.types ?? [])].includes('Files')) {
        e.preventDefault();
        setDrag(true);
      }
    },
    onDragLeave: () => setDrag(false),
    onDrop,
  };

  if (compact) {
    // one swipeable strip in the collapsed bottom sheet
    return (
      <div className="bg-strip" role="group" aria-label="Backgrounds">
        <Card id="camera" name="Camera" selected={bgId === 'camera'}>
          <span className="bg-icon">
            <IconCamera />
          </span>
        </Card>
        <Card id="none" name="None" selected={bgId === 'none'}>
          <span className="bg-icon plain">
            <IconBan />
          </span>
        </Card>
        <Card id="office" name="My Office" selected={bgId === 'office'} />
        {SCENES.map((b) => (
          <Card key={b.id} id={b.id} name={b.name} selected={bgId === b.id} />
        ))}
        {uploads.map((u) => (
          <Card key={u.id} id={u.id} name={u.name} selected={bgId === u.id} />
        ))}
        <div className="bg-card-wrap">
          <button className="bg-card" onClick={pickBackgroundPicture}>
            <div className="img">
              <span className="bg-icon">
                <IconUpload />
              </span>
            </div>
            <span className="name">Upload</span>
          </button>
        </div>
      </div>
    );
  }

  const office = BACKGROUND_MAP.get('office')!;
  return (
    <div className={`bg-panel${drag ? ' dropping' : ''}`} {...dropProps}>
      <p className="lede">Stand in front of a Diwali scene. Tap a background to place it behind you; the camera keeps running.</p>
      <div className="section">
        <h3>Behind you</h3>
        <div className="bg-basics" role="group" aria-label="Basic backgrounds">
          <button className="bg-basic" aria-pressed={bgId === 'camera'} onClick={() => selectBackground('camera')} title="Show your real surroundings (reset)">
            <IconCamera />
            <span>
              Camera
              <small>Original</small>
            </span>
          </button>
          <button className="bg-basic" aria-pressed={bgId === 'none'} onClick={() => selectBackground('none')} title="Remove the background">
            <IconBan />
            <span>
              None
              <small>Removed</small>
            </span>
          </button>
          <button className="bg-basic" onClick={pickBackgroundPicture} title="Use your own picture">
            <IconUpload />
            <span>
              Upload
              <small>Your picture</small>
            </span>
          </button>
        </div>
      </div>

      <div className="section">
        <h3>{OFFICE_CATEGORY}</h3>
        <button className="bg-feature" aria-pressed={bgId === 'office'} onClick={() => selectBackground('office')}>
          <div className="img">
            <Thumb id="office" label={office.name} />
            <span className="badge">Canvas painting</span>
          </div>
          <span className="meta">{officeCustom ? 'Painted from your office photo' : office.blurb}</span>
        </button>
        <div className="bg-actions">
          <button className="text-btn" onClick={pickOfficePhoto}>
            {officeCustom ? 'Use a different office photo' : 'Paint my office from a photo'}
          </button>
          {officeCustom && (
            <button className="text-btn quiet" onClick={() => void setOfficePhoto(null)}>
              Use the built-in office
            </button>
          )}
        </div>
        <div className="setting">
          <div>
            Night sky in the windows
            <small>Turns bright windows into fireworks at night</small>
          </div>
          <Switch label="Night sky in the windows" checked={officeWindows} onChange={(v) => void setOfficeWindows(v)} />
        </div>
      </div>

      <div className="section">
        <h3>Diwali collection</h3>
        <div className="bg-grid">
          {SCENES.map((b) => (
            <Card key={b.id} id={b.id} name={b.name} meta={b.blurb} selected={bgId === b.id} />
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Your pictures</h3>
        <div className="bg-grid">
          {uploads.map((u) => (
            <Card key={u.id} id={u.id} name={u.name} selected={bgId === u.id} onRemove={() => void removeBackgroundPicture(u.id)} />
          ))}
          <div className="bg-card-wrap">
            <button className="bg-card add" onClick={pickBackgroundPicture}>
              <div className="img">
                <span className="bg-icon">
                  <IconUpload />
                </span>
              </div>
              <span className="name">Add a picture</span>
              <span className="meta">or drop one here</span>
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="setting">
          <div>
            Twinkling lights and live fireworks
            <small>Animates the painted backgrounds</small>
          </div>
          <Switch label="Twinkling lights and live fireworks" checked={bgAnimate} onChange={setBackgroundAnimation} />
        </div>
        <p className="fineprint">
          For the cleanest cut-out, stand 1.5 to 2 metres away with light on you. Backgrounds are painted on this device and your pictures never leave it.
        </p>
      </div>
    </div>
  );
}

/** Small status pill on the stage while a background is painted or the cut-out loads. */
export function BackdropChip() {
  const { painting, cutout, msg, mode, bgId } = useApp(useShallow((s) => ({ painting: s.bgPainting, cutout: s.bgCutout, msg: s.bgMsg, mode: s.mode, bgId: s.bgId })));
  let text: string | null = null;
  if (painting) text = msg ?? 'Painting the background…';
  else if (cutout === 'loading' && mode !== 'mannequin' && bgId !== 'camera') text = 'Preparing the background cut-out…';
  if (!text) return null;
  return (
    <div className="bg-chip" role="status" aria-live="polite">
      <i />
      {text}
    </div>
  );
}
