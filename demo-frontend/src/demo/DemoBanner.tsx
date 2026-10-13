import { RotateCcw } from 'lucide-react'
import { resetDemo } from './server'

/** Says this is a demo, lists its sample accounts, and puts everything back to the start. */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="fixed bottom-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-line bg-popover/95 py-1 pr-1 pl-3.5 text-xs text-ink-muted shadow-lg backdrop-blur"
    >
      <span>
        <strong className="font-semibold text-ink">Demo</strong> · sign in as clayton@, priya@, marcus@ or sam@demo.com
        with any password
      </span>
      <button
        type="button"
        onClick={() => {
          resetDemo()
          window.location.assign('/')
        }}
        className="inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2.5 font-semibold text-ink hover:bg-surface-2"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Reset
      </button>
    </div>
  )
}
