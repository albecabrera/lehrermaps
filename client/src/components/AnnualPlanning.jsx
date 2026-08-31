import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../contexts/LangContext';
import { useEscapeKey } from '../hooks/useEscapeKey';
import {
  attachAnnualPlanMaterial, commitAnnualPlanImport, createAnnualPlan, createAnnualPlanEntry,
  createFolder, deleteAnnualPlanEntry, downloadAuthenticated, duplicateAnnualPlanEntry,
  exportAnnualPlanZip, getAnnualPlan, getAnnualPlanMaterials, getFolders, openAuthenticated,
  previewAnnualPlanImport, startAnnualPlanLessonSession, unlinkAnnualPlanMaterial, updateAnnualPlan,
  updateAnnualPlanEntry, uploadFile,
} from '../lib/api';

const TYPES = [
  ['lesson', 'Unterrichtsstunde'], ['holiday', 'Ferien'], ['exam', 'Klausur'],
  ['classwork', 'Klassenarbeit'], ['presentation', 'Referat'],
  ['school_event', 'Schulveranstaltung'], ['other', 'Sonstiges'],
];
const typeLabel = Object.fromEntries(TYPES);
const annualPlanningFolderRequests = new Map();

function defaultSchoolYear() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${String(start + 1).slice(-2)}`;
}

function schoolYearDates(year) {
  const start = Number(String(year).slice(0, 4));
  return { start_date: `${start}-08-01`, end_date: `${start + 1}-07-31` };
}

function emptyEntry() {
  return {
    entry_date: new Date().toISOString().slice(0, 10), end_date: '', entry_type: 'lesson',
    lesson_number: '', title: '', notes: '', content: '', learning_objectives: '', activities: '', homework: '',
    file_ids: [], folder_ids: [],
  };
}

function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('de-DE') : '—';
}

function entryHeading(entry) {
  return entry.title || entry.content || 'Unterrichtsstunde';
}

async function ensureAnnualPlanningFolder(rootFolder) {
  const requestKey = String(rootFolder.id);
  if (!annualPlanningFolderRequests.has(requestKey)) {
    annualPlanningFolderRequests.set(requestKey, (async () => {
      const folders = await getFolders();
      const existing = folders.find((folder) => Number(folder.parent_id) === Number(rootFolder.id) && folder.name === 'Jahresplanung');
      if (existing) return existing;
      try {
        return await createFolder({ subject: rootFolder.subject, group_name: rootFolder.group_name, name: 'Jahresplanung', parent_id: rootFolder.id });
      } catch (error) {
        const refreshed = await getFolders();
        const createdElsewhere = refreshed.find((folder) => Number(folder.parent_id) === Number(rootFolder.id) && folder.name === 'Jahresplanung');
        if (createdElsewhere) return createdElsewhere;
        throw error;
      }
    })().catch((error) => {
      annualPlanningFolderRequests.delete(requestKey);
      throw error;
    }));
  }
  return annualPlanningFolderRequests.get(requestKey);
}

export default function AnnualPlanning({ rootFolder, accent, onOpenLesson }) {
  const { t } = useLang();
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear);
  const [plan, setPlan] = useState(null);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState(schoolYearDates(defaultSchoolYear()));
  const [draft, setDraft] = useState(emptyEntry);
  const [materials, setMaterials] = useState({ files: [], folders: [] });
  const [materialCatalog, setMaterialCatalog] = useState([]);
  const [materialQuery, setMaterialQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [showDetails, setShowDetails] = useState(false);
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [uploadingWorksheets, setUploadingWorksheets] = useState(false);
  const [isWorksheetDropTarget, setIsWorksheetDropTarget] = useState(false);
  const [worksheetUploadStatus, setWorksheetUploadStatus] = useState('');
  const [startingEntryId, setStartingEntryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const worksheetInputRef = useRef(null);
  const archiveInputRef = useRef(null);
  const worksheetDragDepth = useRef(0);

  useEscapeKey(!!selectedEntry, () => setSelectedEntry(null));

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setNotice(''); setDraft(emptyEntry()); setShowDetails(false);
    getAnnualPlan(rootFolder.id, schoolYear).then((data) => {
      if (!active) return;
      setPlan(data.plan); setEntries(data.entries || []);
      setMeta(data.plan ? { start_date: data.plan.start_date || '', end_date: data.plan.end_date || '' } : schoolYearDates(schoolYear));
    }).catch((err) => active && setError(err.response?.data?.error || err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [rootFolder.id, schoolYear]);

  useEffect(() => {
    let active = true;
    getAnnualPlanMaterials(rootFolder.id, materialQuery).then((data) => {
      if (!active) return;
      setMaterials(data);
      if (!materialQuery) setMaterialCatalog(data.files || []);
    }).catch(() => {});
    return () => { active = false; };
  }, [rootFolder.id, materialQuery]);

  const months = useMemo(() => [...new Set(entries.map((entry) => String(entry.entry_date).slice(0, 7)))].sort(), [entries]);
  const filteredEntries = useMemo(() => entries.filter((entry) => (
    (typeFilter === 'all' || entry.entry_type === typeFilter)
    && (monthFilter === 'all' || String(entry.entry_date).slice(0, 7) === monthFilter)
  )), [entries, monthFilter, typeFilter]);
  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleMaterial = (key, id) => setDraft((current) => ({
    ...current, [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
  }));
  const materialsForEntry = (entry) => (entry.file_ids || []).map((id) => (
    materialCatalog.find((file) => Number(file.id) === Number(id))
      || materials.files.find((file) => Number(file.id) === Number(id))
      || { id, original_name: `Datei #${id}` }
  ));

  const uploadWorksheets = async (selectedFiles) => {
    const files = [...selectedFiles];
    if (!files.length || uploadingWorksheets) return;
    setUploadingWorksheets(true); setError(''); setNotice('');
    try {
      const folder = await ensureAnnualPlanningFolder(rootFolder);
      const uploaded = [];
      let uploadError;
      for (const file of files) {
        try {
          uploaded.push(await uploadFile(folder.id, file, (progress) => {
            const percent = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;
            setWorksheetUploadStatus(`${file.name}: ${percent}%`);
          }));
        } catch (err) { uploadError = err; break; }
      }
      if (!uploaded.length) throw uploadError;
      const uploadedIds = uploaded.map((file) => file.id);
      setDraft((current) => ({ ...current, file_ids: [...new Set([...(current.file_ids || []), ...uploadedIds])] }));
      setMaterials((current) => ({ ...current, files: [...uploaded, ...current.files.filter((file) => !uploadedIds.includes(file.id))] }));
      setMaterialCatalog((current) => [...uploaded, ...current.filter((file) => !uploadedIds.includes(file.id))]);
      setWorksheetUploadStatus(uploadError ? t('annual.worksheet_upload_partial', { n: uploaded.length }) : t('annual.worksheet_upload_complete', { n: uploaded.length }));
      if (uploadError) setError(uploadError.response?.data?.error || t('annual.worksheet_upload_partial', { n: uploaded.length }));
    } catch (err) {
      setError(err.response?.data?.error || t('annual.worksheet_upload_error'));
      setWorksheetUploadStatus(t('annual.worksheet_upload_error'));
    } finally { setUploadingWorksheets(false); }
  };

  const savePlan = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const saved = plan ? await updateAnnualPlan(plan.id, { school_year: schoolYear, ...meta }) : await createAnnualPlan({ root_folder_id: rootFolder.id, school_year: schoolYear, ...meta });
      setPlan(saved); setNotice('Planungszeitraum gespeichert.');
    } catch (err) { setError(err.response?.data?.error || err.message); } finally { setSaving(false); }
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    if (!draft.entry_date || !draft.content.trim()) return;
    setSaving(true); setError(''); setNotice('');
    try {
      let activePlan = plan;
      if (!activePlan) {
        activePlan = await createAnnualPlan({ root_folder_id: rootFolder.id, school_year: schoolYear, ...meta });
        setPlan(activePlan);
      }
      const payload = { ...draft, content: draft.content.trim(), title: draft.title.trim(), end_date: draft.end_date || null };
      let saved = draft.id ? await updateAnnualPlanEntry(draft.id, payload) : await createAnnualPlanEntry(activePlan.id, payload);
      const original = draft.id ? entries.find((entry) => entry.id === draft.id) || { file_ids: [], folder_ids: [] } : { file_ids: [], folder_ids: [] };
      for (const kind of ['file', 'folder']) {
        const key = `${kind}_ids`;
        for (const id of draft[key] || []) if (!(original[key] || []).includes(id)) saved = await attachAnnualPlanMaterial(saved.id, kind, id);
        for (const id of original[key] || []) if (!(draft[key] || []).includes(id)) saved = await unlinkAnnualPlanMaterial(saved.id, kind, id);
      }
      setEntries((current) => draft.id ? current.map((entry) => entry.id === saved.id ? saved : entry) : [...current, saved]);
      setDraft(emptyEntry()); setShowDetails(false); setWorksheetUploadStatus('');
      setNotice(draft.id ? 'Unterricht aktualisiert.' : 'Unterricht gespeichert.');
    } catch (err) { setError(err.response?.data?.error || err.message); } finally { setSaving(false); }
  };

  const editEntry = (entry) => {
    setDraft({ ...entry, end_date: entry.end_date || '', file_ids: entry.file_ids || [], folder_ids: entry.folder_ids || [] });
    setShowDetails(Boolean(entry.end_date || entry.lesson_number || entry.title || entry.notes || entry.learning_objectives || entry.activities || entry.homework));
    setSelectedEntry(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const removeEntry = async (entry) => {
    if (!window.confirm(`„${entryHeading(entry)}“ wirklich löschen?`)) return;
    await deleteAnnualPlanEntry(entry.id);
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  };
  const duplicateEntry = async (entry) => {
    const copy = await duplicateAnnualPlanEntry(entry.id);
    setEntries((current) => [...current, copy]);
  };
  const startLesson = async (entry) => {
    setStartingEntryId(entry.id); setError('');
    try {
      const result = await startAnnualPlanLessonSession(entry.id);
      if (result.entry) setEntries((current) => current.map((item) => item.id === result.entry.id ? result.entry : item));
      onOpenLesson?.(result.session);
    } catch (err) { setError(err.response?.data?.error || err.message); } finally { setStartingEntryId(null); }
  };
  const importArchive = async (event) => {
    const archive = event.target.files?.[0]; event.target.value = '';
    if (!archive) return;
    setSaving(true); setError('');
    try {
      const preview = await previewAnnualPlanImport(rootFolder.id, schoolYear, archive);
      if (!window.confirm(`${preview.entries} Einträge und ${preview.attachments} Anlagen als neue Jahresplanung ${preview.school_year} importieren?`)) return;
      await commitAnnualPlanImport(preview.token);
      const loaded = await getAnnualPlan(rootFolder.id, preview.school_year);
      setSchoolYear(preview.school_year); setPlan(loaded.plan); setEntries(loaded.entries || []); setNotice('Jahresplanung importiert.');
    } catch (err) { setError(err.response?.data?.error || err.message); } finally { setSaving(false); }
  };

  return <div className="lm-annual-planning lm-annual-print">
    <header className="lm-annual-header lm-annual-no-print">
      <div><p className="lm-annual-eyebrow">{rootFolder.group_name}</p><h1>{t('annual.title')}</h1><p>{t('annual.subtitle')}</p></div>
      <div className="lm-annual-header-actions">
        <label>Schuljahr<input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} placeholder="2026/27" /></label>
        {plan && <><button type="button" onClick={() => exportAnnualPlanZip(plan.id)} className="lm-annual-secondary">{t('annual.export')}</button><button type="button" onClick={() => { document.body.classList.add('lm-print-planning'); window.print(); window.setTimeout(() => document.body.classList.remove('lm-print-planning'), 500); }} className="lm-annual-secondary">{t('notes.print')}</button></>}
        <input ref={archiveInputRef} type="file" accept=".zip,application/zip" onChange={importArchive} className="lm-visually-hidden" />
        <button type="button" disabled={saving} onClick={() => archiveInputRef.current?.click()} className="lm-annual-secondary">Importieren</button>
      </div>
    </header>

    {error && <div className="lm-annual-feedback is-error" role="alert">{error}</div>}
    {notice && <div className="lm-annual-feedback is-success" role="status">{notice}</div>}

    {!loading && <form onSubmit={saveEntry} className="lm-annual-quick-entry lm-annual-no-print">
      <div className="lm-annual-quick-heading"><div><p className="lm-annual-eyebrow">{draft.id ? 'Unterricht bearbeiten' : 'Schnellerfassung'}</p><h2>{draft.id ? entryHeading(draft) : 'Neue Unterrichtsstunde'}</h2><p>Datum, Inhalt und Materialien – alles Weitere ist optional.</p></div>{draft.id && <button type="button" className="lm-annual-secondary" onClick={() => { setDraft(emptyEntry()); setShowDetails(false); }}>Abbrechen</button>}</div>
      <div className="lm-annual-primary-fields">
        <label>Datum<input type="date" required value={draft.entry_date} onChange={(event) => updateDraft('entry_date', event.target.value)} /></label>
        <label className="lm-annual-content-field">Inhalt<textarea required value={draft.content} onChange={(event) => updateDraft('content', event.target.value)} rows="3" placeholder="Was wird in dieser Stunde behandelt?" autoFocus={!draft.id} /></label>
      </div>
      <section className="lm-annual-material-picker" aria-labelledby="lm-annual-materials-heading">
        <div><h3 id="lm-annual-materials-heading">{t('annual.materials')}</h3><p>Direkt hochladen oder vorhandene Materialien verknüpfen.</p></div>
        <input ref={worksheetInputRef} type="file" multiple disabled={saving || uploadingWorksheets} onChange={(event) => { const files = event.target.files; event.target.value = ''; uploadWorksheets(files || []); }} className="lm-visually-hidden" id={`annual-worksheet-input-${rootFolder.id}`} />
        <div className={`lm-annual-dropzone${isWorksheetDropTarget ? ' is-active' : ''}`} onDragEnter={(event) => { event.preventDefault(); worksheetDragDepth.current += 1; setIsWorksheetDropTarget(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { event.preventDefault(); worksheetDragDepth.current -= 1; if (worksheetDragDepth.current <= 0) { worksheetDragDepth.current = 0; setIsWorksheetDropTarget(false); } }} onDrop={(event) => { event.preventDefault(); worksheetDragDepth.current = 0; setIsWorksheetDropTarget(false); uploadWorksheets(event.dataTransfer.files || []); }}>
          <span>📎 Dateien hier ablegen</span><label htmlFor={`annual-worksheet-input-${rootFolder.id}`}>{uploadingWorksheets ? t('annual.worksheet_uploading') : 'Dateien auswählen'}</label>
        </div>
        {worksheetUploadStatus && <p className="lm-annual-upload-status" role="status">{worksheetUploadStatus}</p>}
        {draft.file_ids.length > 0 && <div className="lm-annual-selected-materials">{materialsForEntry(draft).map((file) => <span key={file.id}>📄 {file.original_name}<button type="button" aria-label={`${file.original_name} entfernen`} onClick={() => toggleMaterial('file_ids', file.id)}>×</button></span>)}</div>}
        <label className="lm-annual-material-search">Vorhandene Materialien durchsuchen<input value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder={t('annual.material_search')} /></label>
        {(materials.files.length || materials.folders.length) > 0 && <div className="lm-annual-material-results">{materials.folders.map((folder) => <label key={`folder-${folder.id}`}><input type="checkbox" checked={draft.folder_ids.includes(folder.id)} onChange={() => toggleMaterial('folder_ids', folder.id)} /> 📁 {folder.name}</label>)}{materials.files.map((file) => <label key={`file-${file.id}`}><input type="checkbox" checked={draft.file_ids.includes(file.id)} onChange={() => toggleMaterial('file_ids', file.id)} /> 📄 {file.original_name}</label>)}</div>}
      </section>
      <details className="lm-annual-details" open={showDetails} onToggle={(event) => setShowDetails(event.currentTarget.open)}><summary>Mehr Details (optional)</summary><div className="lm-annual-details-grid">
        <label>Typ<select value={draft.entry_type} onChange={(event) => updateDraft('entry_type', event.target.value)}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Stunde<input value={draft.lesson_number} onChange={(event) => updateDraft('lesson_number', event.target.value)} placeholder="z. B. 1.–2." /></label>
        <label>Enddatum<input type="date" value={draft.end_date} onChange={(event) => updateDraft('end_date', event.target.value)} /></label>
        <label>Titel (optional)<input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Wird sonst aus dem Inhalt erzeugt" /></label>
        <label className="lm-annual-full-width">Notizen<textarea value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} rows="2" /></label>
        <label>Lernziele<textarea value={draft.learning_objectives} onChange={(event) => updateDraft('learning_objectives', event.target.value)} rows="2" /></label>
        <label>Aktivitäten<textarea value={draft.activities} onChange={(event) => updateDraft('activities', event.target.value)} rows="2" /></label>
        <label className="lm-annual-full-width">Hausaufgaben<textarea value={draft.homework} onChange={(event) => updateDraft('homework', event.target.value)} rows="2" /></label>
      </div></details>
      <div className="lm-annual-save-row"><span>{draft.file_ids.length + draft.folder_ids.length} Material{draft.file_ids.length + draft.folder_ids.length === 1 ? '' : 'ien'} verknüpft</span><button type="submit" disabled={saving || !draft.entry_date || !draft.content.trim()} style={{ background: accent }}>{saving ? 'Wird gespeichert …' : 'Unterricht speichern'}</button></div>
    </form>}

    {!loading && <details className="lm-annual-plan-settings lm-annual-no-print" open={showPlanSettings} onToggle={(event) => setShowPlanSettings(event.currentTarget.open)}><summary>Planungszeitraum und Einstellungen</summary><div><label>Start<input type="date" value={meta.start_date} onChange={(event) => setMeta({ ...meta, start_date: event.target.value })} /></label><label>Ende<input type="date" value={meta.end_date} onChange={(event) => setMeta({ ...meta, end_date: event.target.value })} /></label><button type="button" onClick={savePlan} disabled={saving || !/^\d{4}\/\d{2}$/.test(schoolYear)} style={{ background: accent }}>{plan ? 'Zeitraum speichern' : 'Planungszeitraum anlegen'}</button></div></details>}
    {loading ? <div className="lm-annual-loading">{t('loading')}</div> : <>
      <section className="lm-annual-list-section"><div className="lm-annual-list-header"><div><p className="lm-annual-eyebrow">Übersicht</p><h2>Geplante Unterrichtsstunden</h2><p>{filteredEntries.length} von {entries.length} Einträgen</p></div><div className="lm-annual-filters"><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">{t('annual.all_types')}</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="all">{t('annual.all_months')}</option>{months.map((month) => <option key={month} value={month}>{month}</option>)}</select></div></div>
        {filteredEntries.length ? <div className="lm-annual-entry-list">{filteredEntries.map((entry) => <article key={entry.id} className="lm-annual-entry-card" tabIndex="0" onClick={() => setSelectedEntry(entry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedEntry(entry); }}><time dateTime={entry.entry_date}>{formatDate(entry.entry_date)}</time><div className="lm-annual-entry-content"><div><span className="lm-annual-type" data-type={entry.entry_type}>{typeLabel[entry.entry_type]}</span>{entry.lesson_number && <span className="lm-annual-lesson-number">{entry.lesson_number}</span>}</div><h3>{entryHeading(entry)}</h3><p>{entry.content || entry.notes || 'Kein Inhalt hinterlegt.'}</p>{(entry.file_ids?.length || entry.folder_ids?.length) > 0 && <span className="lm-annual-attachment-count">📎 {(entry.file_ids?.length || 0) + (entry.folder_ids?.length || 0)} Materialien</span>}</div><div className="lm-annual-entry-actions"><button type="button" onClick={(event) => { event.stopPropagation(); editEntry(entry); }}>Bearbeiten</button>{entry.entry_type === 'lesson' && <button type="button" onClick={(event) => { event.stopPropagation(); startLesson(entry); }} disabled={startingEntryId === entry.id} style={{ color: accent }}>{startingEntryId === entry.id ? '…' : entry.lesson_session ? 'Fortsetzen' : 'Starten'}</button>}<button type="button" aria-label="Eintrag duplizieren" onClick={(event) => { event.stopPropagation(); duplicateEntry(entry); }}>⧉</button><button type="button" aria-label="Eintrag löschen" className="is-danger" onClick={(event) => { event.stopPropagation(); removeEntry(entry); }}>×</button></div></article>)}</div> : <div className="lm-annual-empty"><strong>Noch keine Einträge</strong><span>Erfasse oben die erste Unterrichtsstunde für dieses Schuljahr.</span></div>}
      </section>
    </>}
    {selectedEntry && <div className="lm-annual-detail" role="dialog" aria-modal="true" aria-labelledby="lm-annual-detail-title"><div className="lm-annual-detail-card"><div className="lm-annual-detail-header"><div><div className="lm-annual-detail-date">{formatDate(selectedEntry.entry_date)}</div><h2 id="lm-annual-detail-title">{entryHeading(selectedEntry)}</h2><span className="lm-annual-type" data-type={selectedEntry.entry_type}>{typeLabel[selectedEntry.entry_type]}</span></div><button type="button" className="lm-annual-detail-close" onClick={() => setSelectedEntry(null)} aria-label={t('annual.detail_close')}>×</button></div>{['content', 'notes', 'learning_objectives', 'activities', 'homework'].map((field) => selectedEntry[field] && <section key={field} className="lm-annual-detail-section"><h3>{{ content: 'Inhalt', notes: 'Notizen', learning_objectives: 'Lernziele', activities: 'Aktivitäten', homework: 'Hausaufgaben' }[field]}</h3><p>{selectedEntry[field]}</p></section>)}<section className="lm-annual-detail-section"><h3>{t('annual.materials')}</h3>{materialsForEntry(selectedEntry).length ? <div className="lm-annual-material-list">{materialsForEntry(selectedEntry).map((file) => <div className="lm-annual-material" key={file.id}><span className="lm-annual-material-name">📄 {file.original_name}</span><span className="lm-annual-material-actions"><button type="button" onClick={() => openAuthenticated(`/files/view/${file.id}`)}>{t('annual.open_material')}</button><button type="button" onClick={() => downloadAuthenticated(`/files/download/${file.id}`, file.original_name)}>{t('download')}</button></span></div>)}</div> : <p className="lm-annual-detail-muted">{t('annual.no_materials')}</p>}</section><div className="lm-annual-detail-footer"><button type="button" onClick={() => editEntry(selectedEntry)} style={{ background: accent }}>Bearbeiten</button><button type="button" onClick={() => setSelectedEntry(null)}>Schließen</button></div></div></div>}
  </div>;
}
