import { useEffect, useEffectEvent } from 'react'

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/**
 * Single-key shortcuts (e.g. "/" to search). Ignored while the user is typing
 * in a field or holding a modifier, so they never hijack normal input.
 */
export function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const target = e.target as HTMLElement
    if (TYPING_TAGS.has(target.tagName) || target.isContentEditable) return
    const action = shortcuts[e.key]
    if (action) {
      e.preventDefault()
      action()
    }
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
