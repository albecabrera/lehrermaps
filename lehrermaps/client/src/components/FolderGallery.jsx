import { useLang } from '../contexts/LangContext';

export default function FolderGallery({ files, activeFileId, onSelect, accent = '#E8472A' }) {
  const { t } = useLang();
  const imageFiles = files.filter((f) => {
    const name = (f.original_name || '').toLowerCase();
    const mime = (f.mime_type || '').toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(name);
  });

  if (!imageFiles.length) {
    return (
      <div style={{ padding: 24, color: 'var(--c-text-3)', fontSize: 13 }}>
        {t('table.no_images')}
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: 12,
    }}>
      {imageFiles.map((file) => {
        const on = file.id === activeFileId;
        return (
          <button
            key={file.id}
            onClick={() => onSelect(file)}
            style={{
              appearance: 'none',
              border: on ? `2px solid ${accent}` : '1px solid var(--c-border)',
              background: 'var(--c-surface)',
              borderRadius: 10,
              overflow: 'hidden',
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{
              height: 120,
              background: 'var(--c-surface-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <img
                src={`/api/files/view/${file.id}?token=${encodeURIComponent(localStorage.getItem('lm_token') || '')}`}
                alt={file.original_name}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {file.original_name}
            </div>
          </button>
        );
      })}
    </div>
  );
}
