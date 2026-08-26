import { createPortal } from 'react-dom';
import { useEscapeKey } from '../hooks/useEscapeKey';

const PDF_URL = '/terminplan-schuljahr-2026-27.pdf';

export default function SchoolCalendarPdf({ onClose }) {
  useEscapeKey(true, onClose);

  return createPortal(
    <div className="lm-school-calendar-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="lm-school-calendar-viewer" role="dialog" aria-modal="true" aria-labelledby="lm-school-calendar-title">
        <header className="lm-school-calendar-header">
          <div>
            <div className="lm-school-calendar-kicker">Schulorganisation</div>
            <h2 id="lm-school-calendar-title">Terminplan Schuljahr 2026/27</h2>
          </div>
          <div className="lm-school-calendar-actions">
            <a href={PDF_URL} target="_blank" rel="noreferrer" className="lm-school-calendar-open">↗ Öffnen</a>
            <button type="button" onClick={onClose} aria-label="Terminplan schließen">×</button>
          </div>
        </header>
        <iframe className="lm-school-calendar-frame" src={`${PDF_URL}#view=FitH`} title="Terminplan Schuljahr 2026/27" />
      </section>
    </div>,
    document.body
  );
}
