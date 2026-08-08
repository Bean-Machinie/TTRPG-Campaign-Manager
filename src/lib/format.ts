const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/** Formats an ISO timestamp from Postgres for display. */
export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate))
}
