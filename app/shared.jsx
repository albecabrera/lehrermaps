// Geteilte UI-Bausteine: Dateibadges, Datei-Vorschau, Icons.

function FileBadge({ kind, name, size = 28 }) {
  const label = fileKindLabel(kind, name);
  const color = fileKindColor(kind);
  return (
    <div style={{
      width: size, height: size + 4, flexShrink: 0,
      background: color, color: '#fff',
      borderRadius: 4,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      paddingBottom: 3,
      fontFamily: '"DM Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: 8.5, fontWeight: 600, letterSpacing: 0.4,
      position: 'relative',
      boxShadow: `inset -3px 3px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.08)`,
    }}>
      <span style={{
        position: 'absolute', top: 0, right: 0, width: 8, height: 8,
        background: 'rgba(255,255,255,0.25)',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
      }} />
      {label}
    </div>
  );
}

function FolderIcon({ color = '#999', size = 24 }) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 24 20" fill="none">
      <path d="M0 4a2 2 0 0 1 2-2h7l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Z" fill={color} opacity="0.92"/>
      <path d="M0 6h24v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6Z" fill={color}/>
      <rect x="0" y="6" width="24" height="1" fill="rgba(255,255,255,0.35)"/>
    </svg>
  );
}

// Datei-Vorschau (rechtes Panel). Nimmt eine Datei oder zeigt einen Empty-State.
function FilePreview({ file, accent = '#E8472A', dark = false }) {
  const bg = dark ? '#1a1a1d' : '#fff';
  const fg = dark ? '#e8e8ea' : '#111827';
  const muted = dark ? '#9a9aa0' : '#6B7280';
  const border = dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';
  const surface = dark ? '#222226' : '#F8F9FB';

  if (!file) {
    return (
      <div style={{
        height: '100%', background: surface, borderLeft: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: muted, fontSize: 12, padding: 24, textAlign: 'center',
      }}>
        Wähle eine Datei aus,<br />um sie hier anzuzeigen
      </div>
    );
  }

  // Mock-Vorschau: PDF zeigt Seitenraster; Bilder zeigen Bildplatzhalter;
  // Video zeigt Player; Code zeigt Zeilen.
  return (
    <div style={{
      height: '100%', background: surface, borderLeft: `1px solid ${border}`,
      display: 'flex', flexDirection: 'column', color: fg,
    }}>
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${border}`, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <FileBadge kind={file.kind} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>
            {file.name}
          </div>
          <div style={{ fontSize: 11, color: muted, marginTop: 3, fontFamily: '"DM Mono", monospace' }}>
            {file.size} · {file.date}{file.folder && ` · ${file.folder}`}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
        <PreviewSurface file={file} accent={accent} dark={dark} />
      </div>

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${border}`, display: 'flex', gap: 8 }}>
        <button style={btnSec(dark)}>Öffnen</button>
        <button style={btnSec(dark)}>Teilen</button>
        <div style={{ flex: 1 }} />
        <button style={btnPri(accent)}>Download</button>
      </div>
    </div>
  );
}

