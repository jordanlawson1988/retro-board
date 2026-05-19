/**
 * Stable per-user hue derived from user ID.
 * 11 distinct hues spaced 32° apart for clear visual separation.
 */
export function userHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return (h % 11) * 32;
}

export function avatarBackground(userId: string): string {
  return `oklch(0.62 0.13 ${userHue(userId)})`;
}
