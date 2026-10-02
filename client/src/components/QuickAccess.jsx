import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';

const contactCategories = { accounts: 'Konten', school: 'Schule', emergency: 'Notfall', parents: 'Elternkontakte', responsibilities: 'Zuständigkeiten', other: 'Sonstiges' };
const emptyContact = { category: 'school', name: '', phone: '', email: '', class_name: '', notes: '', is_favorite: false };
const card = { background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 14, padding: 16 };
const control = { minHeight: 40, border: '1px solid var(--c-border)', borderRadius: 8, background: 'var(--c-surface)', color: 'var(--c-text)', padding: '8px 10px', font: 'inherit' };
const button = { ...control, cursor: 'pointer' };
const detailLabel = { color: 'var(--c-text-2)', fontSize: 12, margin: 0 };
const detailValue = { margin: 0, minWidth: 0, overflowWrap: 'anywhere' };
const formatError = (error) => error.response?.data?.error || error.message || 'Aktion fehlgeschlagen';
const extension = (name) => name.split('.').pop().toLowerCase();

function parseCsv(value) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '"') {
      if (quoted && value[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && value[index + 1] === '\n') index += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV enthält nicht geschlossene Anführungszeichen');
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}
function stringifyCsv(rows) {
  return rows.map((row) => row.map((cell) => /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell).join(',')).join('\r\n');
}

export default function QuickAccess() {
  const [contacts, setContacts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tab, setTab] = useState('contacts');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [contact, setContact] = useState(emptyContact);
  const [editingId, setEditingId] = useState(null);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const contactFormRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [versions, setVersions] = useState([]);
  const [content, setContent] = useState('');
  const [grid, setGrid] = useState(false);
  const [csvRows, setCsvRows] = useState([]);
  const [pdfUrl, setPdfUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [c, d] = await Promise.all([api.get('/teacher-hub/contacts'), api.get('/teacher-hub/documents')]);
    setContacts(c.data); setDocuments(d.data);
  }
  useEffect(() => {
    let alive = true;
    Promise.all([api.get('/teacher-hub/contacts'), api.get('/teacher-hub/documents')])
      .then(([c, d]) => { if (alive) { setContacts(c.data); setDocuments(d.data); } })
      .catch((error) => { if (alive) setNotice(formatError(error)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  useEffect(() => { if (contactFormOpen) contactFormRef.current?.scrollIntoView({ block: 'nearest' }); }, [contactFormOpen, editingId]);

  const classes = useMemo(() => [...new Set(contacts.map((item) => item.class_name).filter(Boolean))].sort(), [contacts]);
  const filtered = contacts.filter((item) => (!classFilter || item.class_name === classFilter)
    && [item.name, item.category, item.class_name, item.notes, item.phone, item.email].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  async function saveContact(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    try {
      if (editingId) await api.put(`/teacher-hub/contacts/${editingId}`, contact);
      else await api.post('/teacher-hub/contacts', contact);
      setContact(emptyContact); setEditingId(null); setContactFormOpen(false); await refresh();
    } catch (error) { setNotice(formatError(error)); } finally { setBusy(false); }
  }
  async function changeContact(item, patch) {
    try { await api.put(`/teacher-hub/contacts/${item.id}`, { ...item, ...patch }); await refresh(); }
    catch (error) { setNotice(formatError(error)); }
  }
  async function useContact(item) {
    try { await api.post(`/teacher-hub/contacts/${item.id}/used`); await refresh(); }
    catch (error) { setNotice(formatError(error)); }
  }
  async function copy(value, item) {
    try { await navigator.clipboard.writeText(value); await useContact(item); setNotice('Kopiert'); }
    catch { setNotice('Kopieren nicht möglich. Bitte Browserberechtigung prüfen.'); }
  }
  async function uploadDocument(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return setNotice('Maximal 20 MB pro Datei');
    const form = new FormData(); form.append('file', file);
    setBusy(true); setNotice('');
    try { await api.post('/teacher-hub/documents', form); await refresh(); }
    catch (error) { setNotice(formatError(error)); } finally { setBusy(false); }
  }
  async function readDocument(doc) {
    setSelected(doc); setGrid(false); setContent(''); setCsvRows([]); setVersions([]); setNotice('');
    if (pdfUrl) setPdfUrl('');
    try {
      const list = await api.get(`/teacher-hub/documents/${doc.id}/versions`); setVersions(list.data);
      if (['txt', 'csv', 'pdf'].includes(extension(doc.name))) {
        const response = await api.get(`/teacher-hub/documents/${doc.id}/content`, { responseType: 'blob' });
        if (extension(doc.name) === 'pdf') setPdfUrl(URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })));
        else { const value = await response.data.text(); setContent(value); if (extension(doc.name) === 'csv') setCsvRows(parseCsv(value)); }
      }
    } catch (error) { setNotice(formatError(error)); }
  }
  async function download(doc, version) {
    try {
      const response = await api.get(`/teacher-hub/documents/${doc.id}/content`, { params: { download: 1, ...(version ? { version } : {}) }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = doc.name; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (error) { setNotice(formatError(error)); }
  }
  async function saveVersion(doc, file) {
    setBusy(true); setNotice('');
    try {
      if (file) {
        if (file.size > 20 * 1024 * 1024 || extension(file.name) !== extension(doc.name)) throw new Error('Dateiendung muss gleich sein und die Datei darf maximal 20 MB groß sein');
        const form = new FormData(); form.append('file', file); await api.post(`/teacher-hub/documents/${doc.id}/versions`, form);
      } else await api.post(`/teacher-hub/documents/${doc.id}/versions`, { content: grid && extension(doc.name) === 'csv' ? stringifyCsv(csvRows) : content });
      await refresh(); await readDocument({ ...doc, current_version: doc.current_version + 1 }); setNotice('Neue Version gespeichert');
    } catch (error) { setNotice(formatError(error)); } finally { setBusy(false); }
  }
  return <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 'clamp(16px, 3vw, 32px)', color: 'var(--c-text)' }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gap: 18 }}>
      <header><div className="lm-eyebrow">LEHRERHUB</div><h1 style={{ margin: '6px 0' }}>Schnellzugriff & Dokumente</h1><p style={{ color: 'var(--c-text-2)' }}>Kontakte und Unterlagen bleiben in deinem geschützten Bereich.</p></header>
      {notice && <p role="status" style={{ ...card, borderColor: 'var(--c-accent)', margin: 0 }}>{notice}</p>}
      <nav aria-label="LehrerHub-Bereiche" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[['contacts', 'Kontakte'], ['documents', 'Dokumente']].map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined} style={{ ...button, background: tab === id ? 'var(--c-accent)' : 'var(--c-surface)', color: tab === id ? 'white' : 'var(--c-text)' }}>{label}</button>)}
      </nav>
      {tab === 'contacts' ? <section style={card} aria-labelledby="quick-access-contacts-title">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <h2 id="quick-access-contacts-title" style={{ margin: 0 }}>Kontakte</h2>
          <button type="button" style={{ ...button, background: 'var(--c-accent)', color: 'white', borderColor: 'var(--c-accent)' }} onClick={() => { setContact(emptyContact); setEditingId(null); setContactFormOpen(true); }}>Kontakt hinzufügen</button>
        </div>
        {contactFormOpen && <form ref={contactFormRef} onSubmit={saveContact} style={{ ...card, background: 'var(--c-surface-2)', marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Kontakt bearbeiten' : 'Kontakt hinzufügen'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            <select aria-label="Kategorie" value={contact.category} onChange={(event) => setContact({ ...contact, category: event.target.value })} style={control}>{Object.entries(contactCategories).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            {[['name', 'Name'], ['phone', 'Telefon'], ['email', 'E-Mail'], ['class_name', 'Klasse oder Kurs'], ['notes', 'Notiz']].map(([key, label]) => <input key={key} aria-label={label} placeholder={label} required={key === 'name'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={contact[key]} onChange={(event) => setContact({ ...contact, [key]: event.target.value })} style={control} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button type="submit" disabled={busy} style={button}>Speichern</button><button type="button" style={button} onClick={() => { setContact(emptyContact); setEditingId(null); setContactFormOpen(false); }}>Abbrechen</button></div>
        </form>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><input aria-label="Kontakte suchen" placeholder="Kontakte suchen" value={search} onChange={(event) => setSearch(event.target.value)} style={{ ...control, flex: '1 1 180px' }} /><select aria-label="Klasse oder Kurs filtern" value={classFilter} onChange={(event) => setClassFilter(event.target.value)} style={control}><option value="">Alle Klassen und Kurse</option>{classes.map((name) => <option key={name}>{name}</option>)}</select></div>
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {filtered.map((item) => <article key={item.id} style={{ ...card, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
              <div style={{ minWidth: 0 }}><strong style={{ overflowWrap: 'anywhere' }}>{item.name}</strong><div style={{ color: 'var(--c-text-2)', fontSize: 13 }}>{contactCategories[item.category] || item.category}{item.class_name ? ` · ${item.class_name}` : ''}</div></div>
              <button type="button" style={{ ...button, minHeight: 32, padding: '4px 8px' }} aria-label={`${item.name} ${item.is_favorite ? 'aus Favoriten entfernen' : 'favorisieren'}`} onClick={() => changeContact(item, { is_favorite: !item.is_favorite })}>{item.is_favorite ? '★' : '☆'}</button>
            </div>
            {(item.phone || item.email || item.notes) && <dl style={{ display: 'grid', gap: 8, margin: '12px 0 0' }}>
              {item.phone && <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', alignItems: 'center', gap: 8 }}><dt style={detailLabel}>Telefon</dt><dd style={detailValue}><a href={`tel:${item.phone.replace(/[^+\d]/g, '')}`} onClick={() => useContact(item)} style={{ color: 'var(--c-accent)' }}>{item.phone}</a></dd><button type="button" style={{ ...button, minHeight: 30, padding: '3px 8px' }} aria-label={`Telefonnummer von ${item.name} kopieren`} onClick={() => copy(item.phone, item)}>Kopieren</button></div>}
              {item.email && <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', alignItems: 'center', gap: 8 }}><dt style={detailLabel}>E-Mail</dt><dd style={detailValue}><a href={`mailto:${encodeURIComponent(item.email)}`} onClick={() => useContact(item)} style={{ color: 'var(--c-accent)', overflowWrap: 'anywhere' }}>{item.email}</a></dd><button type="button" style={{ ...button, minHeight: 30, padding: '3px 8px' }} aria-label={`E-Mail-Adresse von ${item.name} kopieren`} onClick={() => copy(item.email, item)}>Kopieren</button></div>}
              {item.notes && <div style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr)', gap: 8 }}><dt style={detailLabel}>Notiz</dt><dd style={{ ...detailValue, whiteSpace: 'pre-wrap' }}>{item.notes}</dd></div>}
            </dl>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c-border-soft)' }}><button type="button" style={{ ...button, minHeight: 32, padding: '4px 8px' }} onClick={() => { setEditingId(item.id); setContact(item); setContactFormOpen(true); }}>Bearbeiten</button><button type="button" style={{ ...button, minHeight: 32, padding: '4px 8px' }} onClick={async () => { if (!window.confirm('Kontakt löschen?')) return; try { await api.delete(`/teacher-hub/contacts/${item.id}`); if (editingId === item.id) { setContact(emptyContact); setEditingId(null); setContactFormOpen(false); } await refresh(); } catch (error) { setNotice(formatError(error)); } }}>Löschen</button></div>
          </article>)}
          {!filtered.length && <p style={{ color: 'var(--c-text-2)', margin: 0 }}>Keine Kontakte gefunden.</p>}
        </div>
      </section> : <><section style={card}><h2 style={{ marginTop: 0 }}>Dokumente</h2><label style={{ ...button, display: 'inline-block' }}>Datei hochladen<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={uploadDocument} disabled={busy} style={{ display: 'block', maxWidth: '100%', marginTop: 8 }} /></label><p style={{ color: 'var(--c-text-2)' }}>PDF, Office, CSV und Text · maximal 20 MB. Office-Dateien lokal bearbeiten und als neue Version hochladen.</p><div style={{ display: 'grid', gap: 8 }}>{documents.map((doc) => <div key={doc.id} style={{ ...card, padding: 12, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div><strong>{doc.name}</strong><div style={{ color: 'var(--c-text-2)' }}>Version {doc.current_version}{doc.category ? ` · ${doc.category}` : ''}</div></div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}><button style={button} type="button" onClick={() => readDocument(doc)}>Öffnen</button><button style={button} type="button" onClick={() => download(doc)}>Download</button><button style={button} type="button" onClick={async () => { if (!window.confirm('Dokument und alle Versionen löschen?')) return; try { await api.delete(`/teacher-hub/documents/${doc.id}`); if (selected?.id === doc.id) setSelected(null); await refresh(); } catch (error) { setNotice(formatError(error)); } }}>Löschen</button></div></div>)}{!documents.length && <p>Noch keine Dokumente.</p>}</div></section>
        {selected && <section style={card}><h2 style={{ marginTop: 0, overflowWrap: 'anywhere' }}>{selected.name}</h2><label>Kategorie / Ordner <input style={control} defaultValue={selected.category} key={selected.id} onBlur={async (event) => { try { await api.patch(`/teacher-hub/documents/${selected.id}`, { category: event.target.value }); await refresh(); } catch (error) { setNotice(formatError(error)); } }} /></label>
          {extension(selected.name) === 'pdf' && <>{pdfUrl && <iframe title={`PDF ${selected.name}`} src={pdfUrl} style={{ width: '100%', height: 'min(70vh, 700px)', border: '1px solid var(--c-border)', marginTop: 12 }} />}<p>PDFs können hier angezeigt und versioniert, aber nicht browsernativ bearbeitet werden.</p></>}
          {['txt', 'csv'].includes(extension(selected.name)) && <><div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>{extension(selected.name) === 'csv' && <button style={button} type="button" onClick={() => { if (grid) setContent(stringifyCsv(csvRows)); else { try { setCsvRows(parseCsv(content)); } catch (error) { setNotice(error.message); return; } } setGrid(!grid); }}>{grid ? 'Textansicht' : 'Tabellenraster'}</button>}</div>{grid && extension(selected.name) === 'csv' ? <div style={{ overflowX: 'auto' }}><table><tbody>{csvRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => <td key={columnIndex}><input aria-label={`Zeile ${rowIndex + 1}, Spalte ${columnIndex + 1}`} style={{ ...control, minWidth: 110 }} value={cell} onChange={(event) => setCsvRows((previous) => previous.map((r, i) => i === rowIndex ? r.map((c, j) => j === columnIndex ? event.target.value : c) : r))} /></td>)}</tr>)}</tbody></table><button style={button} type="button" onClick={() => setCsvRows([...csvRows, Array(Math.max(1, ...csvRows.map((row) => row.length))).fill('')])}>Zeile hinzufügen</button></div> : <textarea aria-label="Dokumenttext" value={content} onChange={(event) => setContent(event.target.value)} rows={12} style={{ ...control, width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />}<button type="button" disabled={busy} style={{ ...button, marginTop: 8 }} onClick={() => saveVersion(selected)}>Als neue Version speichern</button></>}
          {['doc', 'docx', 'xls', 'xlsx'].includes(extension(selected.name)) && <p>Office-Datei herunterladen, lokal bearbeiten und anschließend die neue Version hochladen.</p>}
          <div style={{ marginTop: 14 }}><label>Neue Dateiversion auswählen <input type="file" accept={`.${extension(selected.name)}`} disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) saveVersion(selected, file); }} /></label></div><h3>Versionen</h3><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{versions.map((version) => <button key={version.id} type="button" style={button} onClick={() => download(selected, version.version_number)}>Version {version.version_number} herunterladen</button>)}</div>
        </section>}
      </>}
    </div>
  </main>;
}
