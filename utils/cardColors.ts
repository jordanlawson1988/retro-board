/**
 * Returns appropriate text color mode based on card background color.
 * Uses relative luminance calculation per WCAG 2.0.
 */
export function getCardTextColor(bgColor: string | null): 'dark' | 'light' {
  if (!bgColor) return 'dark';

  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance > 0.4 ? 'dark' : 'light';
}

/** CSS class names for card text based on contrast mode */
export const CARD_TEXT_CLASSES = {
  dark: {
    text: 'text-[var(--color-gray-8)]',
    subtext: 'text-[var(--color-gray-4)]',
    icon: 'text-[var(--color-gray-4)]',
    iconHover: 'hover:text-[var(--color-gray-6)]',
  },
  light: {
    text: 'text-white',
    subtext: 'text-white/70',
    icon: 'text-white/70',
    iconHover: 'hover:text-white',
  },
} as const;
