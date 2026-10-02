import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHangmanStatus, HANGMAN_LETTERS, isValidHangmanWord, normalizeGuess, normalizeHangmanWord } from '../lib/hangman';

const DRAWING = [
  { id: 'ground', kind: 'wood', shape: <path pathLength="1" d="M16 190h150" /> },
  { id: 'post', kind: 'wood', shape: <path pathLength="1" d="M48 190V20" /> },
  { id: 'beam', kind: 'wood', shape: <path pathLength="1" d="M48 20h100" /> },
  { id: 'rope', kind: 'rope', shape: <path pathLength="1" d="M148 20v28" /> },
  { id: 'head', kind: 'ink', shape: <circle pathLength="1" cx="148" cy="66" r="18" /> },
  { id: 'body', kind: 'ink', shape: <path pathLength="1" d="M148 84v48" /> },
  { id: 'left-arm', kind: 'ink', shape: <path pathLength="1" d="m148 96-26 23" /> },
  { id: 'right-arm', kind: 'ink', shape: <path pathLength="1" d="m148 96 26 23" /> },
  { id: 'left-leg', kind: 'ink', shape: <path pathLength="1" d="m148 132-25 32" /> },
  { id: 'right-leg', kind: 'ink', shape: <path pathLength="1" d="m148 132 25 32" /> },
];

