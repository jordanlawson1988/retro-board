import type { MobileNavKey } from '@/components/Board/MobileBottomNav';

/**
 * Honest-toolbar active state for the mobile bottom nav.
 *
 * Board is the always-present base view and is "active" only when no sheet is
 * open. Actions/More light their own icon while their sheet is open. There is
 * no fake/hardcoded active state. More takes precedence over Actions when both
 * happen to be open.
 */
export function computeMobileNavActive({
  moreOpen,
  actionsOpen,
}: {
  moreOpen: boolean;
  actionsOpen: boolean;
}): MobileNavKey {
  if (moreOpen) return 'more';
  if (actionsOpen) return 'actions';
  return 'board';
}
