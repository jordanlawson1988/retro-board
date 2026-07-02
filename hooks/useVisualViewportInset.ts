'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the number of px the bottom of the layout viewport is currently
 * obscured by the on-screen keyboard (0 when no keyboard). Uses the
 * VisualViewport API so bottom-anchored sheets can lift above the keyboard on
 * iOS Safari, where `dvh`/`vh` do NOT account for the keyboard.
 */
export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const bottom = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(Math.max(0, Math.round(bottom)));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
