export const EXT_TO_KIND = {
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
  sb3: 'code',
  ipynb: 'notebook',
  h5p: 'learn', scorm: 'learn',
  epub: 'ebook',
};

export function extOf(name) {
  if (!name) return '';
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

export function detectKind(name) {
  return EXT_TO_KIND[extOf(name)] || 'file';
}

export function fileKindLabel(kind, name) {
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

export function fileKindColor(kind) {
  return {
    pdf:      '#DC2626',
    doc:      '#2563EB',
    text:     '#475569',
    markdown: '#0F766E',
    slide:    '#EA580C',
    sheet:    '#16A34A',
    img:      '#D97706',
    audio:    '#DB2777',
    video:    '#7C3AED',
    archive:  '#92400E',
    code:     '#0891B2',
    notebook: '#F59E0B',
    learn:    '#8B5CF6',
    ebook:    '#0D9488',
    qr:       '#111827',
    link:     '#3B82F6',
    file:     '#6B7280',
  }[kind] || '#6B7280';
}

export function fileKindName(kind) {
  return {
    pdf: 'PDF-Dokument', doc: 'Text-Dokument', text: 'Textdatei', markdown: 'Markdown',
    slide: 'Präsentation', sheet: 'Tabelle', img: 'Bild', audio: 'Audio-Datei',
    video: 'Video', archive: 'Archiv', code: 'Programmierdatei',
    notebook: 'Jupyter-Notebook', learn: 'Interaktives Lernmodul', ebook: 'E-Book',
    qr: 'QR-Code', link: 'Externer Link',
  }[kind] || 'Datei';
}

export const SUBJECTS = [
  {
    id: 'spanisch', name: 'Spanisch', short: 'ES',
    color: '#E8472A', colorSoft: '#FCE5DE', colorDark: '#B82E13',
    groups: [
      { id: 'es-9', name: 'Klasse 9' },
      { id: 'es-12', name: 'Klasse 12' },
      { id: 'es-gem', name: 'Gemeinsame Ressourcen' },
    ],
  },
  {
    id: 'informatik', name: 'Informatik', short: 'INF',
    color: '#2563EB', colorSoft: '#DCE7FB', colorDark: '#1D4ED8',
    groups: [
      { id: 'inf-67', name: 'WP Klasse 6–7' },
      { id: 'inf-810', name: 'WP Klasse 8–10' },
      { id: 'inf-proj', name: 'Projekte & Tools' },
    ],
  },
  {
    id: 'sport', name: 'Sport', short: 'SPO',
    color: '#16A34A', colorSoft: '#D6F0DE', colorDark: '#0F7C36',
    groups: [
      { id: 'sp-th', name: 'Theorie' },
      { id: 'sp-pr', name: 'Praxis / Stunden' },
      { id: 'sp-tanz', name: 'Q2 Tanz' },
    ],
  },
  {
    id: 'klasse', name: 'Klassenleitung', short: 'KL',
    color: '#9333EA', colorSoft: '#EADCFB', colorDark: '#6B21A8',
    groups: [
      { id: 'kl-form', name: 'Formulare' },
      { id: 'kl-elt', name: 'Elternkommunikation' },
      { id: 'kl-dok', name: 'Dokumentation' },
    ],
  },
];

export const SUPPORTED_TYPES = [
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
