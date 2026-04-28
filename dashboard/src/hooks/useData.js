import { useState, useEffect } from 'react'

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
 * Load multiple datasets in parallel.
 * @param {Record<string, Function>} loaders — { key: loaderFn }
 */
export function useMultiData(loaders) {
  const keys = Object.keys(loaders)
  const [results, setResults] = useState(() => Object.fromEntries(keys.map((k) => [k, null])))
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const promises = keys.map((k) =>
      loaders[k]()
        .then((data) => ({ key: k, data, error: null }))
        .catch((err) => ({ key: k, data: null, error: err.message ?? String(err) }))
    )

    Promise.all(promises).then((settled) => {
      if (cancelled) return
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

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data: results, loading, errors }
}
