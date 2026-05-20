// LehrerMaps – Datenmodell für Prototypen
// Drei Ebenen: Fach → Gruppe → Ordner. Dateien sind synthetische, aber
// realistische deutsche Beispieldokumente eines Lehrers (NRW, Bonn).
//
// Dateityp wird aus der Endung abgeleitet. Unterstützte Familien:
//   pdf · doc · slide · sheet · img · audio · video · archive ·
//   code · notebook · learn · ebook · qr · link · text · markdown

// ─────────────────────────────────────────────────────────────
// Dateityp-Erkennung
// ─────────────────────────────────────────────────────────────

const EXT_TO_KIND = {
  pdf: 'pdf',
  doc: 'doc', docx: 'doc', odt: 'doc', rtf: 'doc',
  txt: 'text', md: 'markdown',
  ppt: 'slide', pptx: 'slide', ppsx: 'slide', key: 'slide', odp: 'slide',
  xls: 'sheet', xlsx: 'sheet', csv: 'sheet', ods: 'sheet',
  jpg: 'img', jpeg: 'img', png: 'img', gif: 'img', webp: 'img', svg: 'img', bmp: 'img',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', webm: 'video',
  zip: 'archive', rar: 'archive', '7z': 'archive',
  html: 'code', css: 'code', js: 'code', ts: 'code', py: 'code',
  json: 'code', xml: 'code', yaml: 'code', yml: 'code', sql: 'code',
  sb3: 'code', // Scratch
  ipynb: 'notebook',
  h5p: 'learn', scorm: 'learn',
  epub: 'ebook',
};

