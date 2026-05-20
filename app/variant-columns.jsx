// Variante 2 — "Drei-Spalten": Finder/Miller-Columns-Stil.
// Fächer | Gruppen | Ordner | Dateien — rechts Preview.
// Klassisch, vertraut, sehr schnell zum Drill-Down.

function VariantColumns({ activeSubjectId = 'spanisch', dark = false, previewFile }) {
  const t = ThemeFor(dark);
  const subject = SUBJECTS.find(s => s.id === activeSubjectId) || SUBJECTS[0];
  const activeGroup = subject.groups[0];
  const activeFolder = activeGroup.folders[0];
  const pf = previewFile || activeFolder.files[0];

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: t.bg, color: t.text, fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
      {/* Toolbar */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
        borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <ToolButton dark={dark}>‹</ToolButton>
          <ToolButton dark={dark}>›</ToolButton>
        </div>
        <div style={{ width: 1, height: 22, background: t.border, margin: '0 4px' }} />
        <Breadcrumb items={[subject.name, activeGroup.name, activeFolder.name, pf?.name]} accent={subject.color} dark={dark} />
        <div style={{ flex: 1 }} />
        <SearchBar dark={dark} placeholder="Alle Fächer durchsuchen..." />
        <button style={{
          height: 30, padding: '0 12px', border: 'none', borderRadius: 7,
          background: subject.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>＋ Neu</button>
      </div>

      {/* Columns */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Column dark={dark} width={180} title="Fächer">
          {SUBJECTS.map(s => (
            <ColumnRow key={s.id} active={s.id === subject.id} accent={s.color} dark={dark}>
              <span style={{
                width: 18, height: 18, borderRadius: 5, background: s.color,
                color: '#fff', fontSize: 9, fontWeight: 700, fontFamily: '"DM Mono", monospace',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{s.short}</span>
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ color: t.subtle, fontSize: 11 }}>›</span>
            </ColumnRow>
          ))}
        </Column>

        <Column dark={dark} width={200} title="Gruppen">
          {subject.groups.map(g => (
            <ColumnRow key={g.id} active={g.id === activeGroup.id} accent={subject.color} dark={dark}>
              <FolderIcon color={subject.color} size={14} />
              <span style={{ flex: 1 }}>{g.name}</span>
              <span style={{ color: t.subtle, fontSize: 10, fontFamily: '"DM Mono", monospace' }}>{g.folders.length}</span>
              <span style={{ color: t.subtle, fontSize: 11 }}>›</span>
            </ColumnRow>
          ))}
        </Column>

        <Column dark={dark} width={220} title="Ordner">
          {activeGroup.folders.map(f => (
            <ColumnRow key={f.id} active={f.id === activeFolder.id} accent={subject.color} dark={dark}>
              <FolderIcon color={f.id === activeFolder.id ? subject.color : (dark ? '#555' : '#C7CACF')} size={14} />
              <span style={{ flex: 1 }}>{f.name}</span>
              <span style={{ color: t.subtle, fontSize: 10, fontFamily: '"DM Mono", monospace' }}>{f.files.length}</span>
            </ColumnRow>
          ))}
        </Column>

        <Column dark={dark} width="flex" title={`Dateien (${activeFolder.files.length})`}>
          {activeFolder.files.map((f, i) => (
            <div key={i} style={{
              padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
              background: pf?.name === f.name ? (dark ? `${subject.color}22` : `${subject.color}11`) : 'transparent',
              cursor: 'pointer',
              borderLeft: pf?.name === f.name ? `3px solid ${subject.color}` : '3px solid transparent',
            }}>
              <FileBadge kind={f.kind} size={24} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: pf?.name === f.name ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                <div style={{ fontSize: 10.5, color: t.subtle, marginTop: 2, fontFamily: '"DM Mono", monospace' }}>{f.size} · {f.date}</div>
              </div>
            </div>
          ))}
          <div style={{ padding: 12, color: t.subtle, fontSize: 11, textAlign: 'center', borderTop: `1px dashed ${t.border}`, marginTop: 8 }}>
            Datei hierher ziehen, um hochzuladen
          </div>
        </Column>

        <div style={{ width: 320, flexShrink: 0 }}>
          <FilePreview file={pf} accent={subject.color} dark={dark} />
        </div>
      </div>
    </div>
  );
}

function Column({ width = 200, title, dark, children }) {
  const t = ThemeFor(dark);
  return (
    <div style={{
      width: width === 'flex' ? 'auto' : width,
      flex: width === 'flex' ? '1 1 0' : '0 0 auto',
      minWidth: 0,
      borderRight: `1px solid ${t.border}`,
      background: t.sidebar,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '10px 12px 8px', fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
        textTransform: 'uppercase', color: t.subtle,
        borderBottom: `1px solid ${t.border}`,
      }}>{title}</div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  );
}

function ColumnRow({ active, accent, dark, children }) {
  const t = ThemeFor(dark);
  return (
    <div style={{
      padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8,
      background: active ? (dark ? `${accent}22` : `${accent}14`) : 'transparent',
      cursor: 'pointer', fontSize: 13,
      color: active ? t.text : t.muted, fontWeight: active ? 600 : 400,
      borderLeft: active ? `3px solid ${accent}` : '3px solid transparent',
    }}>
      {children}
    </div>
  );
}

function ToolButton({ children, dark }) {
  return (
    <button style={{
      width: 26, height: 26, border: 'none', borderRadius: 5,
      background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
      color: dark ? '#aaa' : '#6B7280',
      fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  );
}

Object.assign(window, { VariantColumns });
