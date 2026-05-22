/** A 5-digit, zero-padded numeric join code (e.g. "04207"). */
export function generateJoinCode(): string {
  return String(Math.floor(Math.random() * 100000)).padStart(5, '0');
}

/** True when `code` is a well-formed 5-digit join code. */
export function isValidJoinCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{5}$/.test(code);
}
