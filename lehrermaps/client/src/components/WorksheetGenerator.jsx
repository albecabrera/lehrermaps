import { useState, useRef } from 'react';
import { SUBJECTS } from '../constants/structure';

function MarkdownPreview({ content }) {
  const lines = content.split('\n');
  return (
    <div style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: 'var(--c-text)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <h1 key={i} style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--c-text)' }}>{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 4px', color: 'var(--c-text)' }}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 4px', color: 'var(--c-text)' }}>{line.slice(4)}</h3>;
        if (/^-{3,}$/.test(line.trim())) return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '10px 0' }} />;
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
        const rendered = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>');
        return <p key={i} style={{ margin: '2px 0' }} dangerouslySetInnerHTML={{ __html: rendered }} />;
      })}
    </div>
  );
}

export default function WorksheetGenerator({ onClose }) {
  const [prompt, setPrompt] = useState(`Erstelle ein Arbeitsblatt als .docx und .pdf für:

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
5. Ausgabe: .docx und .pdf`);
  const [lang, setLang] = useState('de');
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'preview'
  const [content, setContent] = useState('');
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null);
  const abortRef = useRef(null);

  const accentColor = SUBJECTS[0]?.color || '#6c47ff';

  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('Bitte Beschreibung eingeben.'); return; }
    setError('');
    setStep('loading');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const token = localStorage.getItem('lm_token');
      const res = await fetch('/api/ai/worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: prompt.trim(), lang }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler beim Generieren');
      setContent(data.content || '');
      setProvider(data.provider || null);
      setStep('preview');
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
        body: JSON.stringify({ content, format, subject: '', topic: '' }),
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

  const providerLabel = provider === 'claude-cli'
    ? '✦ Claude Code Pro · druckfertig'
    : provider === 'claude'
      ? '✦ Claude · Websuche · druckfertig'
      : provider === 'openai'
        ? '✦ OpenAI · druckfertig'
        : 'KI-generiert · druckfertig';

  const btnStyle = (bg, disabled) => ({
    padding: '9px 18px', borderRadius: 8, border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
    background: disabled ? 'var(--c-surface-2)' : bg,
    color: disabled ? 'var(--c-text-3)' : '#fff',
    opacity: disabled ? 0.6 : 1, transition: 'opacity .15s',
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: step === 'preview' ? 'min(900px, 96vw)' : 'min(540px, 96vw)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)', transition: 'width .3s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--c-text)' }}>Arbeitsblatt-Generator</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 2 }}>
              {step === 'preview' ? providerLabel : 'KI-generiert · druckfertig'}
            </div>
          </div>
          {step === 'preview' && (
            <button onClick={() => setStep('form')} style={{ ...btnStyle('var(--c-surface-2)', false), color: 'var(--c-text-2)', fontSize: 12, padding: '6px 12px' }}>
              ← Bearbeiten
            </button>
          )}
          <button onClick={onClose} style={{ width: 28, height: 28, border: '1px solid var(--c-border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', color: 'var(--c-text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {step === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '60px 0', color: 'var(--c-text-2)' }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13 }}>Arbeitsblatt wird generiert…</div>
              <button onClick={handleCancel} style={{ fontSize: 12, color: 'var(--c-text-3)', background: 'transparent', border: '1px solid var(--c-border)', borderRadius: 7, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Abbrechen
              </button>
            </div>
          )}

          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>AUSGABESPRACHE</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 7, fontSize: 13, border: '1px solid var(--c-border)', background: 'var(--c-surface-2)', color: 'var(--c-text)', fontFamily: 'inherit', outline: 'none' }}
                >
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5, letterSpacing: 0.4 }}>BESCHREIBE DAS ARBEITSBLATT *</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="z.B. Erstelle ein Arbeitsblatt über den Konjunktiv II für Klasse 10, mit 5 Übungen — 2 Lückentexte, 2 Multiple Choice und 1 Schreibaufgabe. Niveau B1."
                  rows={18}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 7, fontSize: 13,
                    border: '1px solid var(--c-border)', background: 'var(--c-surface-2)',
                    color: 'var(--c-text)', fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
                  }}
                />
                <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 5 }}>
                  Tipp: Fach, Klasse/Niveau, Aufgabentypen und Anzahl im Prompt angeben. ⌘+Enter zum Generieren.
                </div>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#E8472A', padding: '8px 12px', background: 'rgba(232,71,42,0.08)', borderRadius: 7 }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div style={{ background: 'var(--c-surface-2)', borderRadius: 10, padding: '24px 28px', minHeight: 300 }}>
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          {step === 'form' && (
            <button onClick={handleGenerate} disabled={!prompt.trim()} style={btnStyle(accentColor, !prompt.trim())}>
              ✦ Generieren
            </button>
          )}
          {step === 'preview' && (
            <>
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
