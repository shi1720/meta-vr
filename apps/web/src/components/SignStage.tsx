/**
 * React wrapper around the three.js SignViewer. This module (and three.js)
 * is only ever loaded lazily — see LazySignStage.
 */

import { useEffect, useRef, useState } from 'react';
import type { SignDef } from '@signsprout/signkit';
import { SignViewer } from '../lib/viewer/SignViewer';
import type { ViewMode } from '../lib/viewer/SignViewer';

export interface SignStageProps {
  sign: SignDef;
  view: ViewMode;
  playing?: boolean;
  speed?: number;
  leftHanded?: boolean;
  interactive?: boolean;
  reducedMotion?: boolean;
  /** Bumping this number restarts the sign from the beginning. */
  restartKey?: number;
  /** Bumping this number puts the camera back where the current view starts. */
  resetKey?: number;
  onLoop?: (count: number) => void;
  /** Receives 0..1 progress every frame; write to the DOM, don't set state. */
  onProgress?: (fraction: number) => void;
}

export default function SignStage({
  sign,
  view,
  playing = true,
  speed = 1,
  leftHanded = false,
  interactive = false,
  reducedMotion = false,
  restartKey = 0,
  resetKey = 0,
  onLoop,
  onProgress,
}: SignStageProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<SignViewer | null>(null);
  const callbacks = useRef({ onLoop, onProgress });
  callbacks.current = { onLoop, onProgress };
  const latest = useRef({ sign, view, playing, speed, leftHanded });
  latest.current = { sign, view, playing, speed, leftHanded };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Create once; dispose all GPU resources on unmount.
  useEffect(() => {
    if (!host.current) return;
    let v: SignViewer;
    try {
      v = new SignViewer(host.current, {
        interactive,
        reducedMotion,
        onReady: () => setReady(true),
        onLoop: (n) => callbacks.current.onLoop?.(n),
        onProgress: (f) => callbacks.current.onProgress?.(f),
      });
    } catch {
      setFailed(true);
      return;
    }
    viewer.current = v;
    const p = latest.current;
    v.setLeftHanded(p.leftHanded);
    v.setSign(p.sign);
    v.setView(p.view, false);
    v.setPlaying(p.playing);
    v.setSpeed(p.speed);
    return () => {
      viewer.current = null;
      v.dispose();
    };
  }, [interactive, reducedMotion]);

  // Later prop changes (the first run of each is covered by construction).
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) viewer.current?.setSign(sign);
  }, [sign, restartKey]);

  useEffect(() => {
    if (!mounted.current) return;
    viewer.current?.setLeftHanded(leftHanded);
    viewer.current?.setView(latest.current.view, false);
  }, [leftHanded]);

  useEffect(() => {
    if (mounted.current) viewer.current?.setView(view, true);
  }, [view]);

  useEffect(() => {
    if (resetKey) viewer.current?.resetCamera();
  }, [resetKey]);

  useEffect(() => {
    viewer.current?.setPlaying(playing);
  }, [playing]);

  useEffect(() => {
    viewer.current?.setSpeed(speed);
  }, [speed]);

  // Declared last so it runs after the effects above on the first commit.
  useEffect(() => {
    mounted.current = true;
  }, []);

  if (failed) {
    return (
      <div className="stage-fallback" role="note">
        <p>
          The 3D preview needs WebGL, which isn’t available here. The written steps below describe the sign, and it
          plays in full on Meta Quest.
        </p>
      </div>
    );
  }

  return <div ref={host} className={`stage-canvas ${ready ? 'is-ready' : ''}`} />;
}
