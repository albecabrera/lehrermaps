/** Main authenticated landing page: the app's navigation hub. */
export default function HomeDashboard({ subjects = [], folders = [], onOpenSubject }) {
  const countFor = (subjectId) => folders.filter((folder) => folder.subject === subjectId).length;
  return (
    <main className="lm-home-view">
      <div className="lm-home-shell">
        <header className="lm-home-intro">
          <p className="lm-home-kicker">Mein Arbeitsbereich</p>
          <h1>Guten Tag</h1>
          <p>Alles Wichtige für deinen Unterricht an einem klaren Ort.</p>
        </header>
        <section className="lm-home-section" aria-labelledby="home-subjects-title">
          <div className="lm-home-section-heading">
            <div>
              <p className="lm-home-kicker">Unterricht</p>
              <h2 id="home-subjects-title">Alle Fächer</h2>
            </div>
            <span>{subjects.length} Bereiche</span>
          </div>
          <div className="lm-home-subject-grid">
            {subjects.map((subject) => (
              <button key={subject.id} type="button" className="lm-home-subject-card" onClick={() => onOpenSubject(subject.id)} style={{ '--subject-color': subject.color, '--subject-soft': subject.colorSoft, '--subject-dark': subject.colorDark }}>
                <div className="lm-home-subject-card-top">
                  <span className="lm-home-subject-monogram">{subject.short}</span>
                  <span className="lm-home-subject-arrow" aria-hidden="true">↗</span>
                </div>
                <span className="lm-home-subject-name">{subject.name}</span>
                <span className="lm-home-subject-meta">{countFor(subject.id)} Ordner</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
