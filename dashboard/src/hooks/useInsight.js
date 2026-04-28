import { useState, useCallback } from 'react'
import { generateInsight } from '../utils/insights.js'

/**
 * Hook for fetching AI insights.
 * Returns { insight, loading, error, refresh }
 *
 * @param {'client'|'manager'|'admin'} role
 * @param {string} prompt — context summary to analyse
 * @param {boolean} autoFetch — fetch on mount (default true)
 */
export function useInsight(role, prompt, autoFetch = true) {
  const [insight, setInsight] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch_ = useCallback(async () => {
    if (!prompt) return
    setLoading(true)
    setError(null)
    try {
      const text = await generateInsight(role, prompt)
      setInsight(text)
    } catch (err) {
      setError(err.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [role, prompt])

  // Auto-fetch on first render if enabled
  const [fetched, setFetched] = useState(false)
  if (autoFetch && !fetched && prompt) {
    setFetched(true)
    fetch_()
  }

  return { insight, loading, error, refresh: fetch_ }
}
