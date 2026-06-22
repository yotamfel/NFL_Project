import { useState, useEffect, useRef } from 'react'

// Runs `fn` (an async function) whenever `deps` change, and exposes
// { data, loading, error } - the standard three-state async pattern.
// An AbortController ensures a stale in-flight request never overwrites
// a newer result when deps change quickly (e.g. typing in a search box).
export function useApi(fn, deps) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    fn()
      .then(result => {
        if (!controller.signal.aborted) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err.message ?? 'Something went wrong')
          setLoading(false)
        }
      })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
