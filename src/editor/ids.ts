/**
 * Short random ids for block anchors.
 *
 * A uuid would work and the app already uses `crypto.randomUUID()` for storage
 * paths, but a uid ends up in a URL fragment — `#block-<uid>` — once per search
 * result, so it is worth keeping short. Twelve base-36 characters is about 62
 * bits: far more than a document with a few hundred blocks needs, and the
 * walker deduplicates anyway.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

const LENGTH = 12

export function newBlockUid(): string {
  const bytes = new Uint8Array(LENGTH)
  crypto.getRandomValues(bytes)

  // 256 is not a multiple of 36, so the first four letters come up very
  // slightly more often. That skews collision odds by nothing that matters at
  // this length, and rejection sampling would only make the code harder to read.
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
}
