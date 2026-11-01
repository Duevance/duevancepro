/** Only same-site relative paths are accepted for post-login redirects (prevents open redirects). */
export function safeNext(n: string | null | undefined, fallback = '/dashboard'): string {
  return n && /^\/[a-zA-Z0-9/_-]*$/.test(n) && !n.startsWith('//') ? n : fallback;
}
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyuiop', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'letmein123', 'abc12345', '11111111', '00000000']);
/** Returns an error message, or null when acceptable. 72 is bcrypt's byte limit used by Supabase. */
export function validatePassword(pw: string, email = ''): string | null {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (new TextEncoder().encode(pw).length > 72) return 'Use 72 characters or fewer.';
  if (!pw.trim()) return 'Password cannot be only spaces.';
  if (COMMON.has(pw.toLowerCase())) return 'That password is too common. Choose a less guessable one.';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) return 'Do not include your email name in your password.';
  return null;
}
