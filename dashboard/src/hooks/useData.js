import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Generic data loading hook.
 * @param {Function} loaderFn — async function that returns data
 * @param {Array} deps — extra dependencies that trigger a reload
 */
export function useData(loaderFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    loaderFn()
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? String(err))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}

/**
 * Load multiple datasets in parallel, with optional auto-refresh.
 * @param {Record<string, Function>} loaders — { key: loaderFn }
 * @param {number} refreshIntervalMs — auto-refresh interval (default 5 minutes, 0 = disabled)
 */
export function useMultiData(loaders, refreshIntervalMs = 5 * 60 * 1000) {
  const keys = Object.keys(loaders)
  const [results, setResults] = useState(() => Object.fromEntries(keys.map((k) => [k, null])))
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})

  // Stable ref to loaders so the callback doesn't stale-close over old loader fns
  const loadersRef = useRef(loaders)
  loadersRef.current = loaders

  const loadAll = useCallback(() => {
    const currentKeys = Object.keys(loadersRef.current)
    const promises = currentKeys.map((k) =>
      loadersRef.current[k]()
        .then((data) => ({ key: k, data, error: null }))
        .catch((err) => ({ key: k, data: null, error: err.message ?? String(err) }))
    )

    return Promise.all(promises).then((settled) => {
      const next = {}
      const errs = {}
      settled.forEach(({ key, data, error }) => {
        next[key] = data
        if (error) errs[key] = error
      })
      setResults(next)
      setErrors(errs)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    loadAll()

    if (refreshIntervalMs > 0) {
      const timer = setInterval(() => {
        console.info(`[useMultiData] Auto-refreshing data (${refreshIntervalMs / 1000}s interval)`)
        loadAll()
      }, refreshIntervalMs)
      return () => clearInterval(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data: results, loading, errors, refresh: loadAll }
}
