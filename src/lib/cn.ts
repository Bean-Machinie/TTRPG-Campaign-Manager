/**
 * Joins class names, dropping the falsy ones.
 *
 * The animated icons are written against a `cn` helper, as most Tailwind
 * codebases are. Theirs merges conflicting utilities; this one does not, and
 * does not need to — nothing here passes two competing classes for the same
 * property.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
