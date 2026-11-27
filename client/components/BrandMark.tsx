/** Lumen Quill mark: a lantern-diamond inside an orbit. Original artwork. */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" />
      <path d="M16 3.5 L22 16 L16 28.5 L10 16 Z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M16 9.5 L19 16 L16 22.5 L13 16 Z" fill="currentColor" fillOpacity="0.85" />
      <path d="M3 16 H8 M24 16 H29" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
