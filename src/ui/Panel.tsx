import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useApp, type Occasion } from '../state/store';
import { OUTFITS, OUTFIT_MAP, PALETTE, PIECE_MAP, ZARI_OPTIONS, piecesFor } from '../engine/catalog/catalog';
import { SLOT_LABELS, SLOT_ORDER, type SlotId, type StyleControl } from '../engine/catalog/types';
import { FABRICS, type FabricType } from '../engine/materials/FabricLibrary';
import { BORDER_LABELS, PATTERN_LABELS, drawBorder, drawPattern, type BorderId, type PatternColors, type PatternId } from '../engine/materials/patterns';

const OCCASIONS: Occasion[] = ['All', 'Wedding', 'Festive', 'Everyday', 'Ceremonial'];

export function Panel() {
  const { panel, setPanel, expanded, setExpanded } = useApp(
    useShallow((s) => ({ panel: s.panel, setPanel: s.setPanel, expanded: s.sheetExpanded, setExpanded: s.setSheetExpanded })),
  );
  return (
    <aside className={`panel${expanded ? ' expanded' : ''}`} aria-label="Outfits and customisation">
      <button className="handle" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Collapse panel' : 'Expand panel'} aria-expanded={expanded} />
      <div className="panel-head">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={panel === 'outfits'} onClick={() => setPanel('outfits')}>
            Outfits
          </button>
          <button
            role="tab"
            aria-selected={panel === 'customise'}
            onClick={() => {
              setPanel('customise');
              setExpanded(true);
            }}
          >
            Customise
          </button>
        </div>
        {panel === 'outfits' && <LibraryHead />}
      </div>
      <div className="panel-body">{panel === 'outfits' ? <Library /> : <Customiser />}</div>
    </aside>
  );
}

function LibraryHead() {
  const { gender, setGender, occasion, setOccasion } = useApp(useShallow((s) => ({ gender: s.gender, setGender: s.setGender, occasion: s.occasion, setOccasion: s.setOccasion })));
  return (
    <>
      <div className="gender" role="group" aria-label="Collection">
        <button aria-pressed={gender === 'women'} onClick={() => setGender('women')}>
          Women
        </button>
        <button aria-pressed={gender === 'men'} onClick={() => setGender('men')}>
          Men
        </button>
      </div>
      <div className="chips" role="group" aria-label="Occasion">
        {OCCASIONS.map((o) => (
          <button key={o} className="chip" aria-pressed={occasion === o} onClick={() => setOccasion(o)}>
            {o}
          </button>
        ))}
      </div>
    </>
  );
}

