const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** Formats an ISO timestamp from Postgres for display. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}

/**
 * Formats a plain yyyy-mm-dd date column. Built from the parts rather than
 * parsed, because `new Date('2026-08-08')` is UTC midnight and would show as
 * the previous day west of Greenwich.
 */
export function formatDateOnly(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}

/** Today in the same yyyy-mm-dd shape as a Postgres date column. */
export function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