export default function HangmanTool({ open, onClose }) {
  const surfaceRef = useRef(null);
  const wordInputRef = useRef(null);
  const previousFocusRef = useRef(null);
  const previousDrawingRef = useRef({ errors: 0, stages: 0 });
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState('');
  const [word, setWord] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [maxErrors, setMaxErrors] = useState(8);
  const [displayMode, setDisplayMode] = useState('classic');
  const [showInput, setShowInput] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [smartboard, setSmartboard] = useState(false);
  const [error, setError] = useState('');
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const status = getHangmanStatus(word, guesses, maxErrors);
  const finished = !!word && (status.won || status.lost);
  const visibleStages = Math.ceil(status.errors * DRAWING.length / maxErrors);
  const newlyDrawnFrom = status.errors > previousDrawingRef.current.errors ? previousDrawingRef.current.stages : visibleStages;
  const submitGuess = useCallback((value) => {
    const letter = normalizeGuess(value);
    if (!letter || !word || finished) return;
    setGuesses((current) => {
      const currentStatus = getHangmanStatus(word, current, maxErrors);
      return current.includes(letter) || currentStatus.won || currentStatus.lost ? current : [...current, letter];
    });
  }, [word, finished, maxErrors]);

  useLayoutEffect(() => {
    previousDrawingRef.current = { errors: status.errors, stages: visibleStages };
  }, [status.errors, visibleStages]);
  const close = useCallback(() => {
    if (document.fullscreenElement === surfaceRef.current) document.exitFullscreen?.();
    setSmartboard(false);
    setTeacherOpen(false);
    setWord('');
    setDraft('');
    setHint('');
    setGuesses([]);
    setShowHint(false);
    setShowSolution(false);
    setError('');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const timer = window.setTimeout(() => wordInputRef.current?.focus(), 0);
    return () => { window.clearTimeout(timer); previousFocusRef.current?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === surfaceRef.current;
      setNativeFullscreen(active);
      if (!active) setSmartboard(false);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Tab') {
        const controls = [...surfaceRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        return;
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (teacherOpen) { setTeacherOpen(false); return; }
        if (smartboard) { setSmartboard(false); if (document.fullscreenElement === surfaceRef.current) document.exitFullscreen?.(); return; }
        close();
        return;
      }
      if (!word || finished || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      const letter = normalizeGuess(event.key);
      if (letter) { event.preventDefault(); submitGuess(letter); }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, word, finished, teacherOpen, smartboard, close, submitGuess]);

  useEffect(() => {
    if (!open || word) return undefined;
    const timer = window.setTimeout(() => wordInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, word]);

  if (!open) return null;

  const start = (event) => {
    event?.preventDefault();
    const normalized = normalizeHangmanWord(draft);
    if (!isValidHangmanWord(normalized)) { setError('Bitte einen Begriff mit Buchstaben A–Z, Ä, Ö, Ü oder ß eingeben.'); return; }
    setWord(normalized);
    setGuesses([]);
    setShowHint(false);
    setShowSolution(false);
    setTeacherOpen(false);
    setError('');
    setDraft('');
  };
  const reset = () => { setGuesses([]); setShowSolution(false); setTeacherOpen(false); };
  const newWord = () => { setWord(''); setGuesses([]); setTeacherOpen(false); setShowSolution(false); setError(''); };
  const toggleSmartboard = async () => {
    if (smartboard) {
      setSmartboard(false);
      if (document.fullscreenElement === surfaceRef.current) await document.exitFullscreen?.();
    } else {
      setSmartboard(true);
      try { await surfaceRef.current?.requestFullscreen?.(); } catch { /* CSS immersive fallback for iPad/iPhone. */ }
    }
  };
  return createPortal(<div className="lm-hangman-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={surfaceRef} className={`lm-hangman${smartboard || nativeFullscreen ? ' is-smartboard' : ''}`} role="dialog" aria-modal="true" aria-labelledby="lm-hangman-title">
      <header className="lm-hangman-header">
        <div><span className="lm-hangman-eyebrow">Unterrichtstool</span><h2 id="lm-hangman-title">Hangman</h2></div>
        <div className="lm-hangman-header-actions">
          <button type="button" onClick={toggleSmartboard} aria-pressed={smartboard}>🖥️ <span>{smartboard ? 'Smartboard beenden' : 'Smartboard-Modus'}</span></button>
          <button type="button" onClick={close} aria-label="Hangman schließen" title="Schließen">×</button>
        </div>
      </header>
      {!word ? <form className="lm-hangman-setup" onSubmit={start}>
        <p>Begriff eingeben, Spiel starten und gemeinsam Buchstaben raten.</p>
        <label>Lösungswort<input ref={wordInputRef} type={showInput ? 'text' : 'password'} autoComplete="off" spellCheck="false" value={draft} onChange={(event) => { setDraft(event.target.value); setError(''); }} placeholder="Zum Beispiel COMPUTER" maxLength={80} /></label>
        <label className="lm-hangman-checkbox"><input type="checkbox" checked={showInput} onChange={(event) => setShowInput(event.target.checked)} /> Wort während der Eingabe anzeigen</label>
        <label>Hinweis / Kategorie (optional)<input type="text" value={hint} onChange={(event) => setHint(event.target.value)} placeholder="Zum Beispiel Hardware" maxLength={120} /></label>
        <div className="lm-hangman-options">
          <label>Darstellung<select value={displayMode} onChange={(event) => setDisplayMode(event.target.value)}><option value="classic">Klassisches Hangman</option><option value="neutral">Neutraler Fortschritt</option></select></label>
          <label>Maximale Fehler<input type="number" min="4" max="10" value={maxErrors} onChange={(event) => setMaxErrors(Math.min(10, Math.max(4, Number(event.target.value) || 8)))} /></label>
        </div>
        {error && <p className="lm-hangman-error" role="alert">{error}</p>}
        <button className="lm-hangman-primary" type="submit">Spiel starten</button>
      </form> : <div className="lm-hangman-game">
        <div className="lm-hangman-game-top">
          <div className={`lm-hangman-visual${displayMode === 'classic' ? ' is-classic' : ''}`} aria-label={`${status.errors} von ${maxErrors} Fehlern`}>
            {displayMode === 'classic' ? <><svg viewBox="0 0 200 210" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">{DRAWING.slice(0, visibleStages).map((part, index) => <g key={part.id} className={`lm-hangman-stage is-${part.kind}${index >= newlyDrawnFrom ? ' is-new' : ''}`} style={{ '--stage-delay': `${(index - newlyDrawnFrom) * 160}ms` }}>{part.shape}</g>)}</svg><span className="lm-hangman-stage-caption">Schritt {status.errors} von {maxErrors}</span></> : <><span aria-hidden="true" className="lm-hangman-neutral-icon">✦</span><strong>{maxErrors - status.errors}</strong><span>Versuche übrig</span><div className="lm-hangman-progress" aria-hidden="true">{Array.from({ length: maxErrors }, (_, index) => <i key={index} className={index < maxErrors - status.errors ? 'is-left' : ''} />)}</div></>}
            {status.errors > 0 && <span key={status.errors} className="lm-hangman-miss-flash" aria-hidden="true" />}
          </div>
          <div className="lm-hangman-answer">
            {hint && <p className="lm-hangman-hint">{showHint ? `💡 ${hint}` : 'Ein Hinweis ist verfügbar'}</p>}
            <div className="lm-hangman-word" aria-label={finished || showSolution ? `Lösungswort: ${word}` : 'Verdecktes Lösungswort'}>{[...word].map((letter, index) => <span key={index} className={letter === ' ' ? 'is-space' : "'-".includes(letter) ? 'is-punctuation' : ''}>{' -\''.includes(letter) || guesses.includes(letter) || finished || showSolution ? letter : ' '}</span>)}</div>
            <p className="lm-hangman-count" aria-live="polite">Fehler: {status.errors} / {maxErrors}</p>
            <p className="lm-hangman-used">Bereits verwendet: {guesses.length ? guesses.join(' · ') : '–'}</p>
          </div>
        </div>
        {finished && <div className="lm-hangman-result" role="status"><strong>{status.won ? '🎉 Richtig!' : 'Leider nicht geschafft.'}</strong><span>Das Wort war: {word}</span><span>Fehler: {status.errors}</span><div><button type="button" className="lm-hangman-primary" onClick={newWord}>Nächstes Wort eingeben</button><button type="button" onClick={reset}>Noch einmal</button><button type="button" onClick={close}>Zurück zu LehrerMaps</button></div></div>}
        {!finished && <div className="lm-hangman-keyboard" aria-label="Buchstaben wählen">{HANGMAN_LETTERS.map((letter) => { const used = guesses.includes(letter); const correct = word.includes(letter); return <button type="button" key={letter} disabled={used} onClick={() => submitGuess(letter)} className={used ? correct ? 'is-correct' : 'is-wrong' : ''} aria-label={`${letter}${used ? correct ? ', richtig' : ', falsch' : ''}`}>{letter}{used && <small aria-hidden="true">{correct ? '✓' : '✕'}</small>}</button>; })}</div>}
        <div className="lm-hangman-teacher">
          <button type="button" aria-expanded={teacherOpen} onClick={() => setTeacherOpen((value) => !value)}>⚙️ Lehrer</button>
          {teacherOpen && <div className="lm-hangman-teacher-panel">
            {hint && <button type="button" onClick={() => setShowHint((value) => !value)}>{showHint ? 'Hinweis verbergen' : 'Hinweis zeigen'}</button>}
            <button type="button" onClick={() => setShowSolution((value) => !value)}>{showSolution ? 'Lösung verbergen' : 'Lösung anzeigen'}</button>
            <label>Maximale Fehler <input type="number" min="4" max="10" value={maxErrors} onChange={(event) => setMaxErrors(Math.min(10, Math.max(4, Number(event.target.value) || 8)))} /></label>
            <button type="button" onClick={reset}>Spiel neu starten</button><button type="button" onClick={newWord}>Neues Wort eingeben</button>
          </div>}
        </div>
      </div>}
    </section>
  </div>, document.body);
}
