export default function TextBlock({ value, onChange, onSlashTrigger, placeholder = 'Escribí…' }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === '/' && (value || '').trim() === '') {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onSlashTrigger?.({ x: rect.left + 8, y: rect.top + 24 });
        }
      }}
      placeholder={placeholder}
      style={{
        width: '100%',
        minHeight: 84,
        border: 'none',
        outline: 'none',
        resize: 'none',
        background: 'transparent',
        color: 'var(--c-text)',
        fontSize: 14,
        lineHeight: 1.45,
        fontFamily: 'inherit',
      }}
    />
  );
}
