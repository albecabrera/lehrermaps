/**
 * Shared LehrerMaps logo asset. Keeping the uploaded SVG as the single source
 * of truth preserves its proportions and brand artwork at every display size.
 */
export default function BrandMark({ size = 40, label = true, dark = false }) {
  return (
    <span className="lm-brand" aria-label={label ? 'LehrerMaps' : undefined} role={label ? 'img' : undefined}>
      <span className="lm-brand-mark" style={{ width: size, height: size }} aria-hidden="true">
        <img
          src="/lehrermaps_icon.svg"
          alt=""
          width={size}
          height={size}
          draggable="false"
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        />
      </span>
      {label && <span className="lm-brand-name" style={{ color: dark ? '#fff' : undefined }}>LehrerMaps</span>}
    </span>
  );
}
