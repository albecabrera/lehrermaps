import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { getKlausurplanFolder, getFiles } from '../lib/api';
import FilePreview from './FilePreview';

const DOCUMENTS = [
  { label: '1. Quartal', filename: 'Klausurplan_8_9-10_2026-27 1. Quartal.docx' },
  { label: '2. Quartal', filename: 'Klausurplan_8-9-10_2026-27 2_Quartal.docx' },
  { label: 'Q2 · 1. Quartal', filename: 'Q2-1.-Quartal.docx' },
  { label: 'Q2 · 2. Quartal', filename: 'Q2-2.-Quartal.docx' },
];

const normalize = (value) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase();

export default function KlausurplanWorkspace() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getKlausurplanFolder()
      .then((folder) => getFiles(folder.id))
      .then((result) => { if (!cancelled) setFiles(result); })
      .catch(() => { if (!cancelled) setFiles([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="lm-klausurplan-workspace" id="main-content">
      <header>
        <p>Klausurplan</p>
        <h1>Prüfungen und Schultermine</h1>
        <span>Die Dokumente bleiben intern gespeichert und sind unabhängig von den archivierten Fachordnern verfügbar.</span>
      </header>
      <section aria-labelledby="klausurplan-documents-title">
        <div className="lm-klausurplan-section-heading">
          <h2 id="klausurplan-documents-title">Klausurdokumente</h2>
          {loading && <small>Dokumente werden geladen …</small>}
        </div>
        <div className="lm-klausurplan-document-grid">
          {DOCUMENTS.map((document) => {
            const file = files.find((item) => normalize(item.original_name) === normalize(document.filename));
            return (
              <article key={document.filename} className="lm-klausurplan-document">
                <span aria-hidden="true">▤</span>
                <div><strong>{document.label}</strong><small>{file ? file.original_name : 'Noch nicht verfügbar'}</small></div>
                {file ? <button type="button" onClick={() => setSelectedFile(file)}>Öffnen</button> : <button type="button" disabled>Nicht verfügbar</button>}
              </article>
            );
          })}
        </div>
      </section>
      <section className="lm-klausurplan-school-calendar" aria-labelledby="school-calendar-title">
        <div className="lm-klausurplan-section-heading"><h2 id="school-calendar-title">Schulischer Terminplan</h2></div>
        <iframe src="/terminplan-schuljahr-2026-27.pdf#view=FitH" title="Terminplan Schuljahr 2026/27" />
      </section>
      {selectedFile && createPortal(
        <div className="lm-klausurplan-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedFile(null); }}>
          <section className="lm-klausurplan-preview-dialog" role="dialog" aria-modal="true" aria-label={`Klausurplan: ${selectedFile.original_name}`}>
            <FilePreview file={selectedFile} accent="#0F766E" onClose={() => setSelectedFile(null)} />
          </section>
        </div>,
        document.body
      )}
    </main>
  );
}
