// Variante A · Interaktiver, polierter Notizbuch-Prototyp.
// Vollständig stateful: Reiter, Sidebar-Ordner und Datei-Zeilen reagieren auf Klicks.
//
// Verbesserungen ggü. der statischen Vorschau:
//  • Animierter Tab-Indikator (gleitende Akzentlinie unter dem aktiven Fach)
//  • Sidebar einklappbar (Icon-Modus, animierte Breitenänderung)
//  • Verfeinerte Typo & Spacing-Skala (4/8/12/16/20/24)
//  • Hover-Feedback + Active-States in Akzentfarbe
//  • Bessere Datei-Vorschauen mit dateitypspezifischem Layout
//  • Suchfeld filtert in Echtzeit über die aktive Gruppe

function NotebookApp({ dark = false, density = 'comfy', initialCollapsed = false, initialSubject, initialFolder, initialFile }) {
  const t = ThemeFor(dark);
  const startSubject = SUBJECTS.find(s => s.id === initialSubject) || SUBJECTS[0];
  const startGroup = startSubject.groups.find(g => g.folders.some(f => f.id === initialFolder)) || startSubject.groups[0];
  const startFolder = startGroup.folders.find(f => f.id === initialFolder) || startGroup.folders[0];
  const startFile = startFolder.files.find(f => f.name === initialFile) || startFolder.files[0];

  const [subjectId, setSubjectId] = React.useState(startSubject.id);
  const [groupId, setGroupId] = React.useState(startGroup.id);
  const [folderId, setFolderId] = React.useState(startFolder.id);
  const [fileName, setFileName] = React.useState(startFile.name);
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const [query, setQuery] = React.useState('');
  const [showDashboard, setShowDashboard] = React.useState(false);
  const [hoverSubject, setHoverSubject] = React.useState(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [menuFile, setMenuFile] = React.useState(null);
  const [menuPos, setMenuPos] = React.useState({ x: 0, y: 0 });

  const subject = SUBJECTS.find(s => s.id === subjectId);
  const group = subject.groups.find(g => g.id === groupId) || subject.groups[0];
  const folder = group.folders.find(f => f.id === folderId) || group.folders[0];
  const file = folder.files.find(f => f.name === fileName) || folder.files[0];

  const onSubject = (id) => {
    setSubjectId(id);
    const s = SUBJECTS.find(x => x.id === id);
    setGroupId(s.groups[0].id);
    setFolderId(s.groups[0].folders[0].id);
    setFileName(s.groups[0].folders[0].files[0].name);
    setShowDashboard(false);
    setQuery('');
  };
  const onFolder = (gId, fId) => {
    setGroupId(gId);
    setFolderId(fId);
    const g = subject.groups.find(x => x.id === gId);
    const f = g.folders.find(x => x.id === fId);
    setFileName(f.files[0]?.name);
    setShowDashboard(false);
  };

  // Tab-Indikator-Position berechnen
  const tabRefs = React.useRef({});
  const [indicator, setIndicator] = React.useState({ left: 0, width: 0 });
  React.useLayoutEffect(() => {
    const el = tabRefs.current[subjectId];
    if (el) {
      setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [subjectId, collapsed]);

  const filteredFiles = query
    ? folder.files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : folder.files;

  return (
    <div data-screen-label={`A · ${subject.name} / ${folder.name}`}
      style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        background: t.bg, color: t.text,
        fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
        fontFeatureSettings: '"ss01", "cv11"',
      }}>

      {/* Tab-Reihe */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', padding: '8px 16px 0',
        background: dark ? '#0a0a0c' : '#EEF0F4',
        borderBottom: `1px solid ${t.border}`,
        position: 'relative', flexShrink: 0, gap: 2,
      }}>
        {/* Start-Button (Dashboard) */}
        <button onClick={() => setShowDashboard(true)} title="Übersicht"
          style={{
            marginRight: 8, marginBottom: 6,
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: showDashboard ? subject.color : (dark ? 'rgba(255,255,255,0.06)' : '#fff'),
            color: showDashboard ? '#fff' : t.muted,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all .15s', boxShadow: showDashboard ? `0 2px 8px ${subject.color}55` : 'none',
          }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
        </button>

        {SUBJECTS.map(s => {
          const on = s.id === subjectId && !showDashboard;
          const hovered = hoverSubject === s.id;
          return (
            <button key={s.id}
              ref={el => tabRefs.current[s.id] = el}
              onClick={() => onSubject(s.id)}
              onMouseEnter={() => setHoverSubject(s.id)}
              onMouseLeave={() => setHoverSubject(null)}
              style={{
                appearance: 'none', border: 'none', font: 'inherit',
                padding: '10px 18px 12px', cursor: 'pointer',
                background: on ? t.surface : (hovered ? (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)') : 'transparent'),
                borderRadius: '10px 10px 0 0',
                marginBottom: on ? -1 : 0,
                display: 'flex', alignItems: 'center', gap: 9,
                borderLeft: on ? `1px solid ${t.border}` : '1px solid transparent',
                borderRight: on ? `1px solid ${t.border}` : '1px solid transparent',
                position: 'relative',
                transition: 'background .12s',
              }}>
              <span style={{
                width: 9, height: 9, borderRadius: 3, background: s.color,
                opacity: on || hovered ? 1 : 0.55,
                boxShadow: on ? `0 0 0 2px ${s.color}26` : 'none',
                transition: 'all .15s',
              }} />
              <span style={{
                fontSize: 13, fontWeight: on ? 600 : 500,
                color: on ? t.text : t.muted,
                letterSpacing: -0.1,
              }}>{s.name}</span>
            </button>
          );
        })}

        {/* Gleitender Akzent-Indikator */}
        {!showDashboard && (
          <div style={{
            position: 'absolute', bottom: -1, height: 2,
            left: indicator.left, width: indicator.width,
            background: subject.color,
            transition: 'left .25s cubic-bezier(.4,.7,.3,1), width .25s cubic-bezier(.4,.7,.3,1)',
            borderRadius: '2px 2px 0 0',
          }} />
        )}

        <div style={{ flex: 1 }} />

        <div style={{ paddingBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchField dark={dark} value={query} onChange={setQuery}
            placeholder={`In ${subject.name} suchen...`} />
          <button onClick={() => setUploadOpen(true)} style={{
            height: 30, padding: '0 14px', border: 'none', borderRadius: 7,
            background: subject.color, color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: `0 2px 6px ${subject.color}40`, transition: 'transform .1s',
            fontFamily: 'inherit',
          }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
            onMouseUp={e => e.currentTarget.style.transform = ''}
            onMouseLeave={e => e.currentTarget.style.transform = ''}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1v9M1 5.5h9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Hochladen
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Sidebar */}
        <NotebookSidebar
          subject={subject} groupId={groupId} folderId={folderId}
          collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}
          onFolder={onFolder} dark={dark}
        />

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}>
          {showDashboard
            ? <DashboardView subject={subject} onPick={(gId, fId, fname) => { onFolder(gId, fId); if (fname) setFileName(fname); }} dark={dark} />
            : <FolderView subject={subject} group={group} folder={folder} file={file}
                files={filteredFiles} totalFiles={folder.files.length}
                onFile={setFileName} dark={dark} query={query}
                onContextMenu={(f, e) => { setMenuFile(f); setMenuPos({ x: e.clientX, y: e.clientY }); }}
                onUpload={() => setUploadOpen(true)} />}
        </div>

        {/* Preview */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <FilePreviewPlus file={showDashboard ? recentFiles(subject, 1)[0] : file}
            accent={subject.color} dark={dark} />
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)}
        accent={subject.color} dark={dark}
        targetFolder={`${subject.name} › ${group.name} › ${folder.name}`} />
      <FileMenu file={menuFile} x={menuPos.x} y={menuPos.y}
        onClose={() => setMenuFile(null)} dark={dark} accent={subject.color} />
    </div>
  );
}

function NotebookSidebar({ subject, groupId, folderId, collapsed, onToggle, onFolder, dark }) {
  const t = ThemeFor(dark);
  return (
    <div style={{
      width: collapsed ? 56 : 240,
      background: t.sidebar, borderRight: `1px solid ${t.border}`,
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      transition: 'width .22s cubic-bezier(.4,.7,.3,1)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center',
        padding: collapsed ? '0' : '0 12px 0 16px',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: `1px solid ${t.border}`, flexShrink: 0,
      }}>
        {!collapsed && (
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: 0.7,
            textTransform: 'uppercase', color: t.subtle,
          }}>{subject.name}</span>
        )}
        <button onClick={onToggle} title={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
          style={{
            width: 26, height: 26, border: 'none', borderRadius: 6,
            background: 'transparent', color: t.muted, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d={collapsed ? 'M4 3l4 4-4 4' : 'M10 3L6 7l4 4'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: collapsed ? '8px 6px' : '10px 0' }}>
        {subject.groups.map(g => (
          <div key={g.id} style={{ marginBottom: collapsed ? 8 : 16 }}>
            {!collapsed && (
              <div style={{
                padding: '0 16px 6px', fontSize: 10, fontWeight: 600, letterSpacing: 0.6,
                textTransform: 'uppercase', color: t.subtle,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: subject.color, opacity: 0.6 }} />
                {g.name}
              </div>
            )}
            {g.folders.map(f => {
              const on = g.id === groupId && f.id === folderId;
              return (
                <button key={f.id} onClick={() => onFolder(g.id, f.id)}
                  title={collapsed ? `${g.name} · ${f.name}` : undefined}
                  style={{
                    appearance: 'none', border: 'none', font: 'inherit',
                    width: collapsed ? 44 : '100%',
                    padding: collapsed ? '8px 0' : '7px 14px 7px 16px',
                    margin: collapsed ? '2px auto' : 0, display: 'flex',
                    alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: 10, cursor: 'pointer', textAlign: 'left',
                    background: on ? (dark ? `${subject.color}26` : `${subject.color}14`) : 'transparent',
                    borderLeft: !collapsed && on ? `3px solid ${subject.color}` : '3px solid transparent',
                    borderRadius: collapsed ? 8 : 0,
                    color: on ? t.text : t.muted,
                    fontSize: 13, fontWeight: on ? 600 : 400,
                    transition: 'background .1s, color .1s',
                  }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <FolderIcon color={on ? subject.color : (dark ? '#5a5a60' : '#C7CACF')} size={16} />
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                      <span style={{ fontSize: 10, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.files.length}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div style={{
          padding: 12, borderTop: `1px solid ${t.border}`, fontSize: 11, color: t.subtle,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: t.text,
          }}>MS</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>M. Schmidt</div>
            <div style={{ fontSize: 10, color: t.subtle }}>Online · {subject.name}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function FolderView({ subject, group, folder, file, files, totalFiles, onFile, dark, query, onContextMenu, onUpload }) {
  const t = ThemeFor(dark);
  return (
    <div style={{ padding: '20px 28px' }}>
      <Breadcrumb items={[subject.name, group.name, folder.name]} accent={subject.color} dark={dark} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0, letterSpacing: -0.5, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder.name}</h1>
          <div style={{ fontSize: 12, color: t.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {query
              ? `${files.length} von ${totalFiles} Dateien · Filter: "${query}"`
              : `${totalFiles} Datei${totalFiles !== 1 ? 'en' : ''} · zuletzt aktualisiert ${folder.files[0]?.date || '—'}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <ViewToggle dark={dark} />
          <SortButton dark={dark} />
        </div>
      </div>

      {/* Datei-Tabelle */}
      {files.length === 0 ? (
        <EmptyFiles dark={dark} accent={subject.color} query={query} />
      ) : (
        <div className="lm-filelist" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', containerType: 'inline-size' }}>
          <div className="lm-filerow lm-fileheader" style={{
            padding: '8px 16px', borderBottom: `1px solid ${t.border}`,
            fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.subtle,
          }}>
            <span />
            <span>Name</span>
            <span className="lm-col-size">Größe</span>
            <span className="lm-col-date">Datum</span>
            <span />
          </div>
          {files.map((f, i) => {
            const on = f.name === file?.name;
            return (
              <button key={f.name} onClick={() => onFile(f.name)}
                onContextMenu={(e) => { if (onContextMenu) { e.preventDefault(); onContextMenu(f, e); } }}
                className="lm-filerow"
                style={{
                  appearance: 'none', border: 'none', font: 'inherit', textAlign: 'left',
                  width: '100%',
                  padding: '10px 16px', alignItems: 'center', cursor: 'pointer',
                  background: on ? (dark ? `${subject.color}22` : `${subject.color}0F`) : 'transparent',
                  borderTop: i > 0 ? `1px solid ${t.border}` : 'none',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                <FileBadge kind={f.kind} name={f.name} size={26} />
                <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, color: t.text, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                  {f.tags && f.tags.length > 0 && (
                    <>
                      {f.tags.slice(0, 2).map((tag, ti) => (
                        <span key={ti} style={{
                          marginLeft: 6, fontSize: 9.5, padding: '1px 5px', borderRadius: 3,
                          background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                          color: t.subtle, fontWeight: 500, fontFamily: '"DM Mono", monospace',
                          verticalAlign: 'middle',
                        }}>{tag}</span>
                      ))}
                    </>
                  )}
                </span>
                <span className="lm-col-size" style={{ fontSize: 11, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.size}</span>
                <span className="lm-col-date" style={{ fontSize: 11, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.date}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); if (onContextMenu) onContextMenu(f, e); }}
                  style={{ color: t.subtle, fontSize: 14, opacity: on ? 1 : 0.5, cursor: 'pointer', textAlign: 'center', padding: '2px 0', borderRadius: 4 }}
                  onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  title="Aktionen">⋯
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Drop-Hinweis */}
      <div onClick={onUpload}
        style={{
          marginTop: 14, padding: '14px 16px',
          border: `1.5px dashed ${t.border}`, borderRadius: 10,
          fontSize: 12, color: t.subtle, textAlign: 'center',
          background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          cursor: 'pointer',
          transition: 'background .15s, border-color .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; e.currentTarget.style.borderColor = subject.color + '88'; }}
        onMouseLeave={e => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'; e.currentTarget.style.borderColor = t.border; }}>
        Dateien hierher ziehen oder klicken — über 25 Formate werden unterstützt
      </div>
    </div>
  );
}

function DashboardView({ subject, onPick, dark }) {
  const t = ThemeFor(dark);
  return (
    <div style={{ padding: '20px 28px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.7, textTransform: 'uppercase', color: t.subtle, fontFamily: '"DM Mono", monospace' }}>
        Übersicht
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '6px 0 4px', letterSpacing: -0.5 }}>{subject.name}</h1>
      <div style={{ fontSize: 13, color: t.muted, marginBottom: 22 }}>
        Schnellzugriff auf Gruppen, Ordner und zuletzt bearbeitete Dateien
      </div>

      {subject.groups.map(g => (
        <div key={g.id} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{g.name}</div>
            <span style={{ fontSize: 11, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{g.folders.length} Ordner</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {g.folders.map(f => (
              <button key={f.id}
                onClick={() => onPick(g.id, f.id, f.files[0]?.name)}
                style={{
                  appearance: 'none', border: `1px solid ${t.border}`, background: t.surface,
                  borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  transition: 'transform .12s, box-shadow .12s, border-color .12s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = dark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.06)';
                  e.currentTarget.style.borderColor = subject.color + '66';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '';
                  e.currentTarget.style.borderColor = t.border;
                }}>
                <FolderIcon color={subject.color} size={28} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>{f.name}</div>
                  <div style={{ fontSize: 10.5, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>
                    {f.files.length} Datei{f.files.length !== 1 ? 'en' : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchField({ dark, value, onChange, placeholder }) {
  const t = ThemeFor(dark);
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 30, padding: '0 10px', borderRadius: 7,
      background: dark ? 'rgba(255,255,255,0.06)' : '#fff',
      border: `1px solid ${focus ? '#9CA3AF' : t.border}`,
      width: 220, transition: 'border-color .12s',
    }}>
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ color: t.subtle }}>
        <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <input value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{
          appearance: 'none', border: 'none', outline: 'none', background: 'transparent',
          font: 'inherit', fontSize: 12, color: t.text, flex: 1, minWidth: 0,
        }} />
      {value
        ? <button onClick={() => onChange('')} style={{ border: 'none', background: 'transparent', color: t.subtle, cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
        : <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, padding: '2px 5px', borderRadius: 3, background: dark ? 'rgba(255,255,255,0.06)' : '#F3F4F6', color: t.subtle }}>⌘K</span>}
    </div>
  );
}

function ViewToggle({ dark }) {
  const t = ThemeFor(dark);
  const [view, setView] = React.useState('list');
  return (
    <div style={{ display: 'flex', background: dark ? 'rgba(255,255,255,0.05)' : '#F3F4F6', borderRadius: 7, padding: 2 }}>
      {[
        { id: 'list', icon: <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/> },
        { id: 'grid', icon: <><rect x="2" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="2" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="8" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.4"/></> },
      ].map(v => (
        <button key={v.id} onClick={() => setView(v.id)} style={{
          appearance: 'none', border: 'none', width: 26, height: 24, borderRadius: 5,
          background: view === v.id ? (dark ? '#2a2a30' : '#fff') : 'transparent',
          color: view === v.id ? t.text : t.subtle, cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: view === v.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">{v.icon}</svg>
        </button>
      ))}
    </div>
  );
}

function SortButton({ dark }) {
  const t = ThemeFor(dark);
  return (
    <button style={{
      appearance: 'none', border: `1px solid ${t.border}`, background: t.surface,
      height: 28, padding: '0 10px', borderRadius: 7, color: t.muted, fontSize: 11.5, fontWeight: 500,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
    }}>
      Datum ↓
    </button>
  );
}

function EmptyFiles({ dark, accent, query }) {
  const t = ThemeFor(dark);
  return (
    <div style={{
      background: t.surface, border: `1px dashed ${t.border}`, borderRadius: 12,
      padding: '36px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, margin: '0 auto 12px',
        background: `${accent}14`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>?</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>
        {query ? 'Keine Treffer' : 'Noch keine Dateien'}
      </div>
      <div style={{ fontSize: 12, color: t.muted }}>
        {query ? `Nichts gefunden für „${query}"` : 'Hochladen oder per Drag & Drop ablegen'}
      </div>
    </div>
  );
}

// Erweiterte Datei-Vorschau mit Header, Tabs und besserem Content
function FilePreviewPlus({ file, accent, dark }) {
  const t = ThemeFor(dark);
  if (!file) {
    return (
      <div style={{
        height: '100%', background: dark ? '#1a1a1d' : '#FAFBFC',
        borderLeft: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: t.subtle, fontSize: 12, padding: 24, textAlign: 'center',
      }}>
        Datei auswählen, um Vorschau anzuzeigen
      </div>
    );
  }
  return (
    <div style={{
      height: '100%', background: dark ? '#1a1a1d' : '#FAFBFC',
      borderLeft: `1px solid ${t.border}`,
      display: 'flex', flexDirection: 'column', color: t.text,
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
          <FileBadge kind={file.kind} name={file.name} size={34} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, color: t.text, wordBreak: 'break-word' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: t.subtle, marginTop: 4, fontFamily: '"DM Mono", monospace' }}>
              {fileKindName(file.kind)} · {file.size} · {file.date}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <PreviewTab active>Vorschau</PreviewTab>
          <PreviewTab>Info</PreviewTab>
          <PreviewTab>Verlauf</PreviewTab>
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, overflow: 'hidden' }}>
        <PreviewBody file={file} accent={accent} dark={dark} />
      </div>

      <div style={{ padding: '10px 14px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 6 }}>
        <PreviewActionBtn dark={dark}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.5h8M6 2v9M3 8.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Download
        </PreviewActionBtn>
        <PreviewActionBtn dark={dark}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 4l3-3-3-3M11 1H4a3 3 0 0 0-3 3v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 2)"/></svg>
          Teilen
        </PreviewActionBtn>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 28, padding: '0 14px', border: 'none', borderRadius: 6,
          background: accent, color: '#fff', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Öffnen</button>
      </div>
    </div>
  );
}

function PreviewTab({ children, active }) {
  return (
    <button style={{
      appearance: 'none', border: 'none', background: 'transparent',
      padding: '5px 0', marginRight: 12, cursor: 'pointer',
      fontSize: 11.5, fontWeight: active ? 600 : 500,
      color: active ? '#111827' : '#6B7280',
      borderBottom: active ? '1.5px solid #111827' : '1.5px solid transparent',
      fontFamily: 'inherit',
    }}>{children}</button>
  );
}

function PreviewActionBtn({ children, dark }) {
  const t = ThemeFor(dark);
  return (
    <button style={{
      height: 28, padding: '0 10px', border: `1px solid ${t.border}`, borderRadius: 6,
      background: 'transparent', color: t.muted, fontSize: 11.5, fontWeight: 500,
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
    }}>{children}</button>
  );
}

function PreviewBody({ file, accent, dark }) {
  const t = ThemeFor(dark);
  const k = file.kind;

  // PDF / DOC / TEXT / MARKDOWN — Faux-Seite
  if (k === 'pdf' || k === 'doc' || k === 'text' || k === 'markdown') {
    return <PaperPreview file={file} accent={accent} dark={dark} />;
  }
  if (k === 'slide')    return <SlidePreview    file={file} accent={accent} dark={dark} />;
  if (k === 'img')      return <ImagePreview    file={file} accent={accent} dark={dark} />;
  if (k === 'video' || k === 'mp4') return <VideoPreview file={file} accent={accent} dark={dark} />;
  if (k === 'audio')    return <AudioPreview    file={file} accent={accent} dark={dark} />;
  if (k === 'archive')  return <ArchivePreview  file={file} accent={accent} dark={dark} />;
  if (k === 'code')     return <CodePreview     file={file} accent={accent} dark={dark} />;
  if (k === 'notebook') return <NotebookPreview file={file} accent={accent} dark={dark} />;
  if (k === 'learn')    return <LearnPreview    file={file} accent={accent} dark={dark} />;
  if (k === 'ebook')    return <EbookPreview    file={file} accent={accent} dark={dark} />;
  if (k === 'qr')       return <QrPreview       file={file} accent={accent} dark={dark} />;
  if (k === 'link')     return <LinkPreview     file={file} accent={accent} dark={dark} />;
  if (k === 'sheet')    return <SheetPreview    file={file} accent={accent} dark={dark} />;

  return (
    <div style={{
      height: '100%', borderRadius: 6,
      background: dark ? '#1e1e22' : '#F8F9FB',
      border: `1px solid ${t.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: t.muted, fontSize: 11, fontFamily: '"DM Mono", monospace',
    }}>{fileKindName(k)} – keine Vorschau</div>
  );
}

// ────────────────────────────────────────────────────────────
// Einzelne Vorschau-Renderer
// ────────────────────────────────────────────────────────────

function PaperShell({ children, dark }) {
  return (
    <div style={{
      height: '100%', borderRadius: 6, background: '#fff', color: '#111827',
      boxShadow: dark
        ? '0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.4)'
        : '0 0 0 1px #E5E7EB, 0 6px 18px rgba(0,0,0,0.05)',
      padding: '18px 16px', overflow: 'hidden', position: 'relative',
    }}>{children}</div>
  );
}

function PaperPreview({ file, accent, dark }) {
  const isMd = file.kind === 'markdown';
  const isTxt = file.kind === 'text';
  return (
    <PaperShell dark={dark}>
      <div style={{ fontSize: 8.5, color: '#9CA3AF', letterSpacing: 0.4, fontFamily: '"DM Mono", monospace', marginBottom: 6 }}>
        {file.name}
      </div>
      {!isTxt && <div style={{ height: 4, width: 40, background: accent, marginBottom: 10 }} />}
      <div style={{
        fontSize: isTxt ? 11 : 13,
        fontFamily: isTxt ? '"DM Mono", monospace' : 'inherit',
        fontWeight: isTxt ? 400 : 700, lineHeight: 1.35, marginBottom: 8,
      }}>
        {isMd && <span style={{ color: '#16A34A', marginRight: 4 }}># </span>}
        {file.name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
      </div>
      {[96, 88, 92, 78, 90].map((w, i) => (
        <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 1.5, background: '#E5E7EB', marginBottom: 5 }} />
      ))}
      <div style={{ marginTop: 12, marginBottom: 10 }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 5 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />
            <div style={{ height: 4, width: `${[82,70,86][i-1]}%`, borderRadius: 1.5, background: '#E5E7EB' }} />
          </div>
        ))}
      </div>
      <div style={{ height: 70, background: `${accent}11`, border: `1px solid ${accent}33`, borderRadius: 4, marginBottom: 8, padding: 8 }}>
        <div style={{ height: 3, width: 40, background: accent, opacity: 0.7, marginBottom: 5 }} />
        <div style={{ height: 3, width: '80%', background: accent, opacity: 0.3, marginBottom: 4 }} />
        <div style={{ height: 3, width: '60%', background: accent, opacity: 0.3 }} />
      </div>
      {[92, 84].map((w, i) => (
        <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 1.5, background: '#E5E7EB', marginBottom: 5 }} />
      ))}
      <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 8, color: '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>
        {isMd ? 'MARKDOWN' : isTxt ? 'TEXT' : 'S. 1 / 4'}
      </div>
    </PaperShell>
  );
}

function SlidePreview({ file, accent, dark }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Hauptfolie */}
      <div style={{
        flex: 1, borderRadius: 6, background: '#fff', color: '#111',
        boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.4)' : '0 0 0 1px #E5E7EB, 0 6px 18px rgba(0,0,0,0.05)',
        padding: 18, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: '#9CA3AF', fontFamily: '"DM Mono", monospace', letterSpacing: 0.5 }}>
          <span style={{ width: 14, height: 3, background: accent }} /> FOLIE 1 / 12
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.15 }}>
          {file.name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
        </div>
        <div style={{ height: 3, width: 40, background: accent }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, background: accent, borderRadius: 1, transform: 'rotate(45deg)' }} />
              <div style={{ height: 4, width: `${[78,86,68,80][i-1]}%`, background: '#E5E7EB', borderRadius: 1.5 }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>
          <span>LehrerMaps</span><span>1</span>
        </div>
      </div>
      {/* Thumbnails */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            aspectRatio: '16/10', borderRadius: 3,
            background: i === 0 ? `${accent}26` : (dark ? '#222226' : '#fff'),
            border: `1px solid ${i === 0 ? accent : (dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB')}`,
            display: 'flex', alignItems: 'flex-end', padding: 4,
          }}>
            <span style={{ fontSize: 7, color: dark ? '#888' : '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>{i+1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImagePreview({ file, accent, dark }) {
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden', position: 'relative',
      background: `repeating-linear-gradient(45deg, ${accent}22 0 8px, ${accent}0a 8px 16px), ${dark ? '#222' : '#FFF7ED'}`,
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
    }}>
      <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, fontFamily: '"DM Mono", monospace', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 6px', borderRadius: 3 }}>
        1920 × 1080 · {(file.name.match(/\.([^.]+)$/) || [, ''])[1].toUpperCase()}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
          <rect x="3" y="6" width="36" height="30" rx="3" stroke={accent} strokeWidth="1.5"/>
          <circle cx="13" cy="16" r="3" fill={accent}/>
          <path d="M3 30l10-8 7 6 8-7 11 9v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3z" fill={accent} opacity="0.6"/>
        </svg>
        <span style={{ fontSize: 11, color: dark ? '#fff' : '#374151', opacity: 0.7, fontFamily: '"DM Mono", monospace' }}>
          Bild-Vorschau
        </span>
      </div>
    </div>
  );
}

function VideoPreview({ file, accent, dark }) {
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: '#0a0a0c', position: 'relative',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, ${accent}33 0%, transparent 70%)` }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <button style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none',
          background: accent, color: '#fff', cursor: 'pointer',
          boxShadow: `0 8px 24px ${accent}55`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 3l12 7-12 7V3z" fill="#fff"/></svg>
        </button>
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontFamily: '"DM Mono", monospace', background: 'rgba(0,0,0,0.5)', color: '#fff', padding: '2px 6px', borderRadius: 3 }}>
        {(file.name.match(/\.([^.]+)$/) || [, ''])[1].toUpperCase()} · 1080p
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
        <div style={{ height: 3, background: 'rgba(255,255,255,0.15)', borderRadius: 2, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '32%', background: accent, borderRadius: 2 }} />
          <div style={{ position: 'absolute', left: '32%', top: '50%', transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: '"DM Mono", monospace' }}>
          <span>00:42</span><span>02:18</span>
        </div>
      </div>
    </div>
  );
}

function AudioPreview({ file, accent, dark }) {
  // Mock-Waveform aus Sinus-Halbwellen mit Akzent-Höhen
  const bars = Array.from({ length: 56 }, (_, i) => {
    const x = i / 56;
    const v = Math.abs(Math.sin(x * 9) * Math.cos(x * 3)) * 0.7 + 0.2;
    return v;
  });
  const played = 0.34;
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: dark ? '#1e1e22' : '#fff',
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      display: 'flex', flexDirection: 'column', padding: 18, gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px ${accent}44`,
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="#fff">
            <path d="M7 3v9.5a2.5 2.5 0 1 1-2-2.45V5h7V3H7z"/>
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: dark ? '#fff' : '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {file.name.replace(/\.[^.]+$/, '')}
          </div>
          <div style={{ fontSize: 10, color: dark ? '#999' : '#6B7280', fontFamily: '"DM Mono", monospace', marginTop: 2 }}>
            {(file.name.match(/\.([^.]+)$/) || [, ''])[1].toUpperCase()} · 128 kbps
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
        {bars.map((v, i) => (
          <div key={i} style={{
            flex: 1, height: `${v * 100}%`, borderRadius: 1,
            background: i / bars.length < played ? accent : (dark ? 'rgba(255,255,255,0.18)' : '#D1D5DB'),
            transition: 'background .2s',
          }} />
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 10, color: dark ? '#aaa' : '#6B7280', fontFamily: '"DM Mono", monospace' }}>01:08</span>
        <div style={{ flex: 1 }} />
        <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#fff' : '#111', padding: 4 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3l5 5-5 5V3zm6 0l5 5-5 5V3z"/></svg>
        </button>
        <button style={{
          width: 32, height: 32, borderRadius: '50%', border: 'none', background: accent, color: '#fff',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="#fff"><path d="M3 1l8 5-8 5V1z"/></svg>
        </button>
        <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: dark ? '#fff' : '#111', padding: 4 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 3l-5 5 5 5V3zM7 3L2 8l5 5V3z"/></svg>
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: dark ? '#aaa' : '#6B7280', fontFamily: '"DM Mono", monospace' }}>03:14</span>
      </div>
    </div>
  );
}

function ArchivePreview({ file, accent, dark }) {
  // Synthetischer Inhalt — variiert je nach Name
  const contents = file.name.toLowerCase().includes('fotos')
    ? [{ n: 'IMG_2491.jpg', s: '3.8 MB' }, { n: 'IMG_2492.jpg', s: '4.1 MB' }, { n: 'IMG_2493.jpg', s: '3.5 MB' }, { n: 'IMG_2494.jpg', s: '4.4 MB' }]
    : file.name.toLowerCase().includes('projekt')
    ? [{ n: 'src/main.py', s: '8 KB' }, { n: 'src/utils.py', s: '4 KB' }, { n: 'data/input.csv', s: '120 KB' }, { n: 'README.md', s: '2 KB' }, { n: 'requirements.txt', s: '1 KB' }]
    : [{ n: 'kapitel_01.pdf', s: '480 KB' }, { n: 'kapitel_02.pdf', s: '520 KB' }, { n: 'kapitel_03.pdf', s: '410 KB' }, { n: 'index.html', s: '8 KB' }];
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: dark ? '#1e1e22' : '#fff', color: dark ? '#e8e8ea' : '#111',
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill={accent}>
          <path d="M3 2h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" opacity="0.2"/>
          <path d="M8 2h2v2H8V2zm0 3h2v2H8V5zm0 3h2v2H8V8zm0 3h2v3H8v-3z"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{contents.length} Einträge · {file.size}</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0' }}>
        {contents.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', fontSize: 11.5 }}>
            <FileBadge kind={detectKind(c.n)} name={c.n} size={18} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: '"DM Mono", monospace', color: dark ? '#ccc' : '#374151' }}>{c.n}</span>
            <span style={{ fontSize: 10, color: dark ? '#888' : '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>{c.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodePreview({ file, accent, dark }) {
  const ext = (file.name.match(/\.([^.]+)$/) || [, ''])[1].toLowerCase();
  const samples = {
    py:   [['def ', 'bewerte_test', '(test):'], ['    if ', 'test.', 'punkte >= 30', ':'], ['        return ', '"bestanden"'], ['    else', ':'], ['        return ', '"nachholen"']],
    html: [['<', 'html', ' lang=', '"de"', '>'], ['  <', 'head', '>'], ['    <', 'title', '>Hausaufgabe</', 'title', '>'], ['  </', 'head', '>'], ['  <', 'body', '>'], ['    <', 'h1', '>Hallo Klasse!</', 'h1', '>']],
    css:  [['.', 'btn', ' {'], ['  color', ': ', 'white', ';'], ['  background', ': ', '#2563EB', ';'], ['  border-radius', ': ', '8px', ';'], ['}']],
    js:   [['const ', 'klasse', ' = ', '"9b"', ';'], ['function ', 'noten', '(p) {'], ['  return ', 'p > 80 ? "sehr gut" : "ok"'], ['}']],
    ts:   [['interface ', 'Note', ' {'], ['  punkte', ': ', 'number'], ['  text', ': ', 'string'], ['}']],
    json: [['{'], ['  ', '"klasse"', ': ', '"9b"', ','], ['  ', '"schüler"', ': ', '24'], ['}']],
    sql:  [['SELECT ', 'name, note'], ['FROM ', 'schueler'], ['WHERE ', 'klasse = ', '"9b"'], ['ORDER BY ', 'note ', 'DESC', ';']],
    xml:  [['<', '?xml version="1.0"?', '>'], ['<', 'klasse', '>'], ['  <', 'schueler ', 'name="L. Becker"', '/>'], ['</', 'klasse', '>']],
    yaml: [['klasse', ': ', '9b'], ['fach', ': ', 'Spanisch'], ['schüler', ':'], ['  - ', 'Aydın'], ['  - ', 'Becker']],
    sb3:  [['{ ', '"name"', ': ', '"Pong"', ' }'], ['{ ', '"sprites"', ': ', '5', ' }']],
    lua:  [['function ', 'sayHi', '()'], ['  print', '(', '"Hola"', ')'], ['end']],
    md:   [['# ', 'Stundenplan'], ['- ', 'Spanisch'], ['- ', 'Sport']],
  };
  const tokens = samples[ext] || samples.js;
  const isMarkup = ext === 'html' || ext === 'xml';
  const palette = { keyword: '#C792EA', string: '#A5E075', tag: '#7FDBFF', plain: '#d4d4d4' };
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: '#1e1e22', color: '#d4d4d4',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
      fontFamily: '"DM Mono", ui-monospace, monospace', fontSize: 11, lineHeight: 1.8,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '6px 10px', background: '#252529', fontSize: 9, color: '#9aa', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #2a2a30' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
        <span style={{ marginLeft: 8 }}>{file.name}</span>
        <span style={{ marginLeft: 'auto', color: '#666' }}>{ext.toUpperCase()}</span>
      </div>
      <div style={{ flex: 1, padding: 10, overflow: 'hidden' }}>
        {tokens.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, whiteSpace: 'pre', overflow: 'hidden' }}>
            <span style={{ color: '#555', width: 14, textAlign: 'right', flexShrink: 0 }}>{i+1}</span>
            <span style={{ whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {line.map((tok, j) => (
                <span key={j} style={{ color: j % 2 === 0 ? palette.plain : (isMarkup ? palette.tag : palette.keyword) }}>{tok}</span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotebookPreview({ file, accent, dark }) {
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: '#fff', boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '8px 12px', background: '#F8F9FB', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="#F59E0B"><circle cx="7" cy="3.5" r="1.5"/><circle cx="3.5" cy="9.5" r="1.5"/><circle cx="10.5" cy="9.5" r="1.5"/></svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#111' }}>Jupyter · {file.name}</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>Python 3</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Markdown cell */}
        <div style={{ padding: 8, background: '#FAFBFC', borderLeft: `3px solid ${accent}`, borderRadius: 3, fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, color: '#111' }}># Datenanalyse Klasse 9b</div>
          <div style={{ color: '#374151' }}>Punkteverteilung über alle Tests laden und visualisieren.</div>
        </div>
        {/* Code cell */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, color: '#3B82F6', fontFamily: '"DM Mono", monospace', marginTop: 6 }}>In [1]:</span>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 3, padding: '6px 10px', fontFamily: '"DM Mono", monospace', fontSize: 10.5, lineHeight: 1.6, color: '#111', minWidth: 0, overflow: 'hidden' }}>
            <div><span style={{ color: '#7C3AED' }}>import</span> pandas <span style={{ color: '#7C3AED' }}>as</span> pd</div>
            <div>df = pd.read_csv(<span style={{ color: '#16A34A' }}>"noten.csv"</span>)</div>
            <div>df.describe()</div>
          </div>
        </div>
        {/* Output */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 9, color: '#DC2626', fontFamily: '"DM Mono", monospace', marginTop: 6 }}>Out[1]:</span>
          <div style={{ flex: 1, fontFamily: '"DM Mono", monospace', fontSize: 10, color: '#374151' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontWeight: 600, color: '#111', borderBottom: '1px solid #E5E7EB', paddingBottom: 2, marginBottom: 2 }}>
              <span /><span>punkte</span><span>min</span><span>max</span>
            </div>
            {[['count','24','0','100'], ['mean','67.4','45','92'], ['std','12.1','—','—']].map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>
                {r.map((c, j) => <span key={j} style={{ fontWeight: j === 0 ? 600 : 400 }}>{c}</span>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnPreview({ file, accent, dark }) {
  const isH5p = file.name.toLowerCase().endsWith('.h5p');
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
      display: 'flex', flexDirection: 'column', padding: 18, gap: 12, color: '#fff', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.2)',
          fontSize: 9, fontWeight: 700, letterSpacing: 0.6, fontFamily: '"DM Mono", monospace',
        }}>{isH5p ? 'H5P' : 'SCORM'} · INTERAKTIV</div>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="rgba(255,255,255,0.8)"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 7l5 3-5 3V7z"/></svg>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2 }}>
        {file.name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
      </div>
      {/* Quiz-Mock */}
      <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 12, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Frage 3 / 8</div>
        <div style={{ fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>Welche Konjugation gehört zu „vivir" (3. Pers. Sg, Pretérito Indefinido)?</div>
        {['vive', 'vivió', 'vivía', 'viviera'].map((opt, i) => (
          <div key={i} style={{
            padding: '7px 10px', marginBottom: 4, borderRadius: 5,
            background: i === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 8,
            border: i === 1 ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: i === 1 ? '#fff' : 'transparent',
              border: '1.5px solid rgba(255,255,255,0.6)',
            }} />
            {opt}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, opacity: 0.85, fontFamily: '"DM Mono", monospace' }}>
        <span>Fortschritt: 3 / 8</span>
        <span>Punkte: 24 / 80</span>
      </div>
    </div>
  );
}

function EbookPreview({ file, accent, dark }) {
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: dark ? '#1e1e22' : '#FFFBEB', color: dark ? '#e8e8ea' : '#1c1917',
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* "Buchrücken" */}
      <div style={{
        padding: '14px 16px', background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        color: '#fff', position: 'relative',
      }}>
        <div style={{ fontSize: 9, opacity: 0.8, fontFamily: '"DM Mono", monospace', letterSpacing: 0.5, marginBottom: 4 }}>E-BOOK · EPUB</div>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.2 }}>
          {file.name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
        </div>
      </div>
      <div style={{ padding: 14, flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: dark ? '#999' : '#6B7280', marginBottom: 8 }}>Inhalt</div>
        {['Vorwort', 'I. Anfang', 'II. Der Tag der Tat', 'III. Ermittlung', 'IV. Erinnerung', 'V. Wahrheit'].map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 11.5, color: i === 1 ? accent : (dark ? '#ccc' : '#374151'), fontWeight: i === 1 ? 600 : 400, borderBottom: dark ? '1px solid rgba(255,255,255,0.04)' : '1px solid #F3F4F6' }}>
            <span>{c}</span>
            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 10, color: dark ? '#777' : '#9CA3AF' }}>{[3, 11, 28, 47, 65, 89][i]}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 14px', borderTop: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: dark ? '#888' : '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>
        <span>Seite 11 / 184</span>
        <span>6 % gelesen</span>
      </div>
    </div>
  );
}

function QrPreview({ file, accent, dark }) {
  // Synthetisches QR-Gitter (21×21 mit Findermustern)
  const SIZE = 21;
  const cells = React.useMemo(() => {
    const g = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
    const finder = (r, c) => {
      for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
        const on = (i === 0 || i === 6 || j === 0 || j === 6) || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        if (r + i < SIZE && c + j < SIZE) g[r + i][c + j] = on ? 1 : 0;
      }
    };
    finder(0, 0); finder(0, SIZE - 7); finder(SIZE - 7, 0);
    // Pseudo-zufällige Datenmuster (deterministisch aus Dateinamen)
    let seed = file.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE; j++) {
      if ((i < 7 && j < 7) || (i < 7 && j >= SIZE - 7) || (i >= SIZE - 7 && j < 7)) continue;
      seed = (seed * 9301 + 49297) % 233280;
      g[i][j] = seed / 233280 > 0.5 ? 1 : 0;
    }
    return g;
  }, [file.name]);
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: '#fff',
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      display: 'flex', flexDirection: 'column', padding: 14, alignItems: 'center', gap: 10,
    }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: '#9CA3AF', fontFamily: '"DM Mono", monospace' }}>QR-Code · scannen</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: 0, width: 180, height: 180, background: '#fff', padding: 6, border: '1px solid #E5E7EB', borderRadius: 4 }}>
        {cells.flat().map((on, i) => (
          <div key={i} style={{ background: on ? '#111' : '#fff' }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#6B7280', fontFamily: '"DM Mono", monospace', textAlign: 'center', wordBreak: 'break-all' }}>
        ↳ {file.url || 'https://lehrermaps.local/'}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>PNG laden</button>
        <button style={{ height: 24, padding: '0 8px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>SVG laden</button>
      </div>
    </div>
  );
}

function LinkPreview({ file, accent, dark }) {
  const url = file.url || 'https://example.com';
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: dark ? '#1e1e22' : '#fff', color: dark ? '#e8e8ea' : '#111',
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Open-Graph-Style Hero */}
      <div style={{
        height: 110, background: `linear-gradient(135deg, ${accent} 0%, ${accent}88 100%)`,
        position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 7, background: '#fff', color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, fontFamily: '"DM Mono", monospace',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          {host[0]?.toUpperCase() || '🔗'}
        </div>
        <div style={{ marginLeft: 10, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 9, opacity: 0.85, fontFamily: '"DM Mono", monospace', letterSpacing: 0.4 }}>EXTERNER LINK</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{host}</div>
        </div>
      </div>
      <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
          {file.name.replace(/_/g, ' ').replace(/\.url$/, '')}
        </div>
        <div style={{
          fontSize: 11, fontFamily: '"DM Mono", monospace', color: accent,
          wordBreak: 'break-all', lineHeight: 1.5,
          padding: '6px 8px', borderRadius: 4,
          background: dark ? 'rgba(255,255,255,0.04)' : '#F8F9FB',
          border: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #E5E7EB',
        }}>{url}</div>
        <div style={{ fontSize: 11, color: dark ? '#aaa' : '#6B7280', lineHeight: 1.5 }}>
          Externer Link zu {host}. Klick öffnet in neuem Tab.
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          height: 30, border: 'none', borderRadius: 6, background: accent, color: '#fff',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M4 1H1v9h9V7M6 1h4v4M5 6L10 1" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Öffnen
        </button>
      </div>
    </div>
  );
}

function SheetPreview({ file, accent, dark }) {
  const rows = [
    ['Name', 'Klasse', 'Mündlich', 'Schriftlich', 'Ø'],
    ['Aydın, M.',   '9b', '2',  '3',  '2,3'],
    ['Becker, L.',  '9b', '1',  '2',  '1,3'],
    ['Diaz, S.',    '9b', '3',  '3',  '3,0'],
    ['Engel, T.',   '9b', '2',  '2',  '2,0'],
    ['Fischer, R.', '9b', '3',  '4',  '3,3'],
    ['Hahn, J.',    '9b', '2',  '1',  '1,7'],
  ];
  return (
    <div style={{
      height: '100%', borderRadius: 6, overflow: 'hidden',
      background: '#fff',
      boxShadow: dark ? '0 0 0 1px rgba(255,255,255,0.06)' : '0 0 0 1px #E5E7EB',
      fontFamily: '"DM Mono", monospace', fontSize: 10,
    }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', borderBottom: i < rows.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
          {r.map((c, j) => (
            <div key={j} style={{
              padding: '6px 8px', borderRight: j < r.length - 1 ? '1px solid #F0F0F0' : 'none',
              background: i === 0 ? '#F8F9FB' : (j === 0 ? '#FCFCFD' : 'transparent'),
              fontWeight: i === 0 || j === 0 ? 600 : 400,
              color: i === 0 ? '#111' : '#374151',
              fontSize: i === 0 ? 9.5 : 10,
              textTransform: i === 0 ? 'uppercase' : 'none',
              letterSpacing: i === 0 ? 0.4 : 0,
              textAlign: j > 1 ? 'center' : 'left',
            }}>{c}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  NotebookApp, NotebookSidebar, FolderView, DashboardView, FilePreviewPlus,
  SearchField, ViewToggle, SortButton, EmptyFiles, PreviewBody,
});
