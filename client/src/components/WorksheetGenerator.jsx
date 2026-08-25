import { useState, useRef, useEffect } from 'react';
import { SUBJECTS } from '../constants/structure';

const DEFAULT_PROMPT = `Erstelle ein Arbeitsblatt als .docx und .pdf für:

Fach: [FACH]
Klasse: [KLASSE]
Thema: [THEMA]

Aufgaben:
- [Aufgabe 1 – Typ angeben: Lückentext / Fehlerkorrektur / offene Frage / Übersetzung / etc.]
- [Aufgabe 2]
- [Aufgabe 3]

Links zum Selbstlernen (optional):
- [URL – Beschreibung]

Design-Vorgaben (nicht verhandelbar):
- Schwarz-Weiß: ausschließlich Schwarz, Grautöne und Weiß — keine Farben
- Schriftgröße: mindestens 12pt für alle Texte (Fließtext, Aufgaben, Tabellen)
- Schriftart: Calibri
- Sektionen klar abgetrennt durch Umrahmungen (Boxen mit Rahmen)
- Sektions-Header: schwarzer Hintergrund, weißer Text, fett
- Tabellen: abwechselnd Weiß / Hellgrau, keine Farben
- Kein Clipart, keine Icons, keine KI-Symbole
- Ausreichend Platz für handschriftliche Antworten (Linien oder Leerzeilen)

Pflichtstruktur:
1. Kopfzeile: Fach, Klasse, Thema, Felder für Name / Kurs / Datum
2. Grammatik- oder Inhaltsübersicht: Tabelle(n) je nach Thema
3. Aufgaben: nummeriert, mit ausreichend Platz für Antworten
4. Links zum Selbstlernen (falls angegeben)
5. Ausgabe: .docx und .pdf`;

const ESTIMATED_TOTAL_TOKENS = 1800;

function MarkdownPreview({ content }) {
  const lines = content.split('\n');
  return (
    <div style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: 'var(--c-text)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px' }}>{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 4px' }}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 4px' }}>{line.slice(4)}</h3>;
        if (/^-{3,}$/.test(line.trim())) return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '10px 0' }} />;
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        const rendered = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>');
        return <p key={i} style={{ margin: '2px 0' }} dangerouslySetInnerHTML={{ __html: rendered }} />;
      })}
    </div>
  );
}

function ProgressBar({ tokens, accent }) {
  const pct = Math.min(96, Math.round((tokens / ESTIMATED_TOTAL_TOKENS) * 100));
  return (
    <div style={{ width: '100%', height: 6, background: 'var(--c-surface-2)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: 99,
        background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
        width: `${pct}%`,
        transition: 'width .4s cubic-bezier(.4,.7,.3,1)',
        boxShadow: `0 0 8px ${accent}66`,
      }} />
    </div>
  );
}

