// utils/popoverPosition.ts
// Fixed-position placement for portaled popovers/tooltips: centered above the
// anchor, clamped to the viewport, flipped below when there is no room above.

export interface PopoverAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
}

export interface PopoverPosition {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

interface PopoverPositionOptions {
  /** Space between the anchor and the panel. */
  gap?: number;
  /** Minimum inset from the viewport edges. */
  margin?: number;
}

export function computePopoverPosition(
  anchor: PopoverAnchorRect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  { gap = 6, margin = 8 }: PopoverPositionOptions = {}
): PopoverPosition {
  const centered = anchor.left + anchor.width / 2 - panel.width / 2;
  const maxLeft = viewport.width - margin - panel.width;
  const left = Math.max(margin, Math.min(centered, maxLeft));

  const aboveTop = anchor.top - gap - panel.height;
  if (aboveTop >= margin) {
    return { left, top: aboveTop, placement: 'above' };
  }
  return { left, top: anchor.bottom + gap, placement: 'below' };
}
