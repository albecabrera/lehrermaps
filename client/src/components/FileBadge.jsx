import { fileKindLabel, fileKindColor } from '../constants/structure';

export default function FileBadge({ kind, name, size = 28 }) {
  const label = fileKindLabel(kind, name);
  const color = fileKindColor(kind);
  const longLabel = label.length >= 4;
  return (
    <div style={{
      width: longLabel ? size + 6 : size, height: size + 4, flexShrink: 0,
      background: color, color: '#fff',
      borderRadius: 4,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      paddingBottom: 3,
      fontFamily: '"DM Mono", ui-monospace, SFMono-Regular, monospace',
      fontSize: longLabel ? 7.2 : 8.5, fontWeight: 600, letterSpacing: longLabel ? 0.2 : 0.4,
      position: 'relative',
      boxShadow: `inset -3px 3px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.08)`,
    }}>
      <span style={{
        position: 'absolute', top: 0, right: 0, width: 8, height: 8,
        background: 'rgba(255,255,255,0.25)',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
      }} />
      {label}
    </div>
  );
}
