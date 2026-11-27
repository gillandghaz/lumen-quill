/** Lumen Quill mark: a quill nib inside a round seal (matches the favicon). Original artwork. */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.7" />
      <path d="M16 6 C19.3 10.5 20.5 14 20.5 17 C20.5 20 18.5 22.5 16 26 C13.5 22.5 11.5 20 11.5 17 C11.5 14 12.7 10.5 16 6 Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M16 10.5 V20.5" stroke="var(--bg)" strokeWidth="1" strokeLinecap="round" />
      <circle cx="16" cy="20.8" r="1.2" fill="var(--bg)" />
    </svg>
  );
}
