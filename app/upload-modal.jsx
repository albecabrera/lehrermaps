// Upload-Modal + Datei-Aktionsmenü
// ─────────────────────────────────────────────────────────────
// Drei Modi: Datei hochladen · Link hinzufügen · QR-Code erzeugen.
// Zeigt alle unterstützten Dateitypen (aus data.js SUPPORTED_TYPES)
// gruppiert und farbig an. Drag&Drop-Zone reagiert visuell.

function UploadModal({ open, onClose, accent, dark, targetFolder }) {
  const t = ThemeFor(dark);
  const [mode, setMode] = React.useState('file');
  const [dragOver, setDragOver] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkName, setLinkName] = React.useState('');
  const [qrTarget, setQrTarget] = React.useState('https://lehrermaps.local/');

  React.useEffect(() => {
    if (open) { setMode('file'); setLinkUrl(''); setLinkName(''); setDragOver(false); }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);

  if (!open) return null;

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(15,15,18,0.55)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'lmFadeIn .15s ease-out',
      fontFamily: '"DM Sans", -apple-system, sans-serif',
    }}>
      <style>{`@keyframes lmFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes lmSlideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }`}</style>

      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 640, maxHeight: '90vh',
        background: dark ? '#1a1a1d' : '#fff', color: t.text,
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        animation: 'lmSlideUp .2s cubic-bezier(.4,.7,.3,1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>Hinzufügen</div>
            <div style={{ fontSize: 12, color: t.muted, marginTop: 3 }}>
              Ziel: <strong style={{ color: t.text }}>{targetFolder || 'Aktiver Ordner'}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, border: 'none', borderRadius: 7,
            background: 'transparent', color: t.muted, cursor: 'pointer',
            fontSize: 18, lineHeight: 1, fontFamily: 'inherit',
          }}
            onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>×</button>
        </div>

        {/* Tabs */}
        <div style={{
          padding: '14px 22px 0', display: 'flex', gap: 2,
          borderBottom: `1px solid ${t.border}`, marginTop: 6,
        }}>
          {[
            { id: 'file', label: 'Datei hochladen', icon: <path d="M3 11v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M9 3v8M5 7l4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/> },
            { id: 'link', label: 'Externer Link', icon: <path d="M7 11l4-4M5 8L3 10a3 3 0 0 0 4 4l2-2M9 6l2-2a3 3 0 0 1 4 4l-2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/> },
            { id: 'qr',   label: 'QR-Code erzeugen', icon: <><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="11" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="11" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11h2v2M14 14h2M11 14v2h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setMode(tab.id)} style={{
              appearance: 'none', border: 'none', fontFamily: 'inherit',
              padding: '10px 14px 12px', background: 'transparent', cursor: 'pointer',
              fontSize: 12.5, fontWeight: mode === tab.id ? 600 : 500,
              color: mode === tab.id ? t.text : t.muted,
              borderBottom: mode === tab.id ? `2px solid ${accent}` : '2px solid transparent',
              marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ color: mode === tab.id ? accent : t.subtle }}>{tab.icon}</svg>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 22, overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {mode === 'file' && <UploadFileMode dragOver={dragOver} setDragOver={setDragOver} dark={dark} accent={accent} />}
          {mode === 'link' && <UploadLinkMode url={linkUrl} setUrl={setLinkUrl} name={linkName} setName={setLinkName} dark={dark} accent={accent} />}
          {mode === 'qr'   && <UploadQrMode target={qrTarget} setTarget={setQrTarget} dark={dark} accent={accent} />}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 22px', borderTop: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', gap: 10, background: dark ? '#222226' : '#FAFBFC',
        }}>
          <div style={{ fontSize: 11, color: t.subtle, flex: 1 }}>
            Max. 50 MB pro Datei · alle Daten bleiben lokal
          </div>
          <button onClick={onClose} style={{
            height: 32, padding: '0 14px', border: `1px solid ${t.border}`, borderRadius: 7,
            background: 'transparent', color: t.muted, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Abbrechen</button>
          <button onClick={onClose} style={{
            height: 32, padding: '0 16px', border: 'none', borderRadius: 7,
            background: accent, color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 2px 6px ${accent}40`,
          }}>{mode === 'file' ? 'Hochladen' : mode === 'link' ? 'Link speichern' : 'QR erstellen'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function UploadFileMode({ dragOver, setDragOver, dark, accent }) {
  const t = ThemeFor(dark);
  return (
    <div>
      {/* Drop-Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
        style={{
          border: `1.5px dashed ${dragOver ? accent : t.border}`,
          background: dragOver ? `${accent}11` : (dark ? 'rgba(255,255,255,0.02)' : '#FAFBFC'),
          borderRadius: 10, padding: '28px 16px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          textAlign: 'center', transition: 'all .15s',
        }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 14V4M6 9l5-5 5 5M3 16v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {dragOver ? 'Loslassen zum Hochladen' : 'Dateien hier ablegen'}
        </div>
        <div style={{ fontSize: 12, color: t.muted }}>
          oder <span style={{ color: accent, fontWeight: 600, cursor: 'pointer' }}>Dateien auswählen</span>
        </div>
      </div>

      {/* Typliste */}
      <div style={{ marginTop: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase',
          color: t.subtle, marginBottom: 10,
        }}>Unterstützte Formate</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {SUPPORTED_TYPES.map(grp => (
            <div key={grp.group} style={{
              border: `1px solid ${t.border}`, borderRadius: 8,
              padding: '10px 12px', background: dark ? 'rgba(255,255,255,0.02)' : '#fff',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{
                width: 26, height: 30, flexShrink: 0,
                background: fileKindColor(grp.kind), color: '#fff',
                borderRadius: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                fontFamily: '"DM Mono", monospace', fontSize: 8, fontWeight: 700,
                paddingBottom: 3, marginTop: 1,
              }}>{grp.exts[0].toUpperCase().slice(0, 4)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{grp.group}</div>
                <div style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace', lineHeight: 1.5 }}>
                  .{grp.exts.join(' .')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UploadLinkMode({ url, setUrl, name, setName, dark, accent }) {
  const t = ThemeFor(dark);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Anzeige-Name" dark={dark}>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="z. B. Quizlet 9b · Vokabeln Unidad 3"
          style={inputStyle(dark)} />
      </Field>
      <Field label="URL" dark={dark}>
        <input value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://…"
          style={{ ...inputStyle(dark), fontFamily: '"DM Mono", monospace' }} />
      </Field>
      <Field label="Tags (optional)" dark={dark}>
        <input placeholder="Hörverstehen, RTVE" style={inputStyle(dark)} />
      </Field>

      {/* Live-Preview */}
      {url && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase', color: t.subtle, marginBottom: 8 }}>Vorschau</div>
          <div style={{ maxHeight: 180 }}>
            <LinkPreview file={{ name: name || 'Externer Link.url', kind: 'link', url }} accent={accent} dark={dark} />
          </div>
        </div>
      )}
    </div>
  );
}

function UploadQrMode({ target, setTarget, dark, accent }) {
  const t = ThemeFor(dark);
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Ziel-URL" dark={dark}>
          <input value={target} onChange={e => setTarget(e.target.value)}
            placeholder="https://…"
            style={{ ...inputStyle(dark), fontFamily: '"DM Mono", monospace' }} />
        </Field>
        <Field label="Name" dark={dark}>
          <input defaultValue="QR_Stundenplan" style={inputStyle(dark)} />
        </Field>
        <Field label="Größe" dark={dark}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['S', 'M', 'L'].map((s, i) => (
              <button key={s} style={{
                flex: 1, height: 30, border: `1px solid ${t.border}`, borderRadius: 6,
                background: i === 1 ? accent : 'transparent',
                color: i === 1 ? '#fff' : t.muted, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{s}</button>
            ))}
          </div>
        </Field>
        <div style={{ fontSize: 11, color: t.muted, lineHeight: 1.5 }}>
          QR-Code wird als <code style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>.png</code> und <code style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6', padding: '1px 4px', borderRadius: 3 }}>.svg</code> abgelegt und kann direkt gedruckt werden.
        </div>
      </div>
      <div style={{ width: 180, flexShrink: 0 }}>
        <QrPreview file={{ name: 'preview.qr', kind: 'qr', url: target }} accent={accent} dark={dark} />
      </div>
    </div>
  );
}

function Field({ label, children, dark }) {
  const t = ThemeFor(dark);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
        textTransform: 'uppercase', color: t.subtle,
      }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle(dark) {
  const t = ThemeFor(dark);
  return {
    appearance: 'none', border: `1px solid ${t.border}`, borderRadius: 7,
    background: dark ? 'rgba(255,255,255,0.04)' : '#fff',
    color: t.text, padding: '8px 10px', fontSize: 12.5,
    fontFamily: '"DM Sans", -apple-system, sans-serif', outline: 'none',
  };
}

// ─────────────────────────────────────────────────────────────
// Datei-Aktionsmenü (über ⋯-Button oder rechte Maustaste)
// ─────────────────────────────────────────────────────────────

function FileMenu({ x, y, file, onClose, dark, accent }) {
  const t = ThemeFor(dark);
  React.useEffect(() => {
    const off = (e) => onClose();
    document.addEventListener('pointerdown', off, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); });
    return () => document.removeEventListener('pointerdown', off, true);
  }, [onClose]);

  if (!file) return null;
  const items = [
    { icon: '↗', label: 'Öffnen', shortcut: '⏎' },
    { icon: '✎', label: 'Umbenennen', shortcut: 'F2' },
    { icon: '⇆', label: 'Verschieben', shortcut: '⌘V' },
    { icon: '⎘', label: 'Duplizieren', shortcut: '⌘D' },
    { icon: '#', label: 'Tag hinzufügen' },
    { icon: '↓', label: 'Herunterladen' },
    { icon: '↗', label: 'Teilen' },
    { sep: true },
    { icon: '🗑', label: 'Löschen', danger: true, shortcut: '⌫' },
  ];

  return ReactDOM.createPortal(
    <div onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 1100,
        background: dark ? '#222226' : '#fff', color: t.text,
        borderRadius: 8, padding: 4, minWidth: 200,
        boxShadow: '0 12px 40px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.08)',
        fontFamily: '"DM Sans", -apple-system, sans-serif',
        animation: 'lmSlideUp .12s ease-out',
      }}>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${t.border}`, marginBottom: 4 }}>
        <FileBadge kind={file.kind} name={file.name} size={20} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
          <div style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{file.size}</div>
        </div>
      </div>
      {items.map((it, i) => it.sep ? (
        <hr key={i} style={{ border: 'none', borderTop: `1px solid ${t.border}`, margin: '4px 2px' }} />
      ) : (
        <button key={i} onClick={onClose} style={{
          appearance: 'none', border: 'none', width: '100%', textAlign: 'left',
          padding: '7px 10px', borderRadius: 5, background: 'transparent', cursor: 'pointer',
          font: 'inherit', fontSize: 12, color: it.danger ? '#DC2626' : t.text,
          display: 'flex', alignItems: 'center', gap: 10,
        }}
          onMouseEnter={e => e.currentTarget.style.background = it.danger ? 'rgba(220,38,38,0.08)' : (dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6')}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ width: 14, textAlign: 'center', opacity: 0.7, fontSize: 11 }}>{it.icon}</span>
          <span style={{ flex: 1 }}>{it.label}</span>
          {it.shortcut && <span style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{it.shortcut}</span>}
        </button>
      ))}
    </div>,
    document.body
  );
}

Object.assign(window, { UploadModal, FileMenu });