function extOf(name) {
  if (!name) return '';
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function detectKind(name) {
  // Spezialfall: Links / QR-Codes haben kein eigenes Suffix, werden explizit gesetzt
  return EXT_TO_KIND[extOf(name)] || 'file';
}

// Anzeige-Label im Badge (max 5 Zeichen)
function fileKindLabel(kind, name) {
  if (kind === 'link') return 'URL';
  if (kind === 'qr') return 'QR';
  const ext = extOf(name);
  if (ext) return ext.toUpperCase().slice(0, 5);
  return {
    pdf: 'PDF', doc: 'DOC', slide: 'PPT', sheet: 'XLS',
    img: 'IMG', audio: 'AUD', video: 'MP4', archive: 'ZIP',
    code: 'CODE', notebook: 'IPY', learn: 'H5P', ebook: 'EPUB',
    text: 'TXT', markdown: 'MD',
  }[kind] || 'FILE';
}

// Akzentfarbe je Familie (für Badge & Akzentlinien)
function fileKindColor(kind) {
  return {
    pdf:      '#DC2626', // rot
    doc:      '#2563EB', // blau
    text:     '#475569', // schiefer
    markdown: '#0F766E', // teal
    slide:    '#EA580C', // orange
    sheet:    '#16A34A', // grün
    img:      '#D97706', // amber
    audio:    '#DB2777', // pink
    video:    '#7C3AED', // violett
    archive:  '#92400E', // braun
    code:     '#0891B2', // cyan
    notebook: '#F59E0B', // gelb-orange (Jupyter)
    learn:    '#8B5CF6', // lila (H5P/SCORM)
    ebook:    '#0D9488', // teal
    qr:       '#111827', // schwarz
    link:     '#3B82F6', // blau
    file:     '#6B7280', // grau
  }[kind] || '#6B7280';
}

// Menschenlesbare Typbezeichnung
function fileKindName(kind) {
  return {
    pdf: 'PDF-Dokument', doc: 'Text-Dokument', text: 'Textdatei', markdown: 'Markdown',
    slide: 'Präsentation', sheet: 'Tabelle', img: 'Bild', audio: 'Audio-Datei',
    video: 'Video', archive: 'Archiv', code: 'Programmierdatei',
    notebook: 'Jupyter-Notebook', learn: 'Interaktives Lernmodul', ebook: 'E-Book',
    qr: 'QR-Code', link: 'Externer Link',
  }[kind] || 'Datei';
}

// Tag-Helfer
const T = (...tags) => tags;

// ─────────────────────────────────────────────────────────────
// Beispieldaten
// ─────────────────────────────────────────────────────────────

function f(name, size, date, opts = {}) {
  const kind = opts.kind || detectKind(name);
  return { name, kind, size, date, tags: opts.tags || [], ...opts };
}

const SUBJECTS = [
  {
    id: 'spanisch', name: 'Spanisch', short: 'ES',
    color: '#E8472A', colorSoft: '#FCE5DE', colorDark: '#B82E13',
    groups: [
      { id: 'es-9', name: 'Klasse 9', folders: [
        { id: 'vokab', name: 'Vokabeltests', files: [
          f('Vokabeltest_Unidad_3.pdf', '184 KB', '12. Apr', { tags: T('Test', 'Unidad 3') }),
          f('Vokabelliste_Familia_Casa.docx', '32 KB', '04. Apr'),
          f('Wortschatz_Audio_Familia.mp3', '4.2 MB', '04. Apr', { tags: T('Audio') }),
          f('Karteikarten_Quizlet.url', '—', '02. Apr',
            { kind: 'link', url: 'https://quizlet.com/de/9b-vokabeln-unidad-3' }),
          f('Lösungen_Test_Unidad_2.pdf', '92 KB', '02. Apr'),
        ]},
        { id: 'arbeit', name: 'Arbeitsblätter', files: [
          f('AB_Subjuntivo_Übungen.docx', '48 KB', '10. Apr'),
          f('AB_Pretérito_Indefinido.pdf', '120 KB', '28. Mär'),
          f('Konjugation_Übung_interaktiv.h5p', '720 KB', '08. Apr', { tags: T('H5P', 'interaktiv') }),
          f('Vorlage_AB.odt', '24 KB', '01. Mär'),
        ]},
        { id: 'hoer', name: 'Hörverstehen', files: [
          f('RTVE_Reporte_Andalucia.mp4', '14.2 MB', '08. Apr'),
          f('Hörbeispiel_Mercado.m4a', '3.1 MB', '08. Apr'),
          f('Transkript_Audio_3.pdf', '64 KB', '08. Apr'),
          f('RTVE_Mediathek.url', '—', '07. Apr',
            { kind: 'link', url: 'https://www.rtve.es/play/audios/aprendemos-en-casa/' }),
        ]},
        { id: 'noten9', name: 'Noten', files: [
          f('Notenliste_9b_Q2.xlsx', '21 KB', '14. Apr'),
          f('Notenrechner.ods', '14 KB', '20. Mär'),
          f('Klassenliste_export.csv', '4 KB', '01. Feb'),
        ]},
      ]},
      { id: 'es-12', name: 'Klasse 12', folders: [
        { id: 'abi', name: 'Abiturvorb.', files: [
          f('Abitur_Übersicht_Themen.pdf', '210 KB', '15. Apr'),
          f('Klausur_Modell_NRW_2025.pdf', '380 KB', '11. Apr'),
          f('Wortschatz_Migración.docx', '88 KB', '03. Apr'),
          f('Abitur-Aufgabenpool.url', '—', '03. Apr',
            { kind: 'link', url: 'https://www.schulministerium.nrw.de/abitur-2026' }),
        ]},
        { id: 'lit', name: 'Literatur', files: [
          f('García_Márquez_Crónica.epub', '1.4 MB', '20. Mär', { tags: T('E-Book') }),
          f('García_Márquez_Crónica.pdf', '1.2 MB', '20. Mär'),
          f('Analyse_Realismo_Mágico.docx', '54 KB', '22. Mär'),
          f('Vortrag_Boom_Latinoamericano.pptx', '2.4 MB', '02. Apr', { tags: T('Präsentation') }),
        ]},
        { id: 'muend', name: 'Mündliche Prüfung', files: [
          f('Prüfungsbögen_Themen.pdf', '180 KB', '07. Apr'),
          f('Bewertungsraster.ods', '32 KB', '01. Apr'),
        ]},
        { id: 'noten12', name: 'Noten', files: [
          f('Notenliste_12_GK.xlsx', '24 KB', '14. Apr'),
          f('Punkte_Mündlich.csv', '3 KB', '14. Apr'),
        ]},
      ]},
      { id: 'es-gem', name: 'Gemeinsame Ressourcen', folders: [
        { id: 'gram', name: 'Grammatik-Tabellen', files: [
          f('Konjugation_alle_Zeiten.pdf', '95 KB', '01. Mär'),
          f('Ser_vs_Estar.pdf', '42 KB', '01. Mär'),
          f('Pretérito_Übersicht.png', '210 KB', '20. Feb', { tags: T('Tafelbild') }),
        ]},
        { id: 'med', name: 'Medien', files: [
          f('Karte_Lateinamerika.png', '480 KB', '15. Feb'),
          f('Karte_Lateinamerika.svg', '38 KB', '15. Feb'),
          f('Flamenco_Doku.mp4', '32.4 MB', '20. Feb'),
          f('Spanien_Vlog.mov', '21.0 MB', '14. Feb'),
        ]},
        { id: 'spiele', name: 'Spiele', files: [
          f('Tabu-Karten_Vocabulario.pdf', '88 KB', '12. Feb'),
          f('Memory_Imágenes.zip', '4.6 MB', '12. Feb', { tags: T('Archiv') }),
          f('Wortschatz-Quiz.h5p', '512 KB', '10. Feb', { tags: T('H5P', 'interaktiv') }),
          f('QR_Quizlet_Klasse9b.qr', '—', '02. Apr',
            { kind: 'qr', url: 'https://quizlet.com/de/9b-vokabeln-unidad-3' }),
        ]},
      ]},
    ],
  },
  {
    id: 'informatik', name: 'Informatik', short: 'INF',
    color: '#2563EB', colorSoft: '#DCE7FB', colorDark: '#1D4ED8',
    groups: [
      { id: 'inf-67', name: 'WP Klasse 6–7', folders: [
        { id: 'scratch', name: 'Scratch', files: [
          f('Scratch_Projekt_Pong.sb3', '210 KB', '13. Apr'),
          f('AB_Schleifen_Bedingungen.pdf', '110 KB', '11. Apr'),
          f('Scratch_Online.url', '—', '05. Apr',
            { kind: 'link', url: 'https://scratch.mit.edu/projects/editor/' }),
          f('Erklärvideo_Sprites.webm', '8.4 MB', '06. Apr'),
        ]},
        { id: 'html', name: 'HTML Basics', files: [
          f('HTML_Grundgerüst_Vorlage.html', '4 KB', '08. Apr'),
          f('CSS_Box_Modell.pdf', '76 KB', '08. Apr'),
          f('Übungsaufgaben_Tags.docx', '28 KB', '06. Apr'),
          f('style.css', '2 KB', '06. Apr'),
          f('MDN_HTML_Grundlagen.url', '—', '05. Apr',
            { kind: 'link', url: 'https://developer.mozilla.org/de/docs/Learn/HTML' }),
        ]},
        { id: 'inf-ab', name: 'Arbeitsblätter', files: [
          f('AB_Algorithmus_Sandwich.pdf', '64 KB', '02. Apr'),
          f('Lehrvortrag_Algorithmen.pptx', '1.8 MB', '01. Apr'),
        ]},
        { id: 'roblox', name: 'Roblox', files: [
          f('Lua_Erste_Skripte.pdf', '142 KB', '24. Mär'),
          f('Skript_Beispiel.lua', '6 KB', '24. Mär', { kind: 'code' }),
        ]},
      ]},
      { id: 'inf-810', name: 'WP Klasse 8–10', folders: [
        { id: 'py', name: 'Python', files: [
          f('turtle_grafik_aufgaben.py', '6 KB', '17. Apr'),
          f('Datenanalyse.ipynb', '18 KB', '15. Apr', { tags: T('Jupyter') }),
          f('AB_Listen_Schleifen.pdf', '88 KB', '15. Apr'),
          f('Klausur_Python_2026.pdf', '210 KB', '12. Apr'),
          f('Lösungen_Klausur.docx', '46 KB', '12. Apr'),
          f('Projekt_Archiv.zip', '2.4 MB', '11. Apr'),
        ]},
        { id: 'db', name: 'Datenbanken', files: [
          f('SQL_Grundlagen.pdf', '120 KB', '05. Apr'),
          f('Schulbibliothek.sql', '12 KB', '05. Apr'),
          f('ERM_Schulbibliothek.png', '280 KB', '05. Apr'),
          f('Beispieldaten.json', '8 KB', '04. Apr'),
        ]},
        { id: 'netz', name: 'Netzwerke', files: [
          f('OSI_Modell_Übersicht.pdf', '68 KB', '21. Mär'),
          f('Wireshark_Capture.pcap', '2.1 MB', '20. Mär', { kind: 'archive', tags: T('Capture') }),
          f('config.yaml', '1 KB', '20. Mär'),
        ]},
        { id: 'proj', name: 'Projekte', files: [
          f('Projektplan_Webseite_10c.docx', '32 KB', '14. Apr'),
          f('Daten_export.csv', '14 KB', '14. Apr'),
          f('Logo.svg', '4 KB', '10. Apr'),
        ]},
      ]},
      { id: 'inf-proj', name: 'Projekte & Tools', folders: [
        { id: 'repos', name: 'Schüler-Repos', files: [
          f('Repo_Übersicht_9d.xlsx', '14 KB', '01. Apr'),
          f('GitHub_Classroom.url', '—', '01. Apr',
            { kind: 'link', url: 'https://classroom.github.com/classrooms' }),
        ]},
        { id: 'vorlagen', name: 'Vorlagen', files: [
          f('README_Vorlage.md', '2 KB', '20. Mär'),
          f('package.json', '1 KB', '20. Mär'),
          f('LICENSE.txt', '1 KB', '20. Mär'),
        ]},
        { id: 'links', name: 'Links', files: [
          f('Linkliste_Tools.html', '8 KB', '15. Mär'),
          f('Replit.url', '—', '14. Mär',
            { kind: 'link', url: 'https://replit.com/~' }),
          f('Code-Karaoke_W3C.url', '—', '14. Mär',
            { kind: 'link', url: 'https://www.w3.org/TR/html52/' }),
        ]},
      ]},
    ],
  },
  {
    id: 'sport', name: 'Sport', short: 'SPO',
    color: '#16A34A', colorSoft: '#D6F0DE', colorDark: '#0F7C36',
    groups: [
      { id: 'sp-th', name: 'Theorie', folders: [
        { id: 'regel', name: 'Regelkunde', files: [
          f('Volleyball_Regeln_2026.pdf', '92 KB', '14. Apr'),
          f('Basketball_Regelübersicht.pdf', '88 KB', '14. Apr'),
          f('Regel-Quiz.h5p', '320 KB', '14. Apr', { tags: T('interaktiv') }),
          f('Schiedsrichter-Zeichen.pptx', '4.2 MB', '12. Apr'),
        ]},
        { id: 'bio', name: 'Sportbiologie', files: [
          f('Herz_Kreislauf_Tafelbild.pdf', '120 KB', '10. Apr'),
          f('Energiebereitstellung.docx', '38 KB', '08. Apr'),
          f('Muskelaufbau.epub', '2.1 MB', '01. Mär', { tags: T('E-Book') }),
          f('Beispiel_Trainingstagebuch.ods', '18 KB', '01. Apr'),
        ]},
        { id: 'klaus', name: 'Klausuren', files: [
          f('Klausur_Q1_Trainingslehre.pdf', '180 KB', '03. Apr'),
          f('Bewertungsbogen.rtf', '12 KB', '01. Apr'),
        ]},
      ]},
      { id: 'sp-pr', name: 'Praxis / Stunden', folders: [
        { id: 'plan', name: 'Stundenplanungen', files: [
          f('UE_Parcours_Klasse_7.docx', '42 KB', '17. Apr'),
          f('UE_Leichtathletik_Hochsprung.docx', '36 KB', '12. Apr'),
          f('UE_Aufwärmspiele_Sammlung.pdf', '210 KB', '01. Apr'),
          f('Aufwärm-Playlist.url', '—', '01. Apr',
            { kind: 'link', url: 'https://open.spotify.com/playlist/aufwaermen' }),
        ]},
        { id: 'mat', name: 'Materialien', files: [
          f('Stationskarten_Turnen.pdf', '320 KB', '24. Mär'),
          f('Stationskarten_Turnen.png', '180 KB', '24. Mär'),
          f('Pfeifsignal.wav', '180 KB', '20. Mär'),
        ]},
        { id: 'bew', name: 'Bewertung', files: [
          f('Bewertungsbogen_Q2.xlsx', '22 KB', '14. Apr'),
          f('Tabelle_Punkte.csv', '6 KB', '14. Apr'),
          f('Notenrechner_LA.ods', '12 KB', '01. Apr'),
        ]},
      ]},
      { id: 'sp-tanz', name: 'Q2 Tanz', folders: [
        { id: 'choreo', name: 'Choreografien', files: [
          f('Choreo_Gruppe_A_Notation.pdf', '88 KB', '11. Apr'),
          f('Musik_Choreo_A.mp3', '6.8 MB', '11. Apr'),
          f('Choreo_Layout.svg', '24 KB', '10. Apr'),
        ]},
        { id: 'selbst', name: 'Selbsteinschätzung', files: [
          f('Reflexionsbogen_Tanz.docx', '24 KB', '08. Apr'),
          f('Reflexionsbogen.odt', '22 KB', '08. Apr'),
        ]},
        { id: 'vid', name: 'Videos', files: [
          f('Aufführung_Probe_03.mp4', '42.8 MB', '15. Apr'),
          f('Aufführung_Probe_02.mov', '38.1 MB', '08. Apr'),
          f('Probe_Schnitt.mkv', '128 MB', '14. Apr'),
        ]},
      ]},
    ],
  },
  {
    id: 'klasse', name: 'Klassenleitung', short: 'KL',
    color: '#9333EA', colorSoft: '#EADCFB', colorDark: '#6B21A8',
    groups: [
      { id: 'kl-form', name: 'Formulare', folders: [
        { id: 'ents', name: 'Entschuldigungen', files: [
          f('Vorlage_Entschuldigung.pdf', '22 KB', '01. Feb'),
          f('Vorlage_Entschuldigung.odt', '18 KB', '01. Feb'),
          f('Sammlung_Schuljahr_2526.pdf', '440 KB', '14. Apr'),
        ]},
        { id: 'aus', name: 'Ausflüge', files: [
          f('Genehmigung_Klassenfahrt.docx', '36 KB', '10. Apr'),
          f('Packliste_Berlin.pdf', '54 KB', '10. Apr'),
          f('Reiseinfo_DB.url', '—', '10. Apr',
            { kind: 'link', url: 'https://www.bahn.de/buchung/klassenfahrt' }),
          f('Fotos_Vorjahr.zip', '124 MB', '01. Sep'),
        ]},
        { id: 'dsg', name: 'Datenschutz', files: [
          f('Einverständnis_Fotos.pdf', '28 KB', '05. Sep'),
          f('DSGVO_Hinweise.rtf', '14 KB', '05. Sep'),
        ]},
      ]},
      { id: 'kl-elt', name: 'Elternkommunikation', folders: [
        { id: 'briefe', name: 'Briefe', files: [
          f('Elternbrief_Klassenfahrt_Berlin.docx', '44 KB', '12. Apr'),
          f('Elternbrief_Halbjahreszeugnis.pdf', '92 KB', '28. Jan'),
          f('Vorlage_Elternbrief.odt', '24 KB', '01. Sep'),
        ]},
        { id: 'prot', name: 'Protokolle', files: [
          f('Elternabend_Protokoll_März.pdf', '120 KB', '18. Mär'),
          f('Aufnahme_Elternabend.m4a', '18.4 MB', '18. Mär', { tags: T('Audio') }),
          f('Notizen.md', '4 KB', '18. Mär'),
        ]},
        { id: 'kont', name: 'Kontaktliste', files: [
          f('Kontakte_Eltern_9b.xlsx', '36 KB', '01. Sep'),
          f('Kontakte_export.csv', '4 KB', '01. Sep'),
        ]},
      ]},
      { id: 'kl-dok', name: 'Dokumentation', folders: [
        { id: 'notiz', name: 'Notizen', files: [
          f('Notizen_Gespräche_April.docx', '52 KB', '17. Apr'),
          f('Schnellnotiz.txt', '2 KB', '17. Apr'),
          f('Ideen.md', '6 KB', '15. Apr'),
        ]},
        { id: 'vorf', name: 'Vorfälle', files: [
          f('Vorfall_Protokoll_15-04.pdf', '64 KB', '15. Apr'),
          f('Foto_Beweis.jpg', '320 KB', '15. Apr'),
        ]},
        { id: 'jahr', name: 'Jahresplanung', files: [
          f('Jahresplan_25-26.xlsx', '48 KB', '01. Sep'),
          f('Terminübersicht_HJ2.pdf', '110 KB', '01. Feb'),
          f('Schulkalender.url', '—', '01. Sep',
            { kind: 'link', url: 'https://www.schulministerium.nrw.de/ferientermine' }),
          f('QR_Stundenplan.qr', '—', '01. Sep',
            { kind: 'qr', url: 'https://lehrermaps.local/plan/9b' }),
        ]},
      ]},
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Aggregat-Helpers
// ─────────────────────────────────────────────────────────────

function subjectStats(s) {
  let folderCount = 0, fileCount = 0;
  for (const g of s.groups) {
    folderCount += g.folders.length;
    for (const f of g.folders) fileCount += f.files.length;
  }
  return { folderCount, fileCount, groupCount: s.groups.length };
}

function recentFiles(s, limit = 5) {
  const out = [];
  for (const g of s.groups) for (const f of g.folders) for (const file of f.files)
    out.push({ ...file, group: g.name, folder: f.name });
  const monthOrder = { 'Apr': 4, 'Mär': 3, 'Feb': 2, 'Jan': 1, 'Sep': 0 };
  out.sort((a, b) => {
    const [ad, am] = a.date.split('. '); const [bd, bm] = b.date.split('. ');
    return ((monthOrder[bm] ?? 0) - (monthOrder[am] ?? 0)) || (parseInt(bd) - parseInt(ad));
  });
  return out.slice(0, limit);
}

// Liste aller unterstützten Endungen (für Upload-Modal)
const SUPPORTED_TYPES = [
  { group: 'Dokumente',       exts: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md'],         kind: 'doc' },
  { group: 'Präsentationen',  exts: ['ppt', 'pptx', 'ppsx', 'key', 'odp'],                     kind: 'slide' },
  { group: 'Tabellen',        exts: ['xls', 'xlsx', 'csv', 'ods'],                             kind: 'sheet' },
  { group: 'Bilder',          exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],       kind: 'img' },
  { group: 'Audio',           exts: ['mp3', 'wav', 'm4a', 'ogg'],                              kind: 'audio' },
  { group: 'Video',           exts: ['mp4', 'mov', 'avi', 'mkv', 'webm'],                      kind: 'video' },
  { group: 'Archive',         exts: ['zip', 'rar', '7z'],                                      kind: 'archive' },
  { group: 'Code',            exts: ['html', 'css', 'js', 'ts', 'py', 'json', 'xml', 'yaml', 'sql'], kind: 'code' },
  { group: 'Notebooks',       exts: ['ipynb'],                                                 kind: 'notebook' },
  { group: 'Lern-Module',     exts: ['h5p', 'scorm'],                                          kind: 'learn' },
  { group: 'E-Books',         exts: ['epub'],                                                  kind: 'ebook' },
];

Object.assign(window, {
  SUBJECTS, subjectStats, recentFiles,
  fileKindLabel, fileKindColor, fileKindName,
  detectKind, extOf, SUPPORTED_TYPES,
});
