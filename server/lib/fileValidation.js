import path from 'path';

export const SAFE_FILE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'odp', 'ods', 'rtf', 'txt', 'csv', 'md', 'mp3', 'wav', 'ogg', 'm4a', 'mp4', 'mov', 'webm']);
export const MIME_BY_EXTENSION = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  odt: 'application/vnd.oasis.opendocument.text', odp: 'application/vnd.oasis.opendocument.presentation', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  rtf: 'application/rtf', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
};

export function safeFileName(value) {
  return String(value || '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function detectedFileKind(buffer) {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'jpeg';
  if (/^GIF8[79]a/.test(buffer.subarray(0, 6).toString())) return 'gif';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return 'zip-office';
  if (buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'legacy-office';
  if (buffer.subarray(0, 3).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'mp3';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WAVE') return 'wav';
  if (buffer.subarray(0, 4).toString() === 'OggS') return 'ogg';
  if (buffer.subarray(4, 8).toString() === 'ftyp') return 'mp4';
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'webm';
  if (!buffer.includes(0)) return 'text';
  return 'unknown';
}

export function validateFileContent(name, buffer, maxSize = 300 * 1024 * 1024) {
  const normalized = safeFileName(name);
  const ext = path.extname(normalized).slice(1).toLowerCase();
  if (ext === 'pppx') throw new Error('.pppx ist wahrscheinlich ein Tippfehler; bitte .pptx verwenden');
  if (!SAFE_FILE_EXTENSIONS.has(ext)) throw new Error(`Dateityp .${ext || '(ohne Endung)'} nicht erlaubt`);
  if (!normalized || normalized !== name) throw new Error('Dateiname enthält nicht erlaubte Zeichen');
  if (!buffer.length || buffer.length > maxSize) throw new Error('Ungültige Dateigröße');
  const kind = detectedFileKind(buffer);
  const expected = {
    pdf: ['pdf'], png: ['png'], jpg: ['jpeg'], jpeg: ['jpeg'], gif: ['gif'],
    doc: ['legacy-office'], ppt: ['legacy-office'], xls: ['legacy-office'],
    docx: ['zip-office'], pptx: ['zip-office'], xlsx: ['zip-office'], odt: ['zip-office'], odp: ['zip-office'], ods: ['zip-office'],
    mp3: ['mp3'], wav: ['wav'], ogg: ['ogg'], m4a: ['mp4'], mp4: ['mp4'], mov: ['mp4'], webm: ['webm'],
    rtf: ['text'], txt: ['text'], csv: ['text'], md: ['text'],
  }[ext];
  if (!expected?.includes(kind)) throw new Error('Dateiinhalt stimmt nicht mit der Endung überein');
  return { name: normalized, extension: ext, kind };
}

export function validateDeclaredMime(name, mime) {
  const ext = path.extname(name).slice(1).toLowerCase();
  const expected = MIME_BY_EXTENSION[ext];
  if (!expected || String(mime || '').toLowerCase() !== expected) throw new Error('MIME-Typ stimmt nicht mit der Dateiendung überein');
  return expected;
}
