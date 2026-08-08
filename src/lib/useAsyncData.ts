import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './errors'

/**
 * Loads data once, tracks loading and error state, and can be told to reload.
 *
 * `key` identifies the request: whenever it changes, the data is loaded again.
 * Include every value `load` depends on, the way you would with a dependency
 * array.
 *
 * This exists because every list in the app needs exactly this and nothing
 * more. If caching, deduplication or invalidation ever become real needs, this
 * is the single place a data library would replace.
 */
export function useAsyncData<T>(load: () => Promise<T>, key: string, fallbackMessage: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // `load` is a new closure on every render, so it is read through a ref rather
  // than being a dependency. `key` is what decides when to load again.
  const loadRef = useRef(load)
  const fallbackRef = useRef(fallbackMessage)
  useEffect(() => {
    loadRef.current = load
    fallbackRef.current = fallbackMessage
  })

  useEffect(() => {
    let active = true
    setLoading(true)

    loadRef
      .current()
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((caught) => {
        if (!active) return
        setError(errorMessage(caught, fallbackRef.current))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [key, reloadToken])

  const reload = useCallback(() => setReloadToken((token) => token + 1), [])

  return { data, loading, error, reload }
}
