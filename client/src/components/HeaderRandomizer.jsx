import { useCallback, useEffect, useRef, useState } from 'react';
import { getRandomizerRosters, saveRandomizerRosters } from '../lib/api';

const DEFAULT_NAMES = ['Anna', 'Ben', 'Clara', 'David', 'Emilia', 'Felix', 'Greta', 'Hassan', 'Ida', 'Jonas', 'Lea', 'Milan'];
const newRoster = (name = 'Neue Klasse', kind = 'class', students = []) => ({ id: `local-${Date.now()}-${Math.random()}`, name, kind, students, groups: [] });

function normalizeRosters(value) {
  if (!Array.isArray(value) || !value.length) return [newRoster('Allgemein', 'class', DEFAULT_NAMES)];
  return value.map((roster, index) => ({
    id: roster.id || `local-${index}-${Date.now()}`,
    name: String(roster.name || `Gruppe ${index + 1}`),
    kind: roster.kind === 'course' ? 'course' : 'class',
    students: Array.isArray(roster.students) ? roster.students.map((student) => typeof student === 'string' ? { id: `local-student-${Math.random()}`, name: student } : { id: student.id || `local-student-${Math.random()}`, name: String(student.name || '') }).filter((student) => student.name) : [],
    groups: Array.isArray(roster.groups) ? roster.groups : [],
  }));
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
  const [rosters, setRosters] = useState(() => normalizeRosters([]));
  const [selectedId, setSelectedId] = useState(() => rosters[0].id);
  const [groupSize, setGroupSize] = useState(3);
  const [selectedName, setSelectedName] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [displayFullscreen, setDisplayFullscreen] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const displayRef = useRef(null);
  const roster = rosters.find((item) => item.id === selectedId) || rosters[0];

  useEffect(() => {
    let active = true;
    getRandomizerRosters()
      .then((value) => {
        if (!active || !Array.isArray(value) || !value.length) return;
        const next = normalizeRosters(value);
        setRosters(next);
        setSelectedId(next[0].id);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  const persist = useCallback((nextRosters) => {
    const payload = nextRosters.map((item) => ({ ...item, students: item.students.map((student) => ({ name: student.name })) }));
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(() => saveRandomizerRosters(payload));
  }, []);

  const closeDisplay = useCallback(async () => {
    if (document.fullscreenElement === displayRef.current) {
      try { await document.exitFullscreen(); } catch {}
    }
    setDisplayFullscreen(false);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setDisplayFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!displayFullscreen) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') closeDisplay(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeDisplay, displayFullscreen]);

  const updateRoster = useCallback((patch) => {
    setRosters((current) => {
      const next = current.map((item) => item.id === selectedId ? { ...item, ...patch } : item);
      persist(next);
      return next;
    });
  }, [persist, selectedId]);

  const addRoster = () => {
    const next = newRoster();
    setRosters((current) => {
      const updated = [...current, next];
      persist(updated);
      return updated;
    });
    setSelectedId(next.id);
  };

  const deleteRoster = () => {
    if (rosters.length === 1) return;
    const next = rosters.filter((item) => item.id !== selectedId);
    setRosters(next);
    setSelectedId(next[0].id);
    persist(next);
  };

  const drawName = () => {
    if (!roster?.students.length) return;
    const names = roster.students.map((student) => student.name);
    const candidates = names.length > 1 ? names.filter((name) => name !== selectedName) : names;
    setSelectedName(candidates[Math.floor(Math.random() * candidates.length)]);
  };

  const makeGroups = () => {
    if (!roster?.students.length) return;
    const groups = [];
    const names = shuffled(roster.students.map((student) => student.name));
    for (let index = 0; index < names.length; index += groupSize) groups.push(names.slice(index, index + groupSize));
    updateRoster({ groups });
  };

  const setStudentNames = (text) => updateRoster({ students: text.split('\n').map((name) => name.trim()).filter(Boolean).map((name, index) => ({ id: `local-student-${index}-${name}`, name })) });

  const openDisplay = async () => {
    setOpen(false);
    setDisplayFullscreen(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try { await displayRef.current?.requestFullscreen?.(); } catch {}
  };

  return (
    <div className="lm-header-randomizer">
      <button type="button" className="lm-spring lm-workspace-tool lm-header-randomizer-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" title="Zufallsnamen und Zufallsgruppen">🎲</button>
      {open && <section className="lm-header-randomizer-panel" role="dialog" aria-label="Zufallsnamen und Zufallsgruppen">
        <div className="lm-header-randomizer-heading"><div><strong>Zufallsgenerator</strong><span>Klassen und Kurse getrennt verwalten</span></div><button type="button" className="lm-header-randomizer-close" onClick={() => setOpen(false)} aria-label="Zufallsgenerator schließen">×</button></div>
        {!loaded ? <div className="lm-header-randomizer-loading">Wird geladen …</div> : <>
          <div className="lm-header-randomizer-roster-row"><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setSelectedName(''); }} aria-label="Klasse oder Kurs auswählen">{rosters.map((item) => <option value={item.id} key={item.id}>{item.kind === 'course' ? 'Kurs' : 'Klasse'} · {item.name}</option>)}</select><button type="button" onClick={addRoster} title="Klasse oder Kurs hinzufügen">＋</button><button type="button" onClick={deleteRoster} disabled={rosters.length === 1} title="Klasse oder Kurs löschen">−</button></div>
          <div className="lm-header-randomizer-roster-edit"><input value={roster.name} onChange={(event) => updateRoster({ name: event.target.value })} aria-label="Name der Klasse oder des Kurses" /><select value={roster.kind} onChange={(event) => updateRoster({ kind: event.target.value })} aria-label="Typ auswählen"><option value="class">Klasse</option><option value="course">Kurs</option></select></div>
          <div className="lm-header-randomizer-actions"><button type="button" onClick={() => persist(rosters)}>Speichern</button><button type="button" onClick={openDisplay} disabled={!roster.students.length && !roster.groups.length}>Vollbild anzeigen</button></div>
          <div className="lm-header-randomizer-tabs" role="tablist" aria-label="Zufallsgenerator-Modus"><button type="button" role="tab" aria-selected={mode === 'names'} className={mode === 'names' ? 'is-active' : ''} onClick={() => setMode('names')}>Zufallsname</button><button type="button" role="tab" aria-selected={mode === 'groups'} className={mode === 'groups' ? 'is-active' : ''} onClick={() => setMode('groups')}>Zufallsgruppen</button></div>
          <label className="lm-header-randomizer-field"><span>Schülerinnen und Schüler (eine Person pro Zeile)</span><textarea value={roster.students.map((student) => student.name).join('\n')} onChange={(event) => setStudentNames(event.target.value)} rows={6} placeholder="Name eintragen …" /></label>
          {mode === 'names' ? <div className="lm-header-randomizer-result"><span>{roster.kind === 'course' ? 'Kurs' : 'Klasse'} · {roster.name}</span><strong>{selectedName || 'Noch niemand ausgewählt'}</strong><button type="button" className="lm-header-randomizer-primary" onClick={drawName} disabled={!roster.students.length}>Namen ziehen</button></div> : <><label className="lm-header-randomizer-size"><span>Personen pro Gruppe</span><input type="number" min="2" max="20" value={groupSize} onChange={(event) => setGroupSize(Math.min(20, Math.max(2, Number.parseInt(event.target.value, 10) || 2)))} /></label><button type="button" className="lm-header-randomizer-primary" onClick={makeGroups} disabled={!roster.students.length}>Gruppen bilden</button><div className="lm-header-randomizer-groups">{roster.groups.length ? roster.groups.map((group, index) => <div className="lm-header-randomizer-group" key={`group-${index}`}><strong>Gruppe {index + 1}</strong><span>{group.join(' · ')}</span></div>) : <span className="lm-header-randomizer-empty">Noch keine Gruppen gebildet</span>}</div></>}
        </>}
      </section>}
      {displayFullscreen && <section ref={displayRef} className="lm-header-randomizer-display" role="dialog" aria-modal="true" aria-label={`${roster.kind === 'course' ? 'Kurs' : 'Klasse'} ${roster.name}`}>
        <button type="button" className="lm-header-randomizer-display-close" onClick={closeDisplay}>Esc · Zurück</button>
        <div className="lm-header-randomizer-display-content">
          <span>{roster.kind === 'course' ? 'Kurs' : 'Klasse'}</span>
          <h1>{roster.name}</h1>
          {mode === 'groups' && roster.groups.length ? <div className="lm-header-randomizer-display-groups">{roster.groups.map((group, index) => <div key={`display-group-${index}`}><strong>Gruppe {index + 1}</strong>{group.map((name) => <span key={`${index}-${name}`}>{name}</span>)}</div>)}</div> : <div className="lm-header-randomizer-display-students">{roster.students.map((student, index) => <span key={student.id}>{index + 1}. {student.name}</span>)}</div>}
        </div>
      </section>}
    </div>
  );
}
