import { useSyncExternalStore } from 'react'

// Motion helpers. Every animation here has a plain fade (or nothing) when the
// user has asked their system to reduce motion. CSS animations are covered by
// the rule in index.css; these are for animations started from JavaScript.

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

export const prefersReducedMotion = () => reduceQuery.matches

export function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      reduceQuery.addEventListener('change', cb)
      return () => reduceQuery.removeEventListener('change', cb)
    },
    prefersReducedMotion,
  )
}

// --- Falling acorns ------------------------------------------------------------
// Only for big wins: a card credit used up, or the review queue cleared.
// AcornRain (mounted once in App) listens for this.

const CELEBRATE = 'squirrel:celebrate'

export function celebrate(delayMs = 0) {
  if (prefersReducedMotion()) return
  window.setTimeout(() => window.dispatchEvent(new Event(CELEBRATE)), delayMs)
}

export function onCelebrate(handler: () => void) {
  window.addEventListener(CELEBRATE, handler)
  return () => window.removeEventListener(CELEBRATE, handler)
}

// --- A row leaving a list --------------------------------------------------------

/** Folds an element away (or fades it, with reduced motion). Resolves when done. */
export function collapse(el: Element | null): Promise<void> {
  if (!(el instanceof HTMLElement)) return Promise.resolve()
  const rm = prefersReducedMotion()
  const h = el.offsetHeight
  el.style.overflow = 'hidden'
  const anim = el.animate(
    rm
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, transform: 'none', height: `${h}px` },
          { opacity: 0, transform: 'scale(.97)', height: `${h}px`, offset: 0.6 },
          { opacity: 0, transform: 'scale(.97)', height: '0px', paddingTop: '0px', paddingBottom: '0px' },
        ],
    { duration: rm ? 200 : 320, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
  )
  return anim.finished.then(
    () => undefined,
    () => undefined,
  )
}

// --- Confirmed from the review queue: fly to All Benefits ------------------------

/** A small orange label flies from `from` to the All Benefits link, which then shows "+1". */
export function flyToBenefits(from: Element | null, label: string) {
  const target = document.querySelector<HTMLElement>('[data-nav="/benefits"]')
  if (!(from instanceof HTMLElement) || !target) return
  const rm = prefersReducedMotion()
  const r = from.getBoundingClientRect()
  const t = target.getBoundingClientRect()

  const ghost = document.createElement('div')
  ghost.textContent = label
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: '48px',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '14px',
    background: '#c2410c',
    color: '#fff',
    font: "600 15px 'Plus Jakarta Sans', system-ui, sans-serif",
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    zIndex: '90',
    pointerEvents: 'none',
    boxShadow: '0 16px 32px -14px rgba(194,65,12,0.8)',
  })
  document.body.appendChild(ghost)

  const dx = t.left + t.width / 2 - (r.left + r.width / 2)
  const dy = t.top + t.height / 2 - (r.top + 24)
  const scale = Math.max(0.12, Math.min(0.3, 70 / r.width))
  const anim = ghost.animate(
    rm
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.5 },
        ],
    { duration: rm ? 200 : 420, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' },
  )
  anim.onfinish = () => {
    ghost.remove()
    plusOne(target, rm)
  }
}

function plusOne(target: HTMLElement, rm: boolean) {
  const t = target.getBoundingClientRect()
  const badge = document.createElement('div')
  badge.textContent = '+1'
  badge.setAttribute('aria-hidden', 'true')
  Object.assign(badge.style, {
    position: 'fixed',
    left: `${t.left + t.width / 2}px`,
    top: `${t.top + t.height / 2}px`,
    padding: '3px 9px',
    borderRadius: '999px',
    background: '#15803d',
    color: '#fff',
    font: "700 13px 'Plus Jakarta Sans', system-ui, sans-serif",
    zIndex: '91',
    pointerEvents: 'none',
  })
  document.body.appendChild(badge)
  badge.animate(
    rm
      ? [
          { opacity: 0, transform: 'translate(-50%,-150%)' },
          { opacity: 1, transform: 'translate(-50%,-150%)', offset: 0.3 },
          { opacity: 0, transform: 'translate(-50%,-150%)' },
        ]
      : [
          { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
          { opacity: 1, transform: 'translate(-50%,-130%) scale(1.1)', offset: 0.35 },
          { opacity: 0, transform: 'translate(-50%,-190%) scale(1)' },
        ],
    { duration: 750, easing: 'ease-out', fill: 'forwards' },
  ).onfinish = () => badge.remove()
  if (!rm) target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' })
}