export default function WorksheetGenerator({ onClose, onOpenTerminal, onSaveMaterial, initialSubject = 'spanisch', hasTargetFolder = false }) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const lang = 'de';
  const [meta, setMeta] = useState({
    subject: initialSubject,
    grade: '', curriculum: '', level: 'Gemischt', difficulty: 'Mittel',
    taskTypes: ['Offene Fragen', 'Lückentext'], differentiation: 'Ohne', lrs: false,
  });
  const [step, setStep] = useState('form');
  const [content, setContent] = useState('');
  const [streamText, setStreamText] = useState('');
  const [tokenCount, setTokenCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null);
  const abortRef = useRef(null);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const previewRef = useRef(null);

  const updateMeta = (key, value) => setMeta((prev) => ({ ...prev, [key]: value }));
  const toggleTaskType = (type) => setMeta((prev) => ({
    ...prev,
    taskTypes: prev.taskTypes.includes(type)
      ? prev.taskTypes.filter((item) => item !== type)
      : [...prev.taskTypes, type],
  }));
  const buildPrompt = () => {
    const subjectName = SUBJECTS.find((item) => item.id === meta.subject)?.name || meta.subject;
    const structured = [
      'Strukturvorgaben für das Arbeitsblatt:',
      `- Thema und Fach: ${subjectName}`,
      `- Klassenstufe: ${meta.grade || 'passend zur Beschreibung'}`,
      `- Lehrplanbezug: ${meta.curriculum || 'nicht angegeben'}`,
      `- Anforderungsbereich: ${meta.level}`,
      `- Schwierigkeitsgrad: ${meta.difficulty}`,
      `- Aufgabenformen: ${meta.taskTypes.join(', ') || 'frei wählen'}`,
      `- Differenzierung: ${meta.differentiation}`,
      `- LRS-freundliche Sprache: ${meta.lrs ? 'Ja' : 'Nein'}`,
      '',
      'Aufgabenbeschreibung:',
      prompt.trim(),
    ].join('\n');
    return structured;
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt());
      setError('Prompt kopiert. Du kannst ihn jetzt in ChatGPT Plus oder Codex einfügen.');
    } catch {
      setError('Prompt konnte nicht kopiert werden.');
    }
  };

  const accentColor = SUBJECTS[0]?.color || '#6c47ff';

  useEffect(() => {
    if (step === 'loading') {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [step]);

  // Auto-scroll live preview
  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [streamText]);

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('Bitte Beschreibung eingeben.'); return; }
    setError('');
    setStreamText('');
    setTokenCount(0);
    setElapsed(0);
    setStep('loading');
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const token = localStorage.getItem('lm_token');
      const res = await fetch('/api/ai/worksheet/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: buildPrompt(), lang }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              setStreamText((p) => p + data.text);
              setTokenCount(Math.round(data.chars / 4));
            } else if (data.type === 'done') {
              setContent(data.content);
              setStep('preview');
              return;
            } else if (data.type === 'error' || data.type === 'timeout') {
              throw new Error(data.message || 'Zeitüberschreitung.');
            }
          } catch (parseErr) {
            if (!(parseErr instanceof SyntaxError)) throw parseErr;
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e.message);
      setStep('form');
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStep('form');
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const token = localStorage.getItem('lm_token');
      const res = await fetch('/api/ai/worksheet/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, format, subject: meta.subject, topic: meta.curriculum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export-Fehler');
      const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = data.fileName; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(null);
    }
  };

  const btnStyle = (bg, disabled) => ({
    padding: '9px 18px', borderRadius: 8, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
    background: disabled ? 'var(--c-surface-2)' : bg,
    color: disabled ? 'var(--c-text-3)' : '#fff',
    opacity: disabled ? 0.6 : 1, transition: 'opacity .15s',
  });

  const remainingSec = tokenCount > 0
    ? Math.max(0, Math.round((ESTIMATED_TOTAL_TOKENS - tokenCount) / Math.max(1, tokenCount / Math.max(1, elapsed)) ))
    : null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && step !== 'loading' && onClose()}
    >
      <div style={{
        width: step === 'preview' ? 'min(900px, 96vw)' : step === 'loading' ? 'min(700px, 96vw)' : 'min(560px, 96vw)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)', transition: 'width .3s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--c-text)' }}>Arbeitsblatt-Generator</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 2 }}>
              {step === 'preview' ? '✦ Claude Code Pro · druckfertig' : step === 'loading' ? '✦ Generiere mit Claude Code Pro…' : 'KI-generiert · druckfertig'}
            </div>
          </div>
          {step === 'preview' && (
            <button onClick={() => setStep('form')} style={{ ...btnStyle('var(--c-surface-2)', false), color: 'var(--c-text-2)', fontSize: 12, padding: '6px 12px' }}>
              ← Bearbeiten
            </button>
          )}
          {step !== 'loading' && (
            <button onClick={onClose} style={{ width: 28, height: 28, border: '1px solid var(--c-border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div ref={step === 'loading' ? previewRef : null} style={{ flex: 1, overflow: 'auto', padding: 20 }}>

          {/* ── LOADING: streaming progress ── */}
          {step === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Stats row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 18, height: 18, border: `2.5px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>Generiere…</span>
                </div>
                <div style={{ display: 'flex', gap: 18, marginLeft: 'auto', flexWrap: 'wrap' }}>
                  <Stat label="Tokens" value={tokenCount.toLocaleString('de')} accent={accentColor} />
                  <Stat label="Laufzeit" value={`${elapsed}s`} accent={accentColor} />
                  {remainingSec !== null && remainingSec > 0 && (
                    <Stat label="ca. noch" value={`~${remainingSec}s`} accent={accentColor} />
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <ProgressBar tokens={tokenCount} accent={accentColor} />

              {/* Live markdown preview */}
              {streamText && (
                <div style={{ background: 'var(--c-surface-2)', borderRadius: 10, padding: '18px 22px', borderLeft: `3px solid ${accentColor}` }}>
                  <MarkdownPreview content={streamText} />
                </div>
              )}

              {!streamText && (
                <div style={{ color: 'var(--c-text-3)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  Warte auf Antwort vom Modell…
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleCancel} style={{ fontSize: 12, color: 'var(--c-text-3)', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* ── FORM ── */}
          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 12, border: '1px solid var(--c-border)', borderRadius: 10, background: 'var(--c-surface-2)' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--c-text-2)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>Struktur</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
                  <Field label="Thema und Fach">
                    <select value={meta.subject} onChange={(e) => updateMeta('subject', e.target.value)} style={fieldStyle}>
                      {SUBJECTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Klassenstufe">
                    <select value={meta.grade} onChange={(e) => updateMeta('grade', e.target.value)} style={fieldStyle}>
                      <option value="">Nicht angegeben</option>
                      {Array.from({ length: 13 }, (_, i) => <option key={i + 1}>{`${i + 1}. Klasse`}</option>)}
                    </select>
                  </Field>
                  <Field label="Lehrplanbezug">
                    <input value={meta.curriculum} onChange={(e) => updateMeta('curriculum', e.target.value)} placeholder="z.B. LB 3.2" style={fieldStyle} />
                  </Field>
                  <Field label="Anforderungsbereich">
                    <select value={meta.level} onChange={(e) => updateMeta('level', e.target.value)} style={fieldStyle}>
                      {['Gemischt', 'AB I · Reproduktion', 'AB II · Transfer', 'AB III · Reflexion'].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="Schwierigkeitsgrad">
                    <select value={meta.difficulty} onChange={(e) => updateMeta('difficulty', e.target.value)} style={fieldStyle}>
                      {['Einfach', 'Mittel', 'Schwer'].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field label="Differenzierung">
                    <select value={meta.differentiation} onChange={(e) => updateMeta('differentiation', e.target.value)} style={fieldStyle}>
                      {['Ohne', 'Basis · Standard · Experte', 'Scaffolding', 'Sprachsensibel / DaZ'].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['Offene Fragen', 'Lückentext', 'Multiple Choice', 'Zuordnung', 'Tabelle'].map((type) => (
                    <button key={type} onClick={() => toggleTaskType(type)} style={{ border: `1px solid ${meta.taskTypes.includes(type) ? accentColor : 'var(--c-border)'}`, borderRadius: 999, background: meta.taskTypes.includes(type) ? `${accentColor}18` : 'transparent', color: meta.taskTypes.includes(type) ? accentColor : 'var(--c-text-2)', padding: '5px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>{type}</button>
                  ))}
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--c-text-2)', padding: '0 5px' }}><input type="checkbox" checked={meta.lrs} onChange={(e) => updateMeta('lrs', e.target.checked)} /> LRS-freundlich</label>
                </div>
              </div>
              <div style={{ padding: '9px 11px', borderRadius: 8, border: '1px solid #2563EB33', background: '#2563EB0D', color: 'var(--c-text-2)', fontSize: 11, lineHeight: 1.5 }}>
                <strong style={{ color: '#2563EB' }}>Kostenloser Workflow:</strong> Prompt kopieren → in deinem ChatGPT-Plus-Konto oder Codex im Terminal ausführen → die fertige Datei anschließend in den gewählten LehrerMaps-Ordner hochladen.
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>BESCHREIBE DAS ARBEITSBLATT *</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={18}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13,
                    border: '1px solid var(--c-border)', background: 'var(--c-surface-2)',
                    color: 'var(--c-text)', fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const ta = e.target;
                      const text = ta.value;
                      const cursor = ta.selectionStart;
                      const regex = /\[[^\]]+\]/g;
                      const matches = [];
                      let m;
                      while ((m = regex.exec(text)) !== null) {
                        matches.push({ start: m.index, end: m.index + m[0].length });
                      }
                      if (!matches.length) return;
                      const next = matches.find((x) => x.start > cursor) || matches[0];
                      ta.setSelectionRange(next.start, next.end);
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 5 }}>
                  Tab springt zwischen [Platzhaltern]. ⌘+Enter zum Generieren.
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#E8472A', padding: '8px 12px', background: 'rgba(232,71,42,0.08)', borderRadius: 7 }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── PREVIEW ── */}
          {step === 'preview' && (
            <div style={{ background: 'var(--c-surface-2)', borderRadius: 10, padding: '24px 28px', minHeight: 300 }}>
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          {step === 'form' && (
            <>
              <button onClick={copyPrompt} disabled={!prompt.trim()} style={btnStyle('var(--c-text)', !prompt.trim())}>⌘ Prompt kopieren</button>
              <button onClick={async () => { const structuredPrompt = buildPrompt(); await copyPrompt(); onOpenTerminal?.(structuredPrompt); }} disabled={!prompt.trim()} style={btnStyle(accentColor, !prompt.trim())}>▣ Terminal öffnen</button>
              <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" style={{ ...btnStyle('transparent', false), color: 'var(--c-text-2)', border: '1px solid var(--c-border)', textDecoration: 'none' }}>↗ ChatGPT Plus</a>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={async () => { const saved = await onSaveMaterial?.({ name: meta.curriculum || 'Arbeitsblatt', content }); if (saved) onClose(); }} disabled={!hasTargetFolder || !onSaveMaterial} style={btnStyle('#16A34A', !hasTargetFolder || !onSaveMaterial)}>{hasTargetFolder ? '✓ Als Material speichern' : 'Ordner auswählen zum Speichern'}</button>
              <button onClick={() => handleExport('docx')} disabled={!!exporting} style={btnStyle('#2563EB', !!exporting)}>
                {exporting === 'docx' ? '…' : '↓ DOCX'}
              </button>
              <button onClick={() => handleExport('pdf')} disabled={!!exporting} style={btnStyle(accentColor, !!exporting)}>
                {exporting === 'pdf' ? '…' : '↓ PDF'}
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 56 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

const fieldStyle = {
  width: '100%', boxSizing: 'border-box', height: 32, padding: '0 8px',
  border: '1px solid var(--c-border)', borderRadius: 7,
  background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 12,
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--c-text-3)', letterSpacing: 0.3 }}>
      {label}
      {children}
    </label>
  );
}
