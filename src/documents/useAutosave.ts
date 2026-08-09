import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

/**
 * Saves a value a short while after it stops changing.
 *
 * A document is written into continuously, so there is no Save button to hang a
 * write off. Debouncing is what keeps that from becoming one request per
 * keystroke — and it is the same reason the block index will be rebuilt on save
 * rather than on change.
 *
 * Two things this has to get right, both of which show up as lost work:
 *
 *   - Saves never overlap. A second write starting before the first returns can
 *     land in either order, and the loser silently wins. A save in flight parks
 *     the next value instead, and picks it up on the way out.
 *   - Leaving the page flushes. Closing a document a beat after typing must not
 *     drop the last sentence.
 */

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

const DEFAULT_DELAY_MS = 1200

export function useAutosave<T>(save: (value: T) => Promise<void>, delayMs = DEFAULT_DELAY_MS) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const pending = useRef<{ value: T } | null>(null)
  const saving = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `save` is a new closure every render, so it is read through a ref rather
  // than being a dependency — the same reasoning as useAsyncData.
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  const flush = useCallback(async () => {
    if (saving.current) return

    const next = pending.current
    if (!next) return

    pending.current = null
    saving.current = true
    setStatus('saving')

    try {
      await saveRef.current(next.value)
      setError(null)
      // Something arrived while this was in flight; it is still unsaved.
      setStatus(pending.current ? 'pending' : 'saved')
    } catch (caught) {
      setError(errorMessage(caught, 'Could not save your changes.'))
      setStatus('error')
    } finally {
      saving.current = false
    }

    if (pending.current) void flush()
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      setStatus('pending')

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        void flush()
      }, delayMs)
    },
    [delayMs, flush],
  )

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      // Not awaited: a cleanup function cannot be async, and the request
      // outlives the component either way.
      void flush()
    }
  }, [flush])

  return { schedule, status, error }
}

export const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
}
