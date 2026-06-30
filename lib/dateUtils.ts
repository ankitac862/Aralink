/**
 * Shared date formatting utilities. All display dates go through here
 * so the format is consistent across the entire app.
 *
 * fmtDate      → "June 28, 2026"          (detail sections: full month name)
 * fmtShortDate → "2026-06-28"             (lists / chart labels: yyyy-mm-dd)
 * fmtDateTime  → "June 28, 2026, 4:34 PM" (timestamps: comments, activity)
 */

function parseDate(iso: string): Date {
  // Append time so Date doesn't shift by timezone offset on date-only strings
  return new Date(iso.includes('T') ? iso : iso + 'T00:00:00');
}

export function fmtDate(iso: string | null | undefined, fallback = 'N/A'): string {
  if (!iso) return fallback;
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function fmtShortDate(iso: string | null | undefined, fallback = ''): string {
  if (!iso) return fallback;
  const d = parseDate(iso);
  if (isNaN(d.getTime())) return fallback;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDateTime(iso: string | null | undefined, fallback = 'N/A'): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** Convert a Date object → "MM/DD/YYYY" string for storing in form fields */
export function fmtDateInput(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}
