// Variante 4 — "Atelier" / spatial: Fächer als gestapelte Notizbuch-Karten,
// eines aufgeschlagen mit Gruppen als Spalten. Tactile, kreativ.
// Kein Wireframe-Layout — eher ein visueller Schreibtisch.

function VariantSpatial({ activeSubjectId = 'spanisch', dark = false, previewFile }) {
  const t = ThemeFor(dark);
  const activeSubject = SUBJECTS.find(s => s.id === activeSubjectId) || SUBJECTS[0];
  const pf = previewFile || recentFiles(activeSubject, 1)[0];

  // Hintergrund: warmer Tisch / Filz
  const desk = dark
    ? 'radial-gradient(120% 80% at 50% 0%, #1c1c22 0%, #0e0e12 100%)'
    : 'radial-gradient(140% 90% at 50% -10%, #fbf8f2 0%, #efebe2 100%)';

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', background: desk, color: t.text, fontFamily: '"DM Sans", -apple-system, sans-serif' }}>
      {/* Top-Leiste */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 52, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 14, zIndex: 5 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>LehrerMaps</div>
        <div style={{ fontSize: 11, color: t.muted, fontFamily: '"DM Mono", monospace' }}>· Atelier</div>
        <div style={{ flex: 1 }} />
        <SearchBar dark={dark} placeholder="Suchen..." />
        <button style={{
          height: 30, padding: '0 12px', border: 'none', borderRadius: 7,
          background: activeSubject.color, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>＋ Neu</button>
      </div>

      {/* Linke Spalte: Stapel der Fächer (Notizbuch-Spines) */}
      <div style={{ width: 200, paddingTop: 70, paddingLeft: 18, flexShrink: 0, position: 'relative' }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase',
          color: t.subtle, padding: '0 6px 12px',
        }}>Notizbücher</div>

        {SUBJECTS.map((s, i) => (
          <NotebookSpine key={s.id} subject={s} active={s.id === activeSubject.id} dark={dark} offset={i} />
        ))}
      </div>

      {/* Mittlere "Bühne": geöffnetes Notizbuch */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 64, padding: '64px 22px 22px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <OpenNotebook subject={activeSubject} dark={dark} pf={pf} />
      </div>

      {/* Rechte Vorschau */}
      <div style={{ width: 300, paddingTop: 60, paddingRight: 18, paddingBottom: 18, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1, borderRadius: 12, overflow: 'hidden',
          boxShadow: dark
            ? '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        }}>
          <FilePreview file={pf} accent={activeSubject.color} dark={dark} />
        </div>
      </div>
    </div>
  );
}

function NotebookSpine({ subject, active, dark, offset }) {
  const t = ThemeFor(dark);
  const stats = subjectStats(subject);
  return (
    <div style={{
      position: 'relative',
      marginBottom: 10,
      marginLeft: active ? 0 : offset * 2,
      transform: active ? 'translateX(8px)' : 'none',
      transition: 'transform .2s',
    }}>
      <div style={{
        height: 64, borderRadius: '6px 10px 10px 6px',
        background: `linear-gradient(180deg, ${subject.color}, ${subject.colorDark})`,
        padding: '10px 12px 10px 22px',
        boxShadow: active
          ? `0 8px 20px ${subject.color}55, inset 0 1px 0 rgba(255,255,255,0.25)`
          : `0 3px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)`,
        color: '#fff',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative',
        cursor: 'pointer',
      }}>
        {/* Spine-Bindung links */}
        <div style={{
          position: 'absolute', left: 6, top: 8, bottom: 8, width: 2,
          background: 'rgba(0,0,0,0.25)', borderRadius: 1,
        }} />
        {/* Tab-Marker rechts (wie Karteireiter) */}
        {active && (
          <div style={{
            position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: `10px solid ${subject.colorDark}`,
          }} />
        )}
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>{subject.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, opacity: 0.85, fontFamily: '"DM Mono", monospace' }}>
          <span>{stats.fileCount} Dateien</span>
          <span>{stats.groupCount} Gr</span>
        </div>
      </div>
    </div>
  );
}

function OpenNotebook({ subject, dark, pf }) {
  const t = ThemeFor(dark);
  const recent = recentFiles(subject, 3);

  // Buch: linke Seite (Cover/Meta), rechte Seite (Inhalt)
  return (
    <div style={{
      flex: 1, display: 'flex', minHeight: 0,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: dark
        ? '0 24px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
        : '0 24px 50px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
      position: 'relative',
    }}>
      {/* Bindung in der Mitte */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '36%', width: 12, zIndex: 2,
        background: dark
          ? 'linear-gradient(90deg, rgba(0,0,0,0.4), rgba(0,0,0,0.15), rgba(0,0,0,0.4))'
          : 'linear-gradient(90deg, rgba(0,0,0,0.12), rgba(0,0,0,0.04), rgba(0,0,0,0.12))',
      }} />

      {/* Linke Seite: Cover */}
      <div style={{
        width: '36%', flexShrink: 0,
        background: `linear-gradient(160deg, ${subject.color}, ${subject.colorDark})`,
        color: '#fff', padding: '28px 26px',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.7, marginBottom: 12, fontFamily: '"DM Mono", monospace' }}>
          Notizbuch · {subject.short}
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.6, margin: 0, lineHeight: 1.05 }}>
          {subject.name}
        </h2>
        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>Schuljahr 2025/26</div>

        {/* Sektion-Liste mit Tabs */}
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subject.groups.map((g, i) => (
            <div key={g.id} style={{
              padding: '8px 10px', borderRadius: 7,
              background: i === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
              fontSize: 12.5, fontWeight: i === 0 ? 600 : 500, color: '#fff',
              display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer',
            }}>
              <span style={{ width: 4, height: 14, background: '#fff', opacity: i === 0 ? 1 : 0.4, borderRadius: 2 }} />
              <span style={{ flex: 1 }}>{g.name}</span>
              <span style={{ fontSize: 10, opacity: 0.7, fontFamily: '"DM Mono", monospace' }}>{g.folders.length}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          marginTop: 16, padding: 12, borderRadius: 8,
          background: 'rgba(255,255,255,0.1)',
          fontSize: 11, lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Heute</div>
          <div style={{ opacity: 0.85 }}>3. Std · 12c GK · Crónica de una muerte anunciada</div>
        </div>
      </div>

      {/* Rechte Seite: aktive Gruppe als Karteikarten */}
      <div style={{ flex: 1, background: dark ? '#1a1a1d' : '#fff', padding: '24px 26px', overflow: 'auto', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.subtle, marginBottom: 4 }}>
              Aktive Sektion
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3, color: t.text }}>
              {subject.groups[0].name}
            </div>
          </div>
          <div style={{ fontSize: 11, color: t.muted, fontFamily: '"DM Mono", monospace' }}>
            {subject.groups[0].folders.length} Ordner
          </div>
        </div>

        {/* Ordner als Karteikarten in Raster */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 22 }}>
          {subject.groups[0].folders.map((f, i) => (
            <div key={f.id} style={{
              position: 'relative',
              background: dark ? '#222226' : '#fdfaf2',
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '12px 14px',
              cursor: 'pointer',
              transform: `rotate(${i % 2 === 0 ? -0.4 : 0.3}deg)`,
            }}>
              {/* Tab oben */}
              <div style={{
                position: 'absolute', top: -1, left: 14, width: 36, height: 6,
                background: subject.color, borderRadius: '0 0 4px 4px',
              }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 4 }}>{f.name}</div>
              <div style={{ fontSize: 10.5, color: t.subtle, marginTop: 3, fontFamily: '"DM Mono", monospace' }}>
                {f.files.length} Datei{f.files.length !== 1 ? 'en' : ''} · zuletzt {f.files[0]?.date}
              </div>
              {/* Mini-Datei-Stack */}
              <div style={{ display: 'flex', gap: -4, marginTop: 10, alignItems: 'center' }}>
                {f.files.slice(0, 3).map((file, j) => (
                  <div key={j} style={{ marginLeft: j === 0 ? 0 : -6, zIndex: 3 - j }}>
                    <FileBadge kind={file.kind} size={20} />
                  </div>
                ))}
                {f.files.length > 3 && (
                  <span style={{ fontSize: 10, color: t.subtle, marginLeft: 6, fontFamily: '"DM Mono", monospace' }}>+{f.files.length - 3}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Zuletzt */}
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: t.subtle, marginBottom: 8 }}>
          Zuletzt geöffnet
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {recent.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 6,
              background: pf?.name === f.name ? (dark ? `${subject.color}22` : `${subject.color}11`) : 'transparent',
              border: `1px solid ${pf?.name === f.name ? subject.color : 'transparent'}`,
              cursor: 'pointer', minWidth: 0,
            }}>
              <FileBadge kind={f.kind} size={20} />
              <span style={{ fontSize: 12, color: t.text, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              <span style={{ fontSize: 10.5, color: t.subtle, fontFamily: '"DM Mono", monospace' }}>{f.folder}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VariantSpatial });
