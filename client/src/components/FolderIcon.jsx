export default function FolderIcon({ color = '#999', size = 24 }) {
  return (
    <svg width={size} height={size * 0.82} viewBox="0 0 24 20" fill="none">
      <path d="M0 4a2 2 0 0 1 2-2h7l2 2h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Z"
        fill={color} opacity="0.92"/>
      <path d="M0 6h24v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6Z" fill={color}/>
      <rect x="0" y="6" width="24" height="1" fill="rgba(255,255,255,0.35)"/>
    </svg>
  );
}
