// Helpers for the "Email or Phone Number" input on login/register screens.
// Detects which format the user is entering so the field can restrict input
// to digits (+ country code) for phone numbers, or allow free text for emails.

export type IdentifierMode = 'phone' | 'email' | null;

export function detectIdentifierMode(value: string): IdentifierMode {
  if (/[a-zA-Z@]/.test(value)) return 'email';
  if (/[\d+]/.test(value)) return 'phone';
  return null;
}

// Filters a TextInput's new value based on the previous value, so that once a
// user starts typing a phone number, only digits and a leading '+' (country
// code) are accepted, while emails are left untouched.
export function filterIdentifierInput(previousValue: string, nextValue: string): string {
  // Always allow deletions/replacements that shorten or keep the same length.
  if (nextValue.length <= previousValue.length) return nextValue;

  const mode = detectIdentifierMode(previousValue) || detectIdentifierMode(nextValue);
  if (mode !== 'phone') return nextValue;

  const hasLeadingPlus = nextValue.trimStart().startsWith('+');
  const digits = nextValue.replace(/\D/g, '');
  return hasLeadingPlus ? `+${digits}` : digits;
}
