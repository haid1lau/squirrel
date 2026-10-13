import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage, type Benefit } from '../lib/api'

/** Loads the benefit list once and exposes local updates after mutations. */
export function useBenefits() {
  const [benefits, setBenefits] = useState<Benefit[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api.listBenefits(controller.signal).then(
      (data) => {
        setBenefits(data)
        setError(null)
      },
      (e) => {
        if (!controller.signal.aborted) setError(errorMessage(e))
      },
    )
    return () => controller.abort()
  }, [attempt])

  const reload = useCallback(() => {
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  const upsert = useCallback((benefit: Benefit) => {
    setBenefits((curr) => {
      if (!curr) return [benefit]
      return curr.some((b) => b.id === benefit.id)
        ? curr.map((b) => (b.id === benefit.id ? benefit : b))
        : [...curr, benefit]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setBenefits((curr) => curr?.filter((b) => b.id !== id) ?? curr)
  }, [])

  return { benefits, error, reload, upsert, remove }
}
