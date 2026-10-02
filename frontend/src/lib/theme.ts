import { useSyncExternalStore } from 'react'

// Light or dark. Follows the system setting until the user picks one with the
// header toggle; the choice is then kept in this browser. index.html applies a
// saved choice before the first paint, so the page doesn't flash.

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'squirrel-theme'
const BG = { light: '#FFFFFF', dark: '#0B1324' } // matches --color-bg
const systemDark = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function current(): Theme {
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'light' || chosen === 'dark') return chosen
  return systemDark.matches ? 'dark' : 'light'
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  systemDark.addEventListener('change', listener)
  return () => {
    listeners.delete(listener)
    systemDark.removeEventListener('change', listener)
  }
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage blocked (private mode): the choice lasts until the page reloads.
  }
  // The browser's own UI colour (mobile address bar) follows the app.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', BG[theme]))
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, current)
}
