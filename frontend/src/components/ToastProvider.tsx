import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn'
import { ToastContext, type Toast, type ToastTone } from '../lib/toast'

const AUTO_DISMISS_MS = 4000

const toneStyle: Record<ToastTone, string> = {
  success: 'text-ok',
  error: 'text-danger',
  info: 'text-ink-muted',
}
const toneIcon = { success: CircleCheck, error: CircleAlert, info: Info }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((curr) => curr.filter((t) => t.id !== id))
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
  }, [])

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current++
      setToasts((curr) => [...curr.slice(-2), { id, tone, message }])
      timers.current.set(id, window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS))
    },
    [dismiss],
  )

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((t) => window.clearTimeout(t))
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => {
          const Icon = toneIcon[t.tone]
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm animate-rise items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg shadow-slate-900/10"
            >
              <Icon className={cn('size-4 shrink-0', toneStyle[t.tone])} aria-hidden />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-mr-2 grid size-9 cursor-pointer place-items-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-surface-2"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
