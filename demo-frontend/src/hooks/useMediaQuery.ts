import { useSyncExternalStore } from 'react'

/** Whether a CSS media query matches right now, following changes (like a window resize). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', cb)
      return () => list.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
  )
}
