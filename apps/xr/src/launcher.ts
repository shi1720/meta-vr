/**
 * The 2D launcher overlay shown in the browser before entering VR.
 * On Quest: one big "Start" button. On a desktop: watch the demo, or open
 * the link on a headset.
 */

import { VisibilityState } from '@iwsdk/core';
import type { World } from '@iwsdk/core';

export interface LauncherOpts {
  xrSupported(): Promise<boolean>;
  enter(): void;
  demo(): void;
  inXR(): boolean;
  world: World;
}

export function initLauncher(o: LauncherOpts): void {
  const el = document.getElementById('launcher');
  const enterBtn = document.getElementById('enter-btn') as HTMLButtonElement | null;
  const demoBtn = document.getElementById('demo-btn') as HTMLButtonElement | null;
  const hint = document.getElementById('launcher-hint');
  const loading = document.getElementById('loading');
  if (!el || !enterBtn || !demoBtn) return;
  loading?.classList.add('done');
  el.classList.add('ready');

  void o.xrSupported().then((ok) => {
    if (ok) {
      enterBtn.style.display = 'inline-flex';
      if (hint) hint.textContent = 'Put your controllers down. Your hands are all you need.';
    } else {
      enterBtn.style.display = 'none';
      demoBtn.classList.add('primary');
      if (hint)
        hint.innerHTML =
          'Open this page in the <b>Meta Quest Browser</b> to learn with your hands.<br/>On this computer you can watch a simulated learner use the app.';
    }
  });

  enterBtn.addEventListener('click', () => o.enter());
  demoBtn.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.set('demo', '');
    url.searchParams.set('fresh', '');
    location.assign(url);
  });

  o.world.visibilityState.subscribe((s) => {
    el.classList.toggle('hidden', s !== VisibilityState.NonImmersive);
  });
  const q = new URLSearchParams(location.search);
  if (q.has('clean')) el.classList.add('hidden');
  else if (q.has('demo') || q.has('screen')) el.classList.add('minimised');
}
