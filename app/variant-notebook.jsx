// Variante 1 — "Notizbuch": Fach-Reiter oben (farbige Spines),
// links Ordner-Sidebar, Mitte Dashboard mit Recents, rechts Datei-Vorschau.
// Inspiriert vom Notizbuch-Gefühl, aber eigenständige Optik.

function VariantNotebook({ activeSubjectId = 'spanisch', dark = false, previewFile }) {
  const t = ThemeFor(dark);
  const subject = SUBJECTS.find(s => s.id === activeSubjectId) || SUBJECTS[0];
  const stats = subjectStats(subject);
  const recent = recentFiles(subject, 6);
  const pf = previewFile || recent[0];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: t.bg, color: t.text, fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
      {/* Reiter-Zeile */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 2, padding: '10px 16px 0',
        background: dark ? '#0a0a0c' : '#EEF0F4',
        borderBottom: `1px solid ${t.border}`, flexShrink: 0,
      }}>
        {SUBJECTS.map(s => {
          const on = s.id === subject.id;
          return (
            <div key={s.id} style={{
              padding: '10px 16px 12px', position: 'relative',
              background: on ? t.surface : 'transparent',
              borderRadius: '8px 8px 0 0',
              borderTop: on ? `3px solid ${s.color}` : '3px solid transparent',
              borderLeft: on ? `1px solid ${t.border}` : 'none',
              borderRight: on ? `1px solid ${t.border}` : 'none',
              marginBottom: on ? -1 : 0,
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2, background: s.color,
                opacity: on ? 1 : 0.5,
              }} />
              <span style={{
                fontSize: 13, fontWeight: on ? 600 : 500,
                color: on ? t.text : t.muted,
              }}>{s.name}</span>
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '6px 0 10px' }}>
          <SearchBar dark={dark} placeholder="In Spanisch suchen..." />
        </div>
        <div style={{ padding: '6px 0 10px 8px' }}>
          <button style={{
            height: 30, padding: '0 14px', border: 'none', borderRadius: 7,
            background: subject.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>＋</span> Hochladen
          </button>
        </div>
      </div>

      {/* Inhalt */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Sidebar */}
        <div style={{
          width: 220, background: t.sidebar, borderRight: `1px solid ${t.border}`,
          padding: '14px 0', overflow: 'auto', flexShrink: 0,
        }}>
          {subject.groups.map(g => (
            <div key={g.id} style={{ marginBottom: 14 }}>
              <div style={{
                padding: '0 16px 6px', fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
                textTransform: 'uppercase', color: t.subtle,
              }}>{g.name}</div>
              {g.folders.map((f, i) => {
                const on = i === 0 && g.id === subject.groups[0].id;
                return (
                  <div key={f.id} style={{
                    padding: '6px 14px 6px 16px', display: 'flex', alignItems: 'center', gap: 9,
                    background: on ? (dark ? `${subject.color}22` : `${subject.color}11`) : 'transparent',
                    borderLeft: on ? `3px solid ${subject.color}` : '3px solid transparent',
                    cursor: 'pointer',
                    fontSize: 13, color: on ? t.text : t.muted, fontWeight: on ? 600 : 400,
                  }}>
                    <FolderIcon color={on ? subject.color : (dark ? '#555' : '#C7CACF')} size={16} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                    <span style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.files.length}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '20px 24px' }}>
          <Breadcrumb items={[subject.name, subject.groups[0].name, subject.groups[0].folders[0].name]} accent={subject.color} dark={dark} />
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '10px 0 4px', letterSpacing: -0.3 }}>
            {subject.name}
          </h1>
          <div style={{ fontSize: 12, color: t.muted, marginBottom: 22 }}>
            {stats.groupCount} Gruppen · {stats.folderCount} Ordner · {stats.fileCount} Dateien
          </div>

          {/* Quick-Ordner als Karten */}
          <SectionLabel dark={dark}>Ordner in „{subject.groups[0].name}"</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}>
            {subject.groups[0].folders.map(f => (
              <div key={f.id} style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
                padding: 12, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <FolderIcon color={subject.color} size={28} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{f.name}</div>
                  <div style={{ fontSize: 10.5, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.files.length} Datei{f.files.length !== 1 ? 'en' : ''}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Zuletzt geöffnet */}
          <SectionLabel dark={dark}>Zuletzt bearbeitet</SectionLabel>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {recent.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderBottom: i < recent.length - 1 ? `1px solid ${t.border}` : 'none',
                background: pf && f.name === pf.name ? (dark ? `${subject.color}22` : `${subject.color}11`) : 'transparent',
                cursor: 'pointer',
              }}>
                <FileBadge kind={f.kind} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{f.group} · {f.folder}</div>
                </div>
                <div style={{ fontSize: 11, color: t.subtle, fontFamily: '"DM Mono", monospace', whiteSpace: 'nowrap' }}>{f.size}</div>
                <div style={{ fontSize: 11, color: t.subtle, fontFamily: '"DM Mono", monospace', minWidth: 50, textAlign: 'right' }}>{f.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{ width: 320, flexShrink: 0 }}>
          <FilePreview file={pf} accent={subject.color} dark={dark} />
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, dark }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
      textTransform: 'uppercase', color: dark ? '#9a9aa0' : '#6B7280',
      marginBottom: 10,
    }}>{children}</div>
  );
}

Object.assign(window, { VariantNotebook });
