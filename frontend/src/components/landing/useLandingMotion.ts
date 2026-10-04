import { useEffect, type RefObject } from 'react'
import { useReducedMotion } from '../../lib/motion'

// The landing page's scroll effects, as in the Claude Design file "Squirrel Login".
// One animation frame loop reads the scroll position (eased, so layers glide
// a little behind it) and moves whatever is marked up for it:
//
// - data-reveal: fades in once it scrolls into view (the look is in index.css).
// - data-parallax="k": moves k × the scroll distance; data-rot/-sway/-spin turn it.
// - data-pin: a tall section whose sticky panel steps through [data-step] items,
//   drawing the [data-draw] path and lighting [data-node] acorns as it goes.
// - data-hscroll: a tall section whose [data-track] slides sideways.
// - data-fillsec: its [data-fill] words darken one by one.
// - data-header / data-progress: the header shrinks once scrolled; the bar fills.
//
// With Reduce Motion, nothing glides, drifts or sways; the pinned steps and
// sideways cards still follow the scroll, since that's how they're read.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export function useLandingMotion(rootRef: RefObject<HTMLElement | null>, view: string) {
  const reduced = useReducedMotion()

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          ;(e.target as HTMLElement).dataset.shown = ''
          reveal.unobserve(e.target)
        }),
      { threshold: 0.15 },
    )
    root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => reveal.observe(el))

    let eased = window.scrollY
    let raf = 0

    function frame() {
      raf = requestAnimationFrame(frame)
      const y = window.scrollY
      const vh = window.innerHeight
      eased = reduced ? y : eased + (y - eased) * 0.12
      if (Math.abs(y - eased) < 0.1) eased = y
      const sy = eased
      const lag = y - sy
      const now = performance.now()

      const progress = root!.querySelector<HTMLElement>('[data-progress]')
      const docH = document.documentElement.scrollHeight - vh
      if (progress) progress.style.width = `${docH > 0 ? (sy / docH) * 100 : 0}%`
      root!.querySelector('[data-header]')?.toggleAttribute('data-scrolled', y > 30)

      root!.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
        const d = el.dataset
        if (reduced) {
          el.style.transform = d.rot ? `rotate(${d.rot}deg)` : ''
          return
        }
        let turn = ''
        if (d.rot) {
          const sway = d.sway ? Math.sin(now / 900 + Number(d.sway) * 1.7) * 14 : 0
          const spin = d.spin ? sy * Number(d.spin) : 0
          turn = ` rotate(${Number(d.rot) + sway + spin}deg)`
        }
        el.style.transform = `translate3d(0,${-sy * Number(d.parallax)}px,0)${turn}`
      })

      root!.querySelectorAll<HTMLElement>('[data-pin]').forEach((sec) => {
        const r = sec.getBoundingClientRect()
        const n = Number(sec.dataset.pin)
        const p = clamp01(-(r.top + lag) / (r.height - vh))
        const active = Math.min(n - 1, Math.floor(p * n))
        sec.querySelectorAll<HTMLElement>('[data-step]').forEach((st) => {
          const i = Number(st.dataset.step)
          st.style.opacity = i === active ? '1' : '0'
          st.style.transform = `translateY(${i === active ? 0 : i < active ? -30 : 30}px)`
          st.setAttribute('aria-hidden', String(i !== active))
        })
        const path = sec.querySelector<SVGPathElement>('[data-draw]')
        if (path) {
          const len = path.getTotalLength()
          path.style.strokeDasharray = String(len)
          path.style.strokeDashoffset = String(len * (1 - clamp01(p * 1.15)))
        }
        sec.querySelectorAll<SVGGElement>('[data-node]').forEach((node) => {
          const on = p * 1.15 >= Number(node.dataset.node) / (n - 1) - 0.01
          node.style.opacity = on ? '1' : '0.3'
          node.setAttribute('transform', `translate(30 ${node.dataset.cy}) scale(${on ? 1.15 : 0.85})`)
        })
      })

      root!.querySelectorAll<HTMLElement>('[data-hscroll]').forEach((sec) => {
        const track = sec.querySelector<HTMLElement>('[data-track]')
        if (!track?.parentElement) return
        const r = sec.getBoundingClientRect()
        const p = clamp01(-(r.top + lag) / (r.height - vh))
        const dist = Math.max(0, track.scrollWidth - track.parentElement.clientWidth)
        track.style.transform = `translate3d(${-p * dist}px,0,0)`
      })

      const fill = root!.querySelector<HTMLElement>('[data-fillsec]')
      if (fill) {
        const r = fill.getBoundingClientRect()
        const words = fill.querySelectorAll<HTMLElement>('[data-fill]')
        const p = clamp01((vh * 0.8 - (r.top + lag)) / (r.height * 0.9))
        words.forEach((w, i) => (w.style.opacity = String(0.18 + 0.82 * clamp01(p * words.length - i))))
      }
    }
    frame()

    return () => {
      cancelAnimationFrame(raf)
      reveal.disconnect()
    }
  }, [rootRef, view, reduced])
}
