import { Ellipsis, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

export interface MoreMenuItem {
  label: string
  icon: LucideIcon
  onSelect: () => void
  danger?: boolean
  /** Keep the menu open after selecting, e.g. for a "click again to confirm" step. */
  keepOpen?: boolean
}

const MENU_WIDTH = 224
const GAP = 6

/**
 * A "⋯" button with a small menu. The menu is drawn in a layer on <body>, so
 * the next card (glass cards each form their own layer) can never cover it,
 * and it opens upwards when there isn't room below.
 */
export function MoreMenu({ items, label }: { items: MoreMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  // Place the menu under the button, or above it near the bottom of the screen.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const height = menuRef.current?.offsetHeight ?? 0
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    setPos(
      r.bottom + GAP + height > window.innerHeight - 8
        ? { bottom: window.innerHeight - r.top + GAP, left }
        : { top: r.bottom + GAP, left },
    )
  }, [open])

  // Focus the first item once the menu is placed and visible.
  useEffect(() => {
    if (open && pos) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open, pos])

  // Close on a click outside, Escape, scrolling or resizing.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close(true)
    }
    const onMove = () => close(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onMove, { capture: true, passive: true })
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onMove, { capture: true })
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  // Up and down arrows move between items.
  function onMenuKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const all = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus()
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setPos(null)
          setOpen((o) => !o)
        }}
        className={cn(
          'grid size-11 cursor-pointer place-items-center rounded-xl border border-line bg-surface text-ink-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
        )}
      >
        <Ellipsis className="size-5" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              style={{ position: 'fixed', width: MENU_WIDTH, ...pos, visibility: pos ? 'visible' : 'hidden' }}
              className="glass z-40 grid animate-rise gap-0.5 rounded-xl p-1.5"
            >
              {items.map((item, i) => (
                <button
                  // By position, so a label change ("Click again to remove") keeps focus.
                  key={i}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    item.onSelect()
                    if (!item.keepOpen) close(true)
                  }}
                  className={cn(
                    'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold transition-colors duration-150',
                    item.danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-2',
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
