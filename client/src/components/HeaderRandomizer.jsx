import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getRandomizerRosters, saveRandomizerRosters } from '../lib/api';

const DEFAULT_NAMES = ['Anna', 'Ben', 'Clara', 'David', 'Emilia', 'Felix', 'Greta', 'Hassan', 'Ida', 'Jonas', 'Lea', 'Milan'];
const NAME_DRAW_DURATION_MS = 650;
const newRoster = (name = 'Neue Klasse', kind = 'class', students = []) => ({ id: `local-${Date.now()}-${Math.random()}`, name, kind, students, groups: [] });
const fallbackRosters = () => [newRoster('Allgemein', 'class', DEFAULT_NAMES.map((name, index) => ({ id: `default-${index}`, name })))];
const textValue = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

function normalizeRosters(value) {
  if (!Array.isArray(value)) return fallbackRosters();
  const rosters = value.filter((roster) => roster && typeof roster === 'object').map((roster, index) => {
    const students = Array.isArray(roster.students) ? roster.students.map((student, studentIndex) => {
      const name = typeof student === 'object' && student !== null ? textValue(student.name) : textValue(student);
      return name ? { id: typeof student === 'object' && student?.id ? String(student.id) : `local-student-${index}-${studentIndex}`, name } : null;
    }).filter(Boolean) : [];
    const groups = Array.isArray(roster.groups) ? roster.groups.map((group) => Array.isArray(group) ? group.map(textValue).filter(Boolean) : []).filter((group) => group.length) : [];
    return { id: roster.id ? String(roster.id) : `local-${index}-${Date.now()}`, name: textValue(roster.name) || `Gruppe ${index + 1}`, kind: roster.kind === 'course' ? 'course' : 'class', students, groups };
  });
  return rosters.length ? rosters : fallbackRosters();
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function parseStudentNames(text) {
  const seen = new Set();
  const names = [];
  let duplicateCount = 0;
  text.split('\n').forEach((rawName) => {
    const name = rawName.trim();
    if (!name) return;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) { duplicateCount += 1; return; }
    seen.add(key);
    names.push(name);
  });
  return { names, duplicateCount };
}

