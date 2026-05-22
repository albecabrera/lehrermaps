import { useState } from 'react';
import { SUBJECTS } from '../constants/structure';
import { useLang } from '../contexts/LangContext';

const WORKSHEET_TYPES = [
  { id: 'gemischt', label: 'Gemischt / Mixto' },
  { id: 'exercises', label: 'Offene Aufgaben' },
  { id: 'lueckentext', label: 'Lückentext' },
  { id: 'multiple', label: 'Multiple Choice' },
  { id: 'aufsatz', label: 'Schreibaufgabe / Aufsatz' },
];

function MarkdownPreview({ content }) {
  const lines = content.split('\n');
  return (
    <div style={{ fontFamily: 'inherit', fontSize: 13, lineHeight: 1.7, color: 'var(--c-text)' }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return <h1 key={i} style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--c-text)' }}>{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} style={{ fontSize: 14, fontWeight: 700, margin: '14px 0 4px', color: 'var(--c-text)' }}>{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} style={{ fontSize: 13, fontWeight: 700, margin: '12px 0 4px', color: 'var(--c-text)' }}>{line.slice(4)}</h3>;
        }
        if (/^-{3,}$/.test(line.trim())) {
          return <hr key={i} style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '10px 0' }} />;
        }
        if (line.trim() === '') {
          return <div key={i} style={{ height: 6 }} />;
        }
        const rendered = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/_([^_]+)_/g, '<em>$1</em>');
        return <p key={i} style={{ margin: '2px 0' }} dangerouslySetInnerHTML={{ __html: rendered }} />;
      })}
    </div>
  );
}

export default function WorksheetGenerator({ onClose }) {
  const { t } = useLang();

  const [subject, setSubject] = useState(SUBJECTS[0].id);
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('');
  const [worksheetType, setWorksheetType] = useState('gemischt');
  const [exerciseCount, setExerciseCount] = useState(5);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [lang, setLang] = useState('de');

  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'preview'
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(null); // 'docx' | 'pdf' | null

  const selectedSubject = SUBJECTS.find((s) => s.id === subject) || SUBJECTS[0];

  const handleGenerate = async () => {
    if (!topic.trim()) { setError('Bitte Thema eingeben.'); return; }
    setError('');
    setStep('loading');
    try {
      const token = localStorage.getItem('lm_token');
      const res = await fetch('/api/ai/worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: selectedSubject.name, topic, grade, worksheetType, exerciseCount, lang, extraInstructions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setContent(data.content || '');
      setStep('preview');
    } catch (e) {
      setError(e.message);
      setStep('form');
    }
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const token = localStorage.getItem('lm_token');
      const res = await fetch('/api/ai/worksheet/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, format, subject: selectedSubject.name, topic }),
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

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
    border: '1px solid var(--c-border)', background: 'var(--c-surface-2)',
    color: 'var(--c-text)', fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle = (accent, disabled) => ({
    padding: '9px 18px', borderRadius: 8, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
    background: disabled ? 'var(--c-surface-2)' : accent,
    color: disabled ? 'var(--c-text-3)' : '#fff',
    opacity: disabled ? 0.6 : 1, transition: 'opacity .15s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: step === 'preview' ? 'min(900px, 96vw)' : 'min(520px, 96vw)',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        transition: 'width .3s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--c-text)' }}>Arbeitsblatt-Generator</div>
            <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 2 }}>KI-generiert · druckfertig</div>
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
              <div style={{ width: 32, height: 32, border: `3px solid ${selectedSubject.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 13 }}>Arbeitsblatt wird generiert…</div>
            </div>
          )}

          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>FACH</label>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle}>
                    {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>SPRACHE</label>
                  <select value={lang} onChange={(e) => setLang(e.target.value)} style={inputStyle}>
                    <option value="de">Deutsch</option>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>THEMA *</label>
                <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z.B. El pretérito indefinido, Pythagoras, Fotosynthese…" style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>KLASSE / NIVEAU</label>
                  <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="z.B. Klasse 9, B1, Grundkurs" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>ANZAHL AUFGABEN</label>
                  <input type="number" min={2} max={15} value={exerciseCount} onChange={(e) => setExerciseCount(Number(e.target.value))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>AUFGABENTYP</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {WORKSHEET_TYPES.map((wt) => (
                    <button key={wt.id} onClick={() => setWorksheetType(wt.id)} style={{
                      padding: '5px 11px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                      border: `1px solid ${worksheetType === wt.id ? selectedSubject.color : 'var(--c-border)'}`,
                      background: worksheetType === wt.id ? selectedSubject.color + '22' : 'transparent',
                      color: worksheetType === wt.id ? selectedSubject.color : 'var(--c-text-2)',
                      fontWeight: worksheetType === wt.id ? 600 : 400,
                    }}>{wt.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-2)', display: 'block', marginBottom: 5 }}>ZUSÄTZLICHE HINWEISE (optional)</label>
                <textarea value={extraInstructions} onChange={(e) => setExtraInstructions(e.target.value)} placeholder="z.B. Schwierigkeitsgrad erhöhen, bestimmte Vokabeln einbauen…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {error && <div style={{ fontSize: 12, color: '#E8472A', padding: '8px 12px', background: 'rgba(232,71,42,0.08)', borderRadius: 7 }}>{error}</div>}
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
            <button onClick={handleGenerate} disabled={!topic.trim()} style={btnStyle(selectedSubject.color, !topic.trim())}>
              ✦ Generieren
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => handleExport('docx')} disabled={!!exporting} style={btnStyle('#2563EB', !!exporting)}>
                {exporting === 'docx' ? '…' : '↓ DOCX'}
              </button>
              <button onClick={() => handleExport('pdf')} disabled={!!exporting} style={btnStyle(selectedSubject.color, !!exporting)}>
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