function PreviewSurface({ file, accent, dark }) {
  const base = {
    height: '100%', borderRadius: 6, overflow: 'hidden',
    background: dark ? '#0f0f12' : '#fff',
    border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E5E7EB',
    position: 'relative',
  };

  if (file.kind === 'pdf' || file.kind === 'doc') {
    // Seitenmock mit Textlinien
    return (
      <div style={{ ...base, padding: 14 }}>
        <div style={{ height: 14, width: '60%', borderRadius: 3, background: accent, opacity: 0.85, marginBottom: 12 }} />
        {[92, 86, 78, 88, 70, 84, 60, 88, 76].map((w, i) => (
          <div key={i} style={{
            height: 6, width: `${w}%`, borderRadius: 2, marginBottom: 7,
            background: dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
          }} />
        ))}
        <div style={{ height: 50, marginTop: 12, borderRadius: 4, background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }} />
        {[80, 92, 64].map((w, i) => (
          <div key={i} style={{
            height: 6, width: `${w}%`, borderRadius: 2, marginTop: 7,
            background: dark ? 'rgba(255,255,255,0.12)' : '#E5E7EB',
          }} />
        ))}
      </div>
    );
  }
  if (file.kind === 'img') {
    return (
      <div style={{ ...base, background: `repeating-linear-gradient(45deg, ${accent}33 0 6px, ${accent}11 6px 12px)` }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: dark ? '#fff' : '#374151', fontFamily: '"DM Mono", monospace', fontSize: 11, opacity: 0.7 }}>
          Bild-Vorschau
        </div>
      </div>
    );
  }
  if (file.kind === 'mp4' || file.kind === 'video') {
    return (
      <div style={{ ...base, background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 3l12 7-12 7V3z" fill="#fff"/></svg>
        </div>
        <div style={{ width: '80%', height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '32%', background: accent, borderRadius: 2 }} />
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: '"DM Mono", monospace' }}>00:42 / 02:08</div>
      </div>
    );
  }
  if (file.kind === 'code') {
    const lines = ['for unidad in unidades:', '    test = Vokabeltest()', '    test.themen = unidad.wort', '    if test.bewertung() >', '        print("bestanden")', '    else:', '        nachholen.append(test)'];
    return (
      <div style={{ ...base, padding: 12, background: dark ? '#111114' : '#1F2937', color: '#e8e8ea', fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 10.5, lineHeight: 1.7 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#6B7280', width: 14, textAlign: 'right' }}>{i+1}</span>
            <span>{l}</span>
          </div>
        ))}
      </div>
    );
  }
  if (file.kind === 'sheet') {
    return (
      <div style={{ ...base, padding: 0 }}>
        {Array.from({length: 8}).map((_, r) => (
          <div key={r} style={{ display: 'flex', borderBottom: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0' }}>
            {Array.from({length: 4}).map((_, c) => (
              <div key={c} style={{
                flex: 1, padding: '6px 8px', fontSize: 10,
                background: r === 0 ? (dark ? 'rgba(255,255,255,0.05)' : '#F8F9FB') : 'transparent',
                color: r === 0 ? (dark ? '#fff' : '#111') : (dark ? '#bbb' : '#374151'),
                fontWeight: r === 0 ? 600 : 400,
                borderRight: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #F0F0F0',
                fontFamily: '"DM Mono", monospace',
              }}>
                {r === 0 ? ['Name','Klasse','Note','Ø'][c] : ['•••','9b', (1+Math.floor(r*0.6))+',0',''][c]}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return <div style={base} />;
}

function btnSec(dark) {
  return {
    height: 28, padding: '0 12px', border: 'none', borderRadius: 6,
    background: dark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
    color: dark ? '#e8e8ea' : '#374151', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}
function btnPri(accent) {
  return {
    height: 28, padding: '0 14px', border: 'none', borderRadius: 6,
    background: accent, color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
  };
}

// Generische Bausteine
function Breadcrumb({ items, accent = '#E8472A', dark = false }) {
  const muted = dark ? '#9a9aa0' : '#6B7280';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: muted, minWidth: 0 }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <span style={{
            color: i === items.length - 1 ? (dark ? '#fff' : '#111827') : muted,
            fontWeight: i === items.length - 1 ? 600 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{it}</span>
          {i < items.length - 1 && <span style={{ color: muted, opacity: 0.5 }}>›</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

function SearchBar({ accent = '#E8472A', dark = false, placeholder = 'Suchen...' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 30, padding: '0 10px', borderRadius: 7,
      background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
      border: dark ? '0.5px solid rgba(255,255,255,0.08)' : '0.5px solid #E5E7EB',
      fontSize: 12, color: dark ? '#aaa' : '#6B7280',
      minWidth: 180, flex: '1 1 220px', maxWidth: 320,
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <span>{placeholder}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, padding: '2px 5px', borderRadius: 3, background: dark ? 'rgba(255,255,255,0.06)' : '#fff', color: dark ? '#777' : '#9CA3AF' }}>⌘K</span>
    </div>
  );
}

function ThemeFor(dark) {
  return {
    bg:      dark ? '#0f0f12' : '#F8F9FB',
    surface: dark ? '#17171b' : '#FFFFFF',
    border:  dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
    text:    dark ? '#e8e8ea' : '#111827',
    muted:   dark ? '#9a9aa0' : '#6B7280',
    subtle:  dark ? '#6b6b72' : '#9CA3AF',
    sidebar: dark ? '#14141a' : '#FFFFFF',
    hover:   dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
  };
}

Object.assign(window, {
  FileBadge, FolderIcon, FilePreview, Breadcrumb, SearchBar, ThemeFor,
});
