/** Turn anything thrown (Supabase errors included) into a message we can render. */
export function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof Error && caught.message) return caught.message
  if (typeof caught === 'string' && caught) return caught
  return fallback
}
