/** Shared LehrerMaps map-and-book mark. */
export default function BrandMark({ size = 40, label = true, dark = false }) {
  return (
    <span className="lm-brand" aria-label={label ? 'LehrerMaps' : undefined} role={label ? 'img' : undefined}>
      <span className="lm-brand-mark" style={{ width: size, height: size }} aria-hidden="true">
        <img
          src="/assets/icons/lehrermaps-mark.svg"
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
