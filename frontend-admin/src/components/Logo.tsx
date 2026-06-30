export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="logo" aria-label="Link Town" style={{ ["--logo-size" as string]: `${size}px` }}>
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <rect x="3" y="3" width="26" height="26" rx="6" fill="#C82A2A" />
        <path d="M11 9v14h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <span className="logo__name">Link Town</span>
    </span>
  );
}