export default function HeaderRandomizer() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('names');
  const [rosters, setRosters] = useState(() => normalizeRosters([]));
  const [selectedId, setSelectedId] = useState(() => rosters[0].id);
  const [groupSize, setGroupSize] = useState(3);
  const [selectedName, setSelectedName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayGroups, setDisplayGroups] = useState([]);
  const [displayMode, setDisplayMode] = useState('name');
  const [studentDrafts, setStudentDrafts] = useState({});
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [saveState, setSaveState] = useState('saved');
  const [loadState, setLoadState] = useState('loading');
  const [displayFullscreen, setDisplayFullscreen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const saveVersionRef = useRef(0);
  const saveTimerRef = useRef(null);
  const displayRef = useRef(null);
  const loadRequestRef = useRef(0);
  const localChangeVersionRef = useRef(0);
  const drawTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const rostersRef = useRef(rosters);
  rostersRef.current = rosters;
  const roster = rosters.find((item) => item.id === selectedId) || rosters[0];

  const loadRosters = useCallback(async () => {
    const request = ++loadRequestRef.current;
    const localVersion = localChangeVersionRef.current;
    setLoadState('loading');
    try {
      const value = await getRandomizerRosters();
      if (request !== loadRequestRef.current) return;
      if (localVersion === localChangeVersionRef.current) {
        const next = normalizeRosters(value);
        setRosters(next); setSelectedId(next[0].id);
        setStudentDrafts(Object.fromEntries(next.map((item) => [item.id, item.students.map((student) => student.name).join('\n')])));
      }
      setLoadState('ready');
    } catch { if (request === loadRequestRef.current) setLoadState('error'); }
  }, []);

  useEffect(() => { loadRosters(); return () => { loadRequestRef.current += 1; }; }, [loadRosters]);

  useEffect(() => () => {
    clearTimeout(drawTimerRef.current);
    audioContextRef.current?.close?.().catch(() => {});
    window.speechSynthesis?.cancel?.();
  }, []);

  const persist = useCallback((nextRosters, selectedIndex = 0) => {
    const version = ++saveVersionRef.current;
    setSaveState('saving');
    const payload = nextRosters.map((item) => ({
      name: item.name, kind: item.kind, groups: item.groups,
      students: item.students.map((student) => ({ name: student.name })),
    }));
    const save = () => saveRandomizerRosters(payload).then((serverRosters) => {
      if (version !== saveVersionRef.current) return;
      const next = normalizeRosters(serverRosters);
      setRosters(next);
      setSelectedId(next[Math.min(selectedIndex, next.length - 1)]?.id || next[0].id);
      setStudentDrafts(Object.fromEntries(next.map((item) => [item.id, item.students.map((student) => student.name).join('\n')])));
      setSaveState('saved');
    }).catch(() => { if (version === saveVersionRef.current) setSaveState('error'); });
    saveQueueRef.current = saveQueueRef.current.catch(() => {}).then(save);
    return saveQueueRef.current;
  }, []);

  const updateRosters = useCallback((updater, selectedIndex = null) => {
    localChangeVersionRef.current += 1;
    setRosters((current) => {
      const next = updater(current);
      const index = selectedIndex === null ? Math.max(0, next.findIndex((item) => item.id === selectedId)) : selectedIndex;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => persist(next, index), 650);
      return next;
    });
  }, [persist, selectedId]);

  const saveNow = useCallback(() => {
    localChangeVersionRef.current += 1;
    clearTimeout(saveTimerRef.current);
    const latestRosters = rostersRef.current;
    return persist(latestRosters, Math.max(0, latestRosters.findIndex((item) => item.id === selectedId)));
  }, [persist, selectedId]);

  const closeDisplay = useCallback(async () => {
    if (document.fullscreenElement === displayRef.current) {
      try { await document.exitFullscreen(); } catch {}
    }
    setDisplayFullscreen(false);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => { if (!document.fullscreenElement) setDisplayFullscreen(false); };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!displayFullscreen) return undefined;
    const handleKeyDown = (event) => { if (event.key === 'Escape') closeDisplay(); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeDisplay, displayFullscreen]);

  const openDisplay = (nextMode, name = '', groups = []) => {
    setDisplayMode(nextMode); setDisplayName(name); setDisplayGroups(groups); setDisplayFullscreen(true);
    requestAnimationFrame(() => {
      const request = displayRef.current?.requestFullscreen?.();
      request?.catch(() => {});
    });
  };

  const addRoster = () => {
    const next = newRoster();
    updateRosters((current) => [...current, next], rosters.length);
    setSelectedId(next.id);
    setStudentDrafts((current) => ({ ...current, [next.id]: '' }));
  };

  const deleteRoster = () => {
    if (rosters.length === 1) return;
    const index = rosters.findIndex((item) => item.id === selectedId);
    const next = rosters.filter((item) => item.id !== selectedId);
    setSelectedId(next[Math.max(0, index - 1)].id);
    updateRosters(() => next, Math.max(0, index - 1));
  };

  const playDiceSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = audioContextRef.current || new AudioContext();
      audioContextRef.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(480, now);
      oscillator.frequency.exponentialRampToValueAtTime(740, now + 0.16);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.25);
      context.resume?.().catch(() => {});
    } catch {}
  };

  const speakName = (name) => {
    try {
      const synthesis = window.speechSynthesis;
      const Utterance = window.SpeechSynthesisUtterance;
      if (!synthesis || !Utterance || !name) return;
      synthesis.cancel();
      const utterance = new Utterance(name);
      utterance.lang = 'de-DE';
      synthesis.speak(utterance);
    } catch {}
  };

  const drawName = () => {
    if (!roster?.students.length || isRolling) return;
    const names = roster.students.map((student) => student.name);
    const candidates = names.length > 1 ? names.filter((name) => name !== selectedName) : names;
    const nextName = candidates[Math.floor(Math.random() * candidates.length)];
    setIsRolling(true);
    openDisplay('name');
    playDiceSound();
    clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(() => {
      setSelectedName(nextName);
      setDisplayName(nextName);
      setIsRolling(false);
      speakName(nextName);
    }, NAME_DRAW_DURATION_MS);
  };

  const makeGroups = () => {
    if (!roster?.students.length || groupSize < 2) return;
    const names = shuffled(roster.students.map((student) => student.name));
    const groups = [];
    for (let index = 0; index < names.length; index += groupSize) groups.push(names.slice(index, index + groupSize));
    updateRosters((current) => current.map((item) => item.id === selectedId ? { ...item, groups } : item));
    openDisplay('groups', '', groups);
  };

  const setStudentNames = (text) => {
    const parsed = parseStudentNames(text);
    setDuplicateCount(parsed.duplicateCount);
    setStudentDrafts((current) => ({ ...current, [roster.id]: text }));
    updateRosters((current) => current.map((item) => item.id === roster.id
      ? { ...item, groups: [], students: parsed.names.map((name, index) => ({ id: `local-student-${index}-${name}`, name })) } : item));
  };

  const exportRoster = () => {
    const groupByName = new Map(roster.groups.flatMap((group, index) => group.map((name) => [name, `Gruppe ${index + 1}`])));
    const rows = [['Vorname', 'Gruppe'], ...roster.students.map((student) => [student.name, groupByName.get(student.name) || ''])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `${roster.name || 'Zufallsgruppe'}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const statusLabel = saveState === 'saving' ? 'Speichert …' : saveState === 'error' ? 'Fehler beim Speichern' : 'Gespeichert';
  return <div className="lm-header-randomizer">
    <button type="button" className="lm-spring lm-workspace-tool lm-header-randomizer-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" title="Zufallsnamen und Zufallsgruppen">🎲</button>
    {open && createPortal(<div className="lm-header-randomizer-backdrop" onMouseDown={() => setOpen(false)}><section className="lm-header-randomizer-modal" role="dialog" aria-modal="true" aria-label="Zufallsnamen und Zufallsgruppen" onMouseDown={(event) => event.stopPropagation()}>
      <div className="lm-header-randomizer-heading"><div><strong>Zufallsgenerator</strong><span>Premium-Unterrichtswerkzeug · Klassen und Kurse getrennt verwalten</span></div><button type="button" className="lm-header-randomizer-close" onClick={() => setOpen(false)} aria-label="Zufallsgenerator schließen">×</button></div>
      {loadState === 'loading' && <div className="lm-header-randomizer-notice is-loading" role="status">Gespeicherte Klassen werden geladen … Du kannst bereits arbeiten.</div>}
      {loadState === 'error' && <div className="lm-header-randomizer-notice is-error" role="alert"><span>Klassen konnten nicht geladen werden. Die Standardklasse bleibt verfügbar.</span><button type="button" onClick={loadRosters}>Erneut versuchen</button></div>}
        <div className="lm-header-randomizer-roster-row"><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setSelectedName(''); setDuplicateCount(0); }} aria-label="Klasse oder Kurs auswählen">{rosters.map((item) => <option value={item.id} key={item.id}>{item.kind === 'course' ? 'Kurs' : 'Klasse'} · {item.name}</option>)}</select><button type="button" onClick={addRoster} title="Klasse oder Kurs hinzufügen">＋</button><button type="button" onClick={deleteRoster} disabled={rosters.length === 1} title="Klasse oder Kurs löschen">−</button></div>
        <div className="lm-header-randomizer-roster-edit"><input value={roster.name} onChange={(event) => updateRosters((current) => current.map((item) => item.id === roster.id ? { ...item, name: event.target.value } : item))} onBlur={saveNow} aria-label="Name der Klasse oder des Kurses" /><select value={roster.kind} onChange={(event) => updateRosters((current) => current.map((item) => item.id === roster.id ? { ...item, kind: event.target.value } : item))} aria-label="Typ auswählen"><option value="class">Klasse</option><option value="course">Kurs</option></select></div>
        <div className="lm-header-randomizer-meta"><span className={`lm-header-randomizer-save-state is-${saveState}`}>● {statusLabel}</span><span>{roster.students.length} Personen{duplicateCount ? ` · ${duplicateCount} Duplikat${duplicateCount === 1 ? '' : 'e'} ignoriert` : ''}</span></div>
        {saveState === 'error' && <div className="lm-header-randomizer-notice is-error" role="alert"><span>Die Änderungen wurden nicht gespeichert.</span><button type="button" onClick={saveNow}>Speichern wiederholen</button></div>}
        <div className="lm-header-randomizer-actions"><button type="button" onClick={saveNow}>Speichern</button><button type="button" onClick={exportRoster} disabled={!roster.students.length}>CSV exportieren</button></div>
        <div className="lm-header-randomizer-tabs" role="tablist" aria-label="Zufallsgenerator-Modus"><button type="button" role="tab" aria-selected={mode === 'names'} className={mode === 'names' ? 'is-active' : ''} onClick={() => setMode('names')}>Zufallsname</button><button type="button" role="tab" aria-selected={mode === 'groups'} className={mode === 'groups' ? 'is-active' : ''} onClick={() => setMode('groups')}>Zufallsgruppen</button></div>
        <label className="lm-header-randomizer-field"><span>Vornamen · eine Person pro Zeile</span><textarea value={studentDrafts[roster.id] ?? roster.students.map((student) => student.name).join('\n')} onChange={(event) => setStudentNames(event.target.value)} onBlur={saveNow} rows={6} placeholder="Vorname eingeben und Enter drücken …" /></label>
        {mode === 'names' ? <div className="lm-header-randomizer-result"><span>{roster.kind === 'course' ? 'Kurs' : 'Klasse'} · {roster.name}</span><strong>{selectedName || 'Noch niemand ausgewählt'}</strong><button type="button" className="lm-header-randomizer-primary" onClick={drawName} disabled={!roster.students.length || isRolling}>Zufallsnamen auswählen und anzeigen</button></div> : <><label className="lm-header-randomizer-size"><span>Personen pro Gruppe</span><input type="number" min="2" max="20" value={groupSize} onChange={(event) => setGroupSize(Math.min(20, Math.max(2, Number.parseInt(event.target.value, 10) || 2)))} /></label><button type="button" className="lm-header-randomizer-primary" onClick={makeGroups} disabled={!roster.students.length || roster.students.length < 2}>Gruppen bilden und anzeigen</button><div className="lm-header-randomizer-groups">{roster.groups.length ? <><div className="lm-header-randomizer-groups-toolbar"><span>{roster.groups.length} Gruppen · jede Person genau einmal</span><button type="button" onClick={makeGroups}>Neu mischen</button><button type="button" onClick={() => openDisplay('groups', '', roster.groups)}>Vollbild</button></div>{roster.groups.map((group, index) => <div className="lm-header-randomizer-group" key={`group-${index}`}><strong>Gruppe {index + 1}</strong><span>{group.join(' · ')}</span></div>)}</> : <span className="lm-header-randomizer-empty">Noch keine Gruppen gebildet</span>}</div></>}
    </section></div>, document.body)}
    {displayFullscreen && <section ref={displayRef} className="lm-header-randomizer-display" role="dialog" aria-modal="true" aria-label={`${roster.kind === 'course' ? 'Kurs' : 'Klasse'} ${roster.name}`}><button type="button" className="lm-header-randomizer-display-close" onClick={closeDisplay}>Esc · Zurück</button><div className="lm-header-randomizer-display-content"><span>{roster.kind === 'course' ? 'Kurs' : 'Klasse'} · {roster.name}</span>{displayMode === 'name' ? <><h1 aria-live="polite">{isRolling ? '🎲' : displayName}</h1><button type="button" className={`lm-header-randomizer-display-draw${isRolling ? ' is-rolling' : ''}`} onClick={drawName} disabled={isRolling} aria-label={isRolling ? 'Würfel rollt' : 'Weiteren Zufallsnamen auswählen'}>🎲</button><small>{isRolling ? 'Würfel rollt …' : 'Weiteren Namen auswählen'}</small></> : <><div className="lm-header-randomizer-display-groups">{displayGroups.map((group, index) => <div key={`display-group-${index}`}><strong>Gruppe {index + 1}</strong><span>{group.join(' · ')}</span></div>)}</div><button type="button" className="lm-header-randomizer-primary" onClick={makeGroups}>Neu mischen</button></>}</div></section>}
  </div>;
}
