import { LogoMark } from './Logo';

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader-mark">
        <LogoMark size={56} />
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