function Library() {
  const { gender, occasion, outfitId, chooseOutfit, thumbs } = useApp(
    useShallow((s) => ({ gender: s.gender, occasion: s.occasion, outfitId: s.outfitId, chooseOutfit: s.chooseOutfit, thumbs: s.thumbs })),
  );
  const list = OUTFITS.filter((o) => o.gender === gender && (occasion === 'All' || o.occasion === occasion));
  const current = outfitId ? OUTFIT_MAP.get(outfitId) : null;
  return (
    <>
      <p className="lede">Pick a look to wear it instantly, then tailor colours, fabric and drape in Customise.</p>
      <div className="grid">
        {list.map((o) => (
          <button key={o.id} className="card" aria-pressed={o.id === outfitId} onClick={() => chooseOutfit(o.id)}>
            <div className="img">{thumbs[o.id] ? <img src={thumbs[o.id]} alt="" /> : <span className="ph">Tailoring…</span>}</div>
            <span className="name">{o.name}</span>
            <span className="meta">
              {o.region}, {o.occasion.toLowerCase()}
            </span>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="lede">No {gender === 'men' ? "men's" : "women's"} outfits for this occasion yet.</p>}
      {current && (
        <div className="outfit-note">
          <b>{current.name}</b>
          {current.description}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- customiser
function useSwatches(colors: PatternColors | undefined) {
  const key = colors ? `${colors.base}${colors.accent}${colors.border}${colors.zari}` : '';
  return useMemo(() => {
    if (!colors) return { patterns: {} as Record<string, string>, borders: {} as Record<string, string> };
    const patterns: Record<string, string> = {};
    const borders: Record<string, string> = {};
    for (const id of Object.keys(PATTERN_LABELS) as PatternId[]) patterns[id] = drawPattern(id, colors, 128).color.toDataURL('image/jpeg', 0.8);
    for (const id of Object.keys(BORDER_LABELS) as BorderId[]) borders[id] = drawBorder(id, colors, 256, 64).color.toDataURL('image/jpeg', 0.8);
    return { patterns, borders };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

function Customiser() {
  const { gender, selection, activeSlot, setActiveSlot, setPiece, updateSlot, setParam, resetOutfit, outfitId } = useApp(
    useShallow((s) => ({
      gender: s.gender,
      selection: s.selection,
      activeSlot: s.activeSlot,
      setActiveSlot: s.setActiveSlot,
      setPiece: s.setPiece,
      updateSlot: s.updateSlot,
      setParam: s.setParam,
      resetOutfit: s.resetOutfit,
      outfitId: s.outfitId,
    })),
  );
  const slots = SLOT_ORDER.filter((sl) => piecesFor(gender, sl).length > 0);
  const state = selection.slots[activeSlot];
  const def = state ? PIECE_MAP.get(state.pieceId) : undefined;
  const sw = useSwatches(state && !def?.noFabric ? state.fabric.colors : undefined);
  const options = piecesFor(gender, activeSlot);
  const sareeOn = selection.slots.bottom && PIECE_MAP.get(selection.slots.bottom.pieceId)?.kind === 'saree';

  return (
    <>
      <div className="section">
        <h3>Wearing</h3>
        <div className="wearing" role="group" aria-label="Outfit pieces">
          {slots.map((sl) => {
            const st = selection.slots[sl];
            const name = st ? PIECE_MAP.get(st.pieceId)?.name : sl === 'drape' && sareeOn ? 'Saree pallu' : null;
            return (
              <button key={sl} className={`slot${name ? '' : ' empty'}`} aria-pressed={activeSlot === sl} onClick={() => setActiveSlot(sl)}>
                <small>{SLOT_LABELS[sl]}</small>
                <span>{name ?? 'Add'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h3>{SLOT_LABELS[activeSlot]}</h3>
        <div className="chips wrap" role="group" aria-label={`${SLOT_LABELS[activeSlot]} piece`}>
          <button className="chip" aria-pressed={!state} onClick={() => setPiece(activeSlot, null)}>
            None
          </button>
          {options.map((p) => (
            <button key={p.id} className="chip" aria-pressed={state?.pieceId === p.id} onClick={() => setPiece(activeSlot, p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        {activeSlot === 'drape' && sareeOn && <p className="stats">The saree includes its own pallu. Choosing a drape here swaps the saree out.</p>}
        {def &&
          state &&
          def.controls.map((c) => <Control key={c.key} control={c} value={state.params[c.key] ?? def.params[c.key]} onChange={(v) => setParam(activeSlot, c.key, v)} />)}
      </div>

      {def && state && !def.noFabric && (
        <>
          <div className="section">
            <h3>Fabric</h3>
            <div className="chips wrap" role="group" aria-label="Fabric">
              {(Object.keys(FABRICS) as FabricType[]).map((f) => (
                <button key={f} className="chip" aria-pressed={state.fabric.type === f} onClick={() => updateSlot(activeSlot, { fabric: { ...state.fabric, type: f } })}>
                  {FABRICS[f].label}
                </button>
              ))}
            </div>
            <div className="field">
              <span className="label">Pattern: {PATTERN_LABELS[state.fabric.pattern]}</span>
              <div className="swatches" role="group" aria-label="Pattern">
                {(Object.keys(PATTERN_LABELS) as PatternId[]).map((id) => (
                  <button key={id} className="swatch" aria-pressed={state.fabric.pattern === id} onClick={() => updateSlot(activeSlot, { fabric: { ...state.fabric, pattern: id } })} title={PATTERN_LABELS[id]} aria-label={PATTERN_LABELS[id]}>
                    <img src={sw.patterns[id]} alt="" />
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span className="label">Border: {BORDER_LABELS[state.fabric.border]}</span>
              <div className="swatches borders" role="group" aria-label="Border">
                {(Object.keys(BORDER_LABELS) as BorderId[]).map((id) => (
                  <button key={id} className="swatch" aria-pressed={state.fabric.border === id} onClick={() => updateSlot(activeSlot, { fabric: { ...state.fabric, border: id } })} title={BORDER_LABELS[id]} aria-label={BORDER_LABELS[id]}>
                    <img src={sw.borders[id]} alt="" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="section">
            <h3>Colours</h3>
            <div className="colors">
              <ColorRow label="Base" value={state.fabric.colors.base} options={PALETTE} onPick={(hex) => updateSlot(activeSlot, { colors: { base: hex } })} />
              <ColorRow label="Motif" value={state.fabric.colors.accent} options={PALETTE} onPick={(hex) => updateSlot(activeSlot, { colors: { accent: hex } })} />
              <ColorRow label="Border" value={state.fabric.colors.border} options={PALETTE} onPick={(hex) => updateSlot(activeSlot, { colors: { border: hex } })} />
              <ColorRow label="Zari" value={state.fabric.colors.zari} options={ZARI_OPTIONS} onPick={(hex) => updateSlot(activeSlot, { colors: { zari: hex } })} />
            </div>
          </div>
        </>
      )}
      {!state && <p className="lede">Choose a piece above to add it to the outfit.</p>}
      <div className="section">
        <button className="text-btn" onClick={resetOutfit}>
          {outfitId ? 'Reset this outfit' : 'Back to the original outfit'}
        </button>
      </div>
    </>
  );
}

function ColorRow({ label, value, options, onPick }: { label: string; value: string; options: { name: string; hex: string }[]; onPick: (hex: string) => void }) {
  const v = value.toLowerCase();
  const known = options.some((o) => o.hex.toLowerCase() === v);
  return (
    <div className="color-row">
      <span>{label}</span>
      <div className="dots" role="group" aria-label={`${label} colour`}>
        {!known && <button className="dot" aria-pressed style={{ background: value }} aria-label={`Current ${value}`} />}
        {options.map((o) => (
          <button key={o.hex} className="dot" style={{ background: o.hex }} aria-pressed={o.hex.toLowerCase() === v} onClick={() => onPick(o.hex)} title={o.name} aria-label={o.name} />
        ))}
        <label className="dot custom" title="Custom colour">
          <span className="sr-only">Custom {label.toLowerCase()} colour</span>
          <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function Control({ control, value, onChange }: { control: StyleControl; value: unknown; onChange: (v: unknown) => void }) {
  if (control.key === 'hem' && control.options) {
    // garment length as a tailor's tape with body landmarks
    const opts = control.options;
    let best = 0;
    opts.forEach((o, i) => {
      if (Math.abs((o.value as number) - (value as number)) < Math.abs((opts[best].value as number) - (value as number))) best = i;
    });
    return (
      <div className="field">
        <span className="label">{control.label}</span>
        <div className="lentape" role="group" aria-label="Length">
          {opts.map((o, i) => (
            <button key={o.label} aria-pressed={i === best} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (control.options) {
    return (
      <div className="field">
        <span className="label">{control.label}</span>
        <div className="chips wrap" role="group" aria-label={control.label}>
          {control.options.map((o) => (
            <button key={String(o.value)} className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="field">
      <label>
        {control.label}
        <input className="range" type="range" min={control.min} max={control.max} step={control.step} value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    </div>
  );
}

export type { SlotId };
