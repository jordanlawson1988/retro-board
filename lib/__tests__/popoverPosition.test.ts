import { describe, it, expect } from 'vitest';
import { computePopoverPosition } from '@/utils/popoverPosition';

// Defaults: gap = 6 (space between anchor and panel), margin = 8 (min viewport inset)
const viewport = { width: 1280, height: 800 };
const panel = { width: 220, height: 90 };

function anchor(left: number, top: number, width = 60, height = 22) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

describe('computePopoverPosition', () => {
  it('centers above the anchor when there is room', () => {
    const a = anchor(600, 400);
    const pos = computePopoverPosition(a, panel, viewport);
    expect(pos.placement).toBe('above');
    // centered: anchor center (630) minus half panel width (110)
    expect(pos.left).toBe(520);
    // above: anchor top (400) minus gap (6) minus panel height (90)
    expect(pos.top).toBe(304);
  });

  it('clamps to the left viewport margin instead of overflowing (reaction pill near column left edge)', () => {
    const a = anchor(10, 400);
    const pos = computePopoverPosition(a, panel, viewport);
    // centered would be 40 - 110 = -70 → clamped to margin
    expect(pos.left).toBe(8);
    expect(pos.placement).toBe('above');
  });

  it('clamps to the right viewport margin instead of overflowing', () => {
    const a = anchor(1240, 400, 30);
    const pos = computePopoverPosition(a, panel, viewport);
    // centered would be 1255 - 110 = 1145; max allowed = 1280 - 8 - 220 = 1052
    expect(pos.left).toBe(1052);
  });

  it('flips below the anchor when there is no room above (card at top of viewport)', () => {
    const a = anchor(600, 40);
    const pos = computePopoverPosition(a, panel, viewport);
    expect(pos.placement).toBe('below');
    // below: anchor bottom (62) plus gap (6)
    expect(pos.top).toBe(68);
  });

  it('stays above when space above exactly fits panel + gap + margin', () => {
    // top = 8 (margin) requires anchor.top = margin + gap + panelH = 104
    const a = anchor(600, 104);
    const pos = computePopoverPosition(a, panel, viewport);
    expect(pos.placement).toBe('above');
    expect(pos.top).toBe(8);
  });

  it('respects custom gap and margin options', () => {
    const a = anchor(600, 400);
    const pos = computePopoverPosition(a, panel, viewport, { gap: 10, margin: 16 });
    expect(pos.top).toBe(300);
    const edge = computePopoverPosition(anchor(0, 400), panel, viewport, { gap: 10, margin: 16 });
    expect(edge.left).toBe(16);
  });

  it('never returns a left edge past the margin even if the panel is wider than the viewport', () => {
    const pos = computePopoverPosition(anchor(100, 400), { width: 500, height: 90 }, { width: 400, height: 800 });
    expect(pos.left).toBe(8);
  });
});
