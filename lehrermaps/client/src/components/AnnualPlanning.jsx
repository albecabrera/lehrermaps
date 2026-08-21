import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../contexts/LangContext';
import {
  annualPlanExportUrl,
  createAnnualPlan,
  createAnnualPlanEntry,
  deleteAnnualPlanEntry,
  deleteAnnualPlan,
  duplicateAnnualPlanEntry,
  getAnnualPlan,
  getAnnualPlanMaterials,
  updateAnnualPlan,
  updateAnnualPlanEntry,
} from '../lib/api';

const TYPES = [
  ['lesson', 'Unterrichtsstunde'], ['holiday', 'Ferien'], ['exam', 'Klausur'],
  ['classwork', 'Klassenarbeit'], ['presentation', 'Referat'],
  ['school_event', 'Schulveranstaltung'], ['other', 'Sonstiges'],
];
const typeLabel = Object.fromEntries(TYPES);

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
    lesson_number: '', title: '', notes: '', file_ids: [], folder_ids: [],
  };
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('de-DE');
}

export default function AnnualPlanning({ rootFolder, accent }) {
  const { t } = useLang();
  const [schoolYear, setSchoolYear] = useState(defaultSchoolYear);
  const [plan, setPlan] = useState(null);
  const [entries, setEntries] = useState([]);
  const [meta, setMeta] = useState({ start_date: '', end_date: '' });
  const [draft, setDraft] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [materialQuery, setMaterialQuery] = useState('');
  const [materials, setMaterials] = useState({ files: [], folders: [] });
  const [showMaterials, setShowMaterials] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setDraft(null);
    getAnnualPlan(rootFolder.id, schoolYear).then((data) => {
      if (!active) return;
      setPlan(data.plan); setEntries(data.entries || []);
      setMeta(data.plan ? { start_date: data.plan.start_date || '', end_date: data.plan.end_date || '' } : schoolYearDates(schoolYear));
    }).catch((err) => active && setError(err.response?.data?.error || err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [rootFolder.id, schoolYear]);

  useEffect(() => {
    let active = true;
    getAnnualPlanMaterials(rootFolder.id, materialQuery).then((data) => active && setMaterials(data)).catch(() => {});
    return () => { active = false; };
  }, [rootFolder.id, materialQuery]);

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    const typeOk = typeFilter === 'all' || entry.entry_type === typeFilter;
    const monthOk = monthFilter === 'all' || String(entry.entry_date).slice(0, 7) === monthFilter;
    return typeOk && monthOk;
  }), [entries, monthFilter, typeFilter]);
  const months = useMemo(() => [...new Set(entries.map((entry) => String(entry.entry_date).slice(0, 7)))].sort(), [entries]);

  const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleMaterial = (key, id) => setDraft((current) => ({
    ...current,
    [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
  }));

  const savePlan = async () => {
    setSaving(true); setError('');
    try {
      const saved = plan
        ? await updateAnnualPlan(plan.id, { school_year: schoolYear, ...meta })
        : await createAnnualPlan({ root_folder_id: rootFolder.id, school_year: schoolYear, ...meta });
      setPlan(saved);
    } catch (err) { setError(err.response?.data?.error || err.message); } finally { setSaving(false); }
  };

  const saveEntry = async (event) => {
    event.preventDefault();
    if (!draft?.title.trim() || !draft.entry_date) return;
    setSaving(true); setError('');
    try {
      const payload = { ...draft, end_date: draft.end_date || null };
      const saved = draft.id ? await updateAnnualPlanEntry(draft.id, payload) : await createAnnualPlanEntry(plan.id, payload);
      setEntries((current) => draft.id ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
      setDraft(null); setShowMaterials(false);
    } catch (err) { setError(err.response?.data?.error || err.message); } finally { setSaving(false); }
  };

  const removeEntry = async (entry) => {
    if (!window.confirm(`„${entry.title}“ wirklich löschen?`)) return;
    await deleteAnnualPlanEntry(entry.id);
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  };

  const duplicateEntry = async (entry) => {
    const copy = await duplicateAnnualPlanEntry(entry.id);
    setEntries((current) => [...current, copy]);
  };

  return (
    <div className="lm-annual-planning lm-annual-print" style={{ padding: '16px 20px 30px', color: 'var(--c-text)', minHeight: '100%', overflow: 'auto' }}>
      <div className="lm-annual-no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('annual.title')}</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 3 }}>{rootFolder.group_name} · {t('annual.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{t('annual.school_year')}
            <input value={schoolYear} onChange={(event) => setSchoolYear(event.target.value)} placeholder="2026/27" style={inputStyle} />
          </label>
          <button onClick={savePlan} disabled={saving || !/^\d{4}\/\d{2}$/.test(schoolYear)} style={buttonStyle(accent, '#fff')}>{plan ? t('save') : t('annual.create')}</button>
          {plan && <>
            <a href={annualPlanExportUrl(plan.id)} className="lm-annual-action" style={buttonStyle('var(--c-border)', 'var(--c-text-2)')}>{t('annual.export')}</a>
            <button onClick={() => { document.body.classList.add('lm-print-planning'); window.print(); window.setTimeout(() => document.body.classList.remove('lm-print-planning'), 500); }} className="lm-annual-action" style={buttonStyle('var(--c-border)', 'var(--c-text-2)')}>{t('notes.print')}</button>
          </>}
        </div>
      </div>

      {error && <div className="lm-annual-no-print" style={errorStyle}>{error}</div>}
      {!plan && !loading ? (
        <div className="lm-annual-empty" style={emptyStyle}>
          <div style={{ fontSize: 30 }}>🗓️</div>
          <strong>{t('annual.empty_title')}</strong>
          <span>{t('annual.empty_text')}</span>
          <button onClick={savePlan} disabled={saving} style={buttonStyle(accent, '#fff')}>{t('annual.create')}</button>
        </div>
      ) : loading ? <div style={{ padding: 30, color: 'var(--c-text-3)' }}>{t('loading')}</div> : (
        <>
          <div className="lm-annual-no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <label style={smallLabel}>{t('annual.start')}<input type="date" value={meta.start_date} onChange={(event) => setMeta({ ...meta, start_date: event.target.value })} style={inputStyle} /></label>
            <label style={smallLabel}>{t('annual.end')}<input type="date" value={meta.end_date} onChange={(event) => setMeta({ ...meta, end_date: event.target.value })} style={inputStyle} /></label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={inputStyle}><option value="all">{t('annual.all_types')}</option>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} style={inputStyle}><option value="all">{t('annual.all_months')}</option>{months.map((month) => <option key={month} value={month}>{month}</option>)}</select>
            <button className="lm-annual-action" onClick={() => setDraft(emptyEntry())} style={buttonStyle(accent, '#fff')}>＋ {t('annual.add')}</button>
          </div>

          {draft && <form onSubmit={saveEntry} className="lm-annual-editor lm-annual-no-print" style={{ border: `1px solid ${accent}55`, background: 'var(--c-surface-2)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <label style={smallLabel}>{t('annual.date')}<input type="date" required value={draft.entry_date} onChange={(event) => updateDraft('entry_date', event.target.value)} style={inputStyle} /></label>
              <label style={smallLabel}>{t('annual.end')}<input type="date" value={draft.end_date || ''} onChange={(event) => updateDraft('end_date', event.target.value)} style={inputStyle} /></label>
              <label style={smallLabel}>{t('annual.type')}<select value={draft.entry_type} onChange={(event) => updateDraft('entry_type', event.target.value)} style={inputStyle}>{TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label style={smallLabel}>{t('annual.lesson')}<input value={draft.lesson_number || ''} onChange={(event) => updateDraft('lesson_number', event.target.value)} placeholder="z. B. 1.–2." style={inputStyle} /></label>
              <label style={{ ...smallLabel, gridColumn: 'span 2' }}>{t('annual.title_field')}<input required value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} style={inputStyle} /></label>
              <label style={{ ...smallLabel, gridColumn: '1 / -1' }}>{t('annual.notes')}<textarea value={draft.notes || ''} onChange={(event) => updateDraft('notes', event.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></label>
            </div>
            <div style={{ marginTop: 10 }}>
              <button type="button" onClick={() => setShowMaterials((value) => !value)} style={buttonStyle('var(--c-border)', 'var(--c-text-2)')}>{t('annual.materials')} ({(draft.file_ids.length + draft.folder_ids.length)})</button>
              {showMaterials && <div style={{ marginTop: 8, border: '1px solid var(--c-border)', borderRadius: 8, padding: 10, background: 'var(--c-surface)', maxHeight: 180, overflow: 'auto' }}>
                <input value={materialQuery} onChange={(event) => setMaterialQuery(event.target.value)} placeholder={t('annual.material_search')} style={{ ...inputStyle, marginBottom: 8 }} />
                {materials.folders.map((folder) => <label key={`folder-${folder.id}`} style={checkStyle}><input type="checkbox" checked={draft.folder_ids.includes(folder.id)} onChange={() => toggleMaterial('folder_ids', folder.id)} /> 📁 {folder.name}</label>)}
                {materials.files.map((file) => <label key={`file-${file.id}`} style={checkStyle}><input type="checkbox" checked={draft.file_ids.includes(file.id)} onChange={() => toggleMaterial('file_ids', file.id)} /> 📄 {file.original_name}</label>)}
                {!materials.files.length && !materials.folders.length && <span style={{ color: 'var(--c-text-3)', fontSize: 12 }}>{t('annual.no_materials')}</span>}
              </div>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><button type="button" onClick={() => setDraft(null)} style={buttonStyle('var(--c-border)', 'var(--c-text-2)')}>{t('cancel')}</button><button type="submit" disabled={saving} style={buttonStyle(accent, '#fff')}>{t('save')}</button></div>
          </form>}

          <div className="lm-annual-table-wrap">
            <table className="lm-annual-table"><thead><tr><th>{t('annual.date')}</th><th>{t('annual.type')}</th><th>{t('annual.lesson')}</th><th>{t('annual.title_field')}</th><th>{t('annual.materials')}</th><th className="lm-annual-no-print" /></tr></thead><tbody>
              {filteredEntries.map((entry) => <tr key={entry.id}><td>{formatDate(entry.entry_date)}{entry.end_date && <><br /><span style={{ color: 'var(--c-text-3)', fontSize: 11 }}>– {formatDate(entry.end_date)}</span></>}</td><td><span className="lm-annual-type" data-type={entry.entry_type}>{typeLabel[entry.entry_type]}</span></td><td>{entry.lesson_number || '—'}</td><td><strong>{entry.title}</strong>{entry.notes && <div style={{ color: 'var(--c-text-3)', fontSize: 11, marginTop: 3 }}>{entry.notes}</div>}</td><td>{entry.file_ids?.length || entry.folder_ids?.length ? `📎 ${(entry.file_ids?.length || 0) + (entry.folder_ids?.length || 0)}` : '—'}</td><td className="lm-annual-no-print"><div style={{ display: 'flex', gap: 5 }}><button onClick={() => setDraft({ ...entry, end_date: entry.end_date || '', file_ids: entry.file_ids || [], folder_ids: entry.folder_ids || [] })} style={iconButton}>✎</button><button onClick={() => duplicateEntry(entry)} style={iconButton}>⧉</button><button onClick={() => removeEntry(entry)} style={{ ...iconButton, color: '#DC2626' }}>×</button></div></td></tr>)}
              {!filteredEntries.length && <tr><td colSpan="6" style={{ padding: 34, textAlign: 'center', color: 'var(--c-text-3)' }}>{t('annual.no_entries')}</td></tr>}
            </tbody></table>
          </div>
          <div className="lm-annual-cards">{filteredEntries.map((entry) => <article key={entry.id} className="lm-annual-card"><div><span className="lm-annual-type" data-type={entry.entry_type}>{typeLabel[entry.entry_type]}</span><strong>{entry.title}</strong></div><div style={{ color: 'var(--c-text-2)', fontSize: 12 }}>{formatDate(entry.entry_date)}{entry.end_date ? ` – ${formatDate(entry.end_date)}` : ''} · {entry.lesson_number || t('annual.no_lesson')}</div>{entry.notes && <p>{entry.notes}</p>}<div className="lm-annual-no-print" style={{ display: 'flex', gap: 6 }}><button onClick={() => setDraft({ ...entry, end_date: entry.end_date || '', file_ids: entry.file_ids || [], folder_ids: entry.folder_ids || [] })} style={iconButton}>✎</button><button onClick={() => duplicateEntry(entry)} style={iconButton}>⧉</button><button onClick={() => removeEntry(entry)} style={{ ...iconButton, color: '#DC2626' }}>×</button></div></article>)}</div>
        </>
      )}
    </div>
  );
}

const inputStyle = { height: 30, padding: '0 8px', border: '1px solid var(--c-border)', borderRadius: 6, background: 'var(--c-input-bg)', color: 'var(--c-text)', fontSize: 12, fontFamily: 'inherit', marginLeft: 5 };
const smallLabel = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: .4 };
const checkStyle = { display: 'block', fontSize: 12, color: 'var(--c-text-2)', padding: '4px 0' };
const buttonStyle = (border, color) => ({ height: 30, padding: '0 10px', border: `1px solid ${border}`, borderRadius: 6, background: border === color ? 'transparent' : border, color, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' });
const iconButton = { width: 26, height: 26, border: '1px solid var(--c-border)', borderRadius: 5, background: 'transparent', color: 'var(--c-text-2)', cursor: 'pointer' };
const emptyStyle = { minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px dashed var(--c-border)', borderRadius: 12, color: 'var(--c-text-2)', textAlign: 'center' };
const errorStyle = { padding: '9px 12px', borderRadius: 7, background: 'var(--c-danger-bg)', color: 'var(--c-danger-text)', fontSize: 12, marginBottom: 10 };
