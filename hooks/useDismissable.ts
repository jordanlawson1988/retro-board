'use client';

import { useEffect } from 'react';

/**
 * When `active`, closes on Escape and on the browser/OS Back gesture.
 * Pushes a history entry on open and listens for `popstate`, so on Android the
 * hardware/gesture Back dismisses the sheet instead of leaving the board.
 */
export function useDismissable(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    // Push a sentinel history entry; Back pops it and triggers onClose.
    let popped = false;
    window.history.pushState({ sheet: true }, '');
    function onPop() {
      popped = true;
      onClose();
    }

    document.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      // If the sheet was closed by something other than Back, consume the
      // sentinel entry we pushed so the user's next Back doesn't no-op.
      if (!popped) window.history.back();
    };
  }, [active, onClose]);
}
