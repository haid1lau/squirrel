import type { ReactNode } from 'react'
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      title={`Press ${children} to jump here`}
      className="hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-xs font-semibold text-ink-muted sm:inline-block"
    >
      {children}
    </kbd>
  )
}
