/** The Signsprout mark: a sprout with a mint and a green leaf in a deep-green circle. */
export function LogoMark({ size = 36, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <circle cx="32" cy="32" r="30" fill="#1E8C63" />
      <path d="M32 52 C32 42 32 36 32 30" stroke="#FFF8EE" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M31 31 C22 30 15 23 14 12 C24 12 31 19 31 31 Z" fill="#7FF2E1" />
      <path d="M33 29 C34 17 42 10 51 10 C51 21 44 28 33 29 Z" fill="#3DBE8B" stroke="#FFF8EE" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <span className="wordmark">
      <LogoMark size={size} />
      <span className="wordmark-text">Signsprout</span>
    </span>
  );
}
