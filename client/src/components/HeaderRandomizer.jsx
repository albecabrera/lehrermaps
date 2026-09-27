import { useCallback, useEffect, useRef, useState } from 'react';
import { getRandomizerState, saveRandomizerState } from '../lib/api';

const DEFAULT_NAMES = [
  'Anna', 'Ben', 'Clara', 'David', 'Emilia', 'Felix', 'Greta', 'Hassan',
  'Ida', 'Jonas', 'Lea', 'Milan', 'Nora', 'Oskar', 'Paula', 'Quentin',
  'Romy', 'Samir', 'Tilda', 'Viktor', 'Yara', 'Zoe',
];
const DEFAULT_STATE = { names: DEFAULT_NAMES, groupSize: 3, selectedName: '', groups: [] };

function normalizeState(value) {
  if (!value || typeof value !== 'object') return DEFAULT_STATE;
  const names = Array.isArray(value.names)
    ? value.names.map((name) => String(name || '').trim()).filter(Boolean).slice(0, 200)
    : DEFAULT_NAMES;
  const groupSize = Math.min(20, Math.max(2, Number.parseInt(value.groupSize, 10) || 3));
  const groups = Array.isArray(value.groups)
    ? value.groups.map((group) => Array.isArray(group) ? group.map((name) => String(name)) : []).filter((group) => group.length)
    : [];
  return { names, groupSize, selectedName: String(value.selectedName || ''), groups };
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export default function HeaderRandomizer() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('names');
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    getRandomizerState()
      .then((value) => { if (active) setState(normalizeState(value)); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const persist = useCallback((nextState) => {
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(() => saveRandomizerState(nextState));
  }, []);

  const updateState = useCallback((patch) => {
    setState((current) => {
      const nextState = normalizeState({ ...current, ...patch });
      persist(nextState);
      return nextState;
    });
  }, [persist]);

  const drawName = () => {
    if (!state.names.length) return;
    const candidates = state.names.length > 1 ? state.names.filter((name) => name !== state.selectedName) : state.names;
    updateState({ selectedName: candidates[Math.floor(Math.random() * candidates.length)] });
  };

  const makeGroups = () => {
    const groups = [];
    const shuffledNames = shuffled(state.names);
    for (let index = 0; index < shuffledNames.length; index += state.groupSize) groups.push(shuffledNames.slice(index, index + state.groupSize));
    updateState({ groups });
  };

  return (
    <div className="lm-header-randomizer">
      <button type="button" className="lm-spring lm-workspace-tool lm-header-randomizer-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" title="Zufallsnamen und Zufallsgruppen">🎲</button>
      {open && (
        <section className="lm-header-randomizer-panel" role="dialog" aria-label="Zufallsnamen und Zufallsgruppen">
          <div className="lm-header-randomizer-heading"><div><strong>Zufallsgenerator</strong><span>Namen eintragen, auswählen oder Gruppen bilden</span></div><button type="button" className="lm-header-randomizer-close" onClick={() => setOpen(false)} aria-label="Zufallsgenerator schließen">×</button></div>
          <div className="lm-header-randomizer-tabs" role="tablist" aria-label="Zufallsgenerator-Modus">
            <button type="button" role="tab" aria-selected={mode === 'names'} className={mode === 'names' ? 'is-active' : ''} onClick={() => setMode('names')}>Zufallsname</button>
            <button type="button" role="tab" aria-selected={mode === 'groups'} className={mode === 'groups' ? 'is-active' : ''} onClick={() => setMode('groups')}>Zufallsgruppen</button>
          </div>
          {!loaded ? <div className="lm-header-randomizer-loading">Wird geladen …</div> : <>
            <label className="lm-header-randomizer-field"><span>Schülerinnen und Schüler (eine Person pro Zeile)</span><textarea value={state.names.join('\n')} onChange={(event) => updateState({ names: event.target.value.split('\n').map((name) => name.trim()).filter(Boolean) })} rows={6} placeholder="Name eintragen …" /></label>
            {mode === 'names' ? <div className="lm-header-randomizer-result"><span>Ausgewählt</span><strong>{state.selectedName || 'Noch niemand ausgewählt'}</strong><button type="button" className="lm-header-randomizer-primary" onClick={drawName} disabled={!state.names.length}>Namen ziehen</button></div> : <>
              <label className="lm-header-randomizer-size"><span>Personen pro Gruppe</span><input type="number" min="2" max="20" value={state.groupSize} onChange={(event) => updateState({ groupSize: event.target.value })} /></label>
              <button type="button" className="lm-header-randomizer-primary" onClick={makeGroups} disabled={!state.names.length}>Gruppen bilden</button>
              <div className="lm-header-randomizer-groups">{state.groups.length ? state.groups.map((group, index) => <div className="lm-header-randomizer-group" key={`group-${index}`}><strong>Gruppe {index + 1}</strong><span>{group.join(' · ')}</span></div>) : <span className="lm-header-randomizer-empty">Noch keine Gruppen gebildet</span>}</div>
            </>}
          </>}
        </section>
      )}
    </div>
  );
}
