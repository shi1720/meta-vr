import { lazy, Suspense } from 'react';
import type { SignStageProps } from './SignStage';

const SignStage = lazy(() => import('./SignStage'));

/** Shown while three.js and the hand models stream in. */
export function StagePlaceholder() {
  return (
    <div className="stage-placeholder" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="stage-ghost">
        <ellipse cx="100" cy="72" rx="26" ry="31" />
        <path d="M50 200c0-48 22-86 50-86s50 38 50 86" />
      </svg>
    </div>
  );
}

export function LazySignStage(props: SignStageProps) {
  return (
    <Suspense fallback={<StagePlaceholder />}>
      <SignStage {...props} />
    </Suspense>
  );
}
