import { RotateCcw } from 'lucide-react'
import { resetDemo } from './server'

/** Says this is a demo with sample data, and puts it back to the start. */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-full border border-line bg-popover/95 py-1 pr-1 pl-3.5 text-xs text-ink-muted shadow-lg backdrop-blur"
    >
      <span>
        <strong className="font-semibold text-ink">Demo</strong> · sample data, any email and password signs in
      </span>
      <button
        type="button"
        onClick={() => {
          resetDemo()
          window.location.assign('/')
        }}
        className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2.5 font-semibold text-ink hover:bg-surface-2"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Reset
      </button>
    </div>
  )
}
