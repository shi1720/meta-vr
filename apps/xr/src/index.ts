/**
 * Signsprout. WebXR entry point.
 *
 * Boot order matters: the optional emulator must be installed before
 * World.create (IWSDK offers the XR session during initialisation).
 */

import { createSystem, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { App } from './app/app.js';
import { tracking } from './app/hands.js';
import { unlockAudio, startAmbient } from './audio/sfx.js';
import { Autopilot } from './demo/autopilot.js';
import { seededHistory } from './demo/seed.js';
import { store } from './app/store.js';
import { headQuat, maybeInstallEmulator, setEmulatedHead } from './demo/emulation.js';
import { account } from './net/account.js';
import { HandInputSystem, setAutopilot, setEmulatorInjector } from './systems/hand-input.js';
import { initLauncher } from './launcher.js';

const params = new URLSearchParams(location.search);

async function boot(): Promise<void> {
  const device = await maybeInstallEmulator();
  const container = document.getElementById('scene-container') as HTMLDivElement;
  const world = await World.create(container, projectOptions);
  (window as unknown as { __world: World }).__world = world;
  if (import.meta.env.DEV || params.has('debug')) {
    (window as unknown as { __core: unknown }).__core = await import('@iwsdk/core');
  }

  world.registerSystem(HandInputSystem, { priority: -10 });
  // Demo/video: start from a six-week learner history instead of a new one.
  if (params.get('seed') === 'garden') {
    const plan = params.get('plan') === 'bath' ? ['bath', 'sleep', 'book'] : [];
    store.replace(seededHistory(Date.now(), 30, Number(params.get('away')) || 0, plan));
  }
  // Demo/tests: turn on hands-free look-to-select.
  if (params.has('gaze')) store.updateSettings({ lookToSelect: true });
  const app = new App(world);
  (window as unknown as { __app: App }).__app = app;
  await app.init();

  class AppSystem extends createSystem({}) {
    update(dt: number, time: number): void {
      app.update(Math.min(dt, 0.1), time);
    }
  }
  world.registerSystem(AppSystem, { priority: 10 });

  void account.init();

  // Demo / autopilot: a simulated learner (desktop preview, tests, recording).
  let pilot: Autopilot | null = null;
  const startDemo = () => {
    if (pilot) return;
    pilot = new Autopilot(app, { emulator: !!device, slips: !params.has('noslip'), pace: +(params.get('pace') ?? 1) });
    if (device) setEmulatorInjector(pilot.inject);
    else setAutopilot(pilot.provide);
    if (params.has('fresh')) {
      app.go('welcome');
    } else {
      app.goHome();
    }
  };
  if (params.has('demo')) startDemo();
  // Demo/video: open a specific screen.
  const screen = params.get('screen');
  if (screen === 'garden') app.showGarden();
  else if (screen === 'settings') app.showSettings();
  else if (screen === 'library') app.showLibrary();
  // Emulator recordings: enter the immersive session automatically.
  if (device && params.has('autoxr')) {
    const d = device as unknown as { sessionOffered?: boolean; grantOfferedSession?: () => void };
    const tryEnter = () => {
      if (world.session) return;
      if (d.sessionOffered && d.grantOfferedSession) d.grantOfferedSession();
      else world.launchXR();
    };
    setTimeout(tryEnter, 300);
    // Recording framing: turn the head after the stage has recentered.
    const yaw = Number(params.get('yaw')) || 0;
    if (yaw) setTimeout(() => setEmulatedHead([0, 1.2, 0], headQuat(yaw, Number(params.get('pitch')) || 0)), 2500);
  }

  initLauncher({
    xrSupported: async () => {
      if (device) return true;
      try {
        return !!(await navigator.xr?.isSessionSupported('immersive-vr'));
      } catch {
        return false;
      }
    },
    enter: () => {
      unlockAudio();
      startAmbient();
      world.launchXR();
    },
    demo: () => {
      unlockAudio();
      startAmbient();
      startDemo();
    },
    inXR: () => !!world.session,
    world,
  });
  void tracking;
}

void boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('boot-error');
  if (el) {
    el.textContent = `Something went wrong while loading: ${String(err?.message ?? err)}`;
    el.style.display = 'block';
  }
});
