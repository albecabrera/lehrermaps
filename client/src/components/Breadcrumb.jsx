// Breadcrumb — navigierbar, nicht nur Anzeige.
// items: Array aus Strings (nur Anzeige) oder { label, onClick } (klickbar).
// Das letzte Item ist immer der aktuelle Ort und nie klickbar.
export default function Breadcrumb({ items, accent = '#E8472A' }) {
  return (
    <nav aria-label="Breadcrumb" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: 'var(--c-text-2)', minWidth: 0,
    }}>
      {items.map((raw, i) => {
        const item = typeof raw === 'string' ? { label: raw } : raw;
        const isLast = i === items.length - 1;
        const clickable = !!item.onClick && !isLast;
        return (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {clickable ? (
              <button
                onClick={item.onClick}
                style={{
                  appearance: 'none', border: 'none', background: 'transparent',
                  padding: '2px 4px', margin: '-2px -4px', borderRadius: 5,
                  font: 'inherit', color: 'var(--c-text-2)', cursor: 'pointer',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  transition: 'color .12s, background .12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = accent;
                  e.currentTarget.style.background = `${accent}12`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--c-text-2)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >{item.label}</button>
            ) : (
              <span aria-current={isLast ? 'location' : undefined} style={{
                color: isLast ? 'var(--c-text)' : 'var(--c-text-2)',
                fontWeight: isLast ? 600 : 400,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{item.label}</span>
            )}
            {!isLast && (
              <span aria-hidden="true" style={{ color: 'var(--c-text-3)', opacity: 0.6 }}>›</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
