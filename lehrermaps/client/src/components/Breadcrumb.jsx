export default function Breadcrumb({ items, accent = '#E8472A' }) {
  const muted = '#6B7280';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 12, color: muted, minWidth: 0,
    }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            color: i === items.length - 1 ? '#111827' : muted,
            fontWeight: i === items.length - 1 ? 600 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{item}</span>
          {i < items.length - 1 && (
            <span style={{ color: muted, opacity: 0.5 }}>›</span>
          )}
        </span>
      ))}
    </div>
  );
}
