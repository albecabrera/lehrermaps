// Variante 3 — "Atelier-Dashboard": Sidebar mit Fächern,
// Hauptbereich zeigt ALLE Fächer als große Karten mit Stats,
// Quick-Folders und Recents pro Fach. Eine echte Start-/Übersichtsseite.

function VariantDashboard({ activeSubjectId = 'spanisch', dark = false, previewFile }) {
  const t = ThemeFor(dark);
  const activeSubject = SUBJECTS.find(s => s.id === activeSubjectId) || SUBJECTS[0];
  // Vorschau ist eine Recent aus dem aktiven Fach
  const pf = previewFile || recentFiles(activeSubject, 1)[0];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: t.bg, color: t.text, fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
      {/* Sidebar */}
      <div style={{
        width: 200, background: t.sidebar, borderRight: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        <div style={{ padding: '18px 18px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: `linear-gradient(135deg, ${activeSubject.color}, ${activeSubject.colorDark})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: '"DM Mono", monospace',
            boxShadow: `0 4px 12px ${activeSubject.color}44`,
          }}>LM</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2 }}>LehrerMaps</div>
            <div style={{ fontSize: 10, color: t.subtle }}>SJ 2025/26</div>
          </div>
        </div>

        <div style={{ padding: '0 12px 8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 7,
            background: dark ? 'rgba(255,255,255,0.04)' : '#F3F4F6',
            fontSize: 12, color: t.muted, cursor: 'text',
          }}>
            <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Schnellsuche
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 9, color: t.subtle }}>⌘K</span>
          </div>
        </div>

        <NavLabel dark={dark}>Schnellzugriff</NavLabel>
        <NavRow dark={dark} icon="⌂">Start</NavRow>
        <NavRow dark={dark} icon="★">Favoriten</NavRow>
        <NavRow dark={dark} icon="↻">Zuletzt</NavRow>

        <NavLabel dark={dark}>Fächer</NavLabel>
        {SUBJECTS.map(s => (
          <NavRow key={s.id} dark={dark} accent={s.color} active={s.id === activeSubject.id}>
            <span style={{
              width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0,
            }} />
            <span style={{ flex: 1 }}>{s.name}</span>
            <span style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>
              {subjectStats(s).fileCount}
            </span>
          </NavRow>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ padding: 12, borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: t.text,
          }}>MS</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>M. Schmidt</div>
            <div style={{ fontSize: 10, color: t.subtle }}>Bonn · Beethoven-Gym.</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px 8px', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: t.muted, marginBottom: 6, fontFamily: '"DM Mono", monospace' }}>
              MONTAG · 20. APR 2026
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: -0.4 }}>
              Guten Morgen.
            </h1>
            <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>
              4 Fächer · {SUBJECTS.reduce((a, s) => a + subjectStats(s).fileCount, 0)} Dateien · Heute 3. Stunde 12c Spanisch
            </div>
          </div>
        </div>

        {/* Fach-Karten */}
        <div style={{ padding: '14px 28px 8px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {SUBJECTS.map(s => (
            <SubjectCard key={s.id} subject={s} dark={dark} active={s.id === activeSubject.id} />
          ))}
        </div>

        {/* Recents Tabelle */}
        <div style={{ padding: '8px 28px 24px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginTop: 14, marginBottom: 10,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Aktivität dieser Woche</div>
            <a style={{ fontSize: 12, color: activeSubject.color, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>
              Alle anzeigen →
            </a>
          </div>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {SUBJECTS.flatMap(s => recentFiles(s, 2).map(f => ({ ...f, subject: s }))).slice(0, 6).map((f, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
                borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
                background: pf && f.name === pf.name ? (dark ? `${f.subject.color}22` : `${f.subject.color}11`) : 'transparent',
                cursor: 'pointer',
              }}>
                <FileBadge kind={f.kind} size={22} />
                <span style={{
                  fontSize: 10, padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                  background: `${f.subject.color}22`, color: f.subject.color, fontWeight: 600,
                  fontFamily: '"DM Mono", monospace',
                }}>{f.subject.short}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize: 10.5, color: t.muted, marginTop: 1 }}>{f.group} · {f.folder}</div>
                </div>
                <div style={{ fontSize: 10.5, color: t.subtle, fontFamily: '"DM Mono", monospace', minWidth: 50, textAlign: 'right' }}>{f.date}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <FilePreview file={pf} accent={activeSubject.color} dark={dark} />
      </div>
    </div>
  );
}

function SubjectCard({ subject, dark, active }) {
  const t = ThemeFor(dark);
  const stats = subjectStats(subject);
  const recent = recentFiles(subject, 2);
  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${active ? subject.color : t.border}`,
      borderRadius: 12, padding: 14,
      position: 'relative', overflow: 'hidden',
      boxShadow: active ? `0 4px 16px ${subject.color}22` : 'none',
    }}>
      {/* Akzent-Stripe links */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 3, background: subject.color }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9,
          background: `linear-gradient(135deg, ${subject.color}, ${subject.colorDark})`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, fontFamily: '"DM Mono", monospace',
          letterSpacing: 0.2,
        }}>{subject.short}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2 }}>{subject.name}</div>
          <div style={{ fontSize: 11, color: t.muted, marginTop: 2, fontFamily: '"DM Mono", monospace' }}>
            {stats.groupCount} Gr · {stats.folderCount} Ord · {stats.fileCount} Datei
          </div>
        </div>
      </div>

      {/* Gruppen-Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {subject.groups.map(g => (
          <span key={g.id} style={{
            fontSize: 10.5, padding: '3px 8px', borderRadius: 999,
            background: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
            color: t.muted, fontWeight: 500,
          }}>{g.name}</span>
        ))}
      </div>

      {/* Letzte 2 Dateien */}
      <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 10, paddingTop: 10 }}>
        {recent.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 0', minWidth: 0 }}>
            <FileBadge kind={f.kind} size={18} />
            <span style={{ fontSize: 11.5, color: t.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
            <span style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavLabel({ children, dark }) {
  return (
    <div style={{
      padding: '14px 18px 6px', fontSize: 9.5, fontWeight: 600, letterSpacing: 0.7,
      textTransform: 'uppercase', color: dark ? '#6b6b72' : '#9CA3AF',
    }}>{children}</div>
  );
}

function NavRow({ children, dark, icon, active, accent }) {
  const t = ThemeFor(dark);
  return (
    <div style={{
      padding: '6px 12px', margin: '0 6px', borderRadius: 6,
      display: 'flex', alignItems: 'center', gap: 9,
      background: active ? (dark ? `${accent}22` : `${accent}14`) : 'transparent',
      color: active ? t.text : t.muted,
      fontWeight: active ? 600 : 400, fontSize: 12.5, cursor: 'pointer',
    }}>
      {icon && <span style={{ width: 14, textAlign: 'center', color: active ? (accent || t.text) : t.subtle }}>{icon}</span>}
      {children}
    </div>
  );
}

Object.assign(window, { VariantDashboard });
