import { useEffect, useRef, useState } from 'react'

const DISARM_AFTER_MS = 4000

/**
 * Two-click confirmation for destructive actions: the first click "arms" the
 * button for a few seconds, the second runs the action.
 * Returns [armed, click] where click() is true when the action should run.
 */
export function useArmedAction(): [boolean, () => boolean, () => void] {
  const [armed, setArmed] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function click() {
    if (!armed) {
      setArmed(true)
      timer.current = window.setTimeout(() => setArmed(false), DISARM_AFTER_MS)
      return false
    }
    window.clearTimeout(timer.current)
    setArmed(false)
    return true
  }

  function reset() {
    window.clearTimeout(timer.current)
    setArmed(false)
  }

  return [armed, click, reset]
}
