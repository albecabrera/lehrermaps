/** Main authenticated landing page: the app's navigation hub. */
export default function HomeDashboard({ subjects = [], folders = [], onOpenSubject, onOpenSchedule, onOpenExams, onLogout }) {
  const countFor = (subjectId) => folders.filter((folder) => folder.subject === subjectId).length;
  const card = {
    background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16,
    padding: 20, color: 'var(--c-text)', fontFamily: 'inherit', textAlign: 'left',
  };
  const action = {
    border: '1px solid var(--c-border)', borderRadius: 11, background: 'var(--c-surface-2)',
    color: 'var(--c-text)', padding: '12px 14px', minHeight: 48, cursor: 'pointer',
    font: 'inherit', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
  };
  return (
    <main className="lm-home-view" style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 'clamp(24px, 5vw, 58px) clamp(18px, 5vw, 64px) 48px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <section aria-labelledby="home-subjects-title">
          <h2 id="home-subjects-title" style={{ margin: '0 0 12px', fontSize: 16 }}>Alle Fächer</h2>
          <div className="lm-home-subject-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {subjects.map((subject) => (
              <button key={subject.id} type="button" onClick={() => onOpenSubject(subject.id)} style={{ ...card, cursor: 'pointer', borderTop: `4px solid ${subject.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', background: subject.colorSoft, color: subject.colorDark, fontSize: 12, fontWeight: 900 }}>{subject.short}</span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{subject.name}</span>
                </div>
                <div style={{ marginTop: 15, color: 'var(--c-text-3)', fontSize: 12 }}>{countFor(subject.id)} Ordner</div>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="home-actions-title" style={{ marginTop: 30 }}>
          <h2 id="home-actions-title" style={{ margin: '0 0 12px', fontSize: 16 }}>Schnellzugriff</h2>
          <div className="lm-home-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
            <button type="button" onClick={onOpenSchedule} style={action}><span aria-hidden="true">📅</span> Stundenplan</button>
            <button type="button" onClick={onOpenExams} style={action}><span aria-hidden="true">🗓</span> Termine</button>
            <button type="button" onClick={onLogout} style={{ ...action, color: '#dc2626', borderColor: '#dc262655', background: '#dc262612' }}><span aria-hidden="true">↪</span> Logout</button>
          </div>
        </section>
      </div>
    </main>
  );
}
