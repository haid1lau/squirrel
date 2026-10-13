import type { CSSProperties } from 'react'

// Fireflies over the whole background in dark mode, behind the cards, so some
// glow in the gaps between them (the woodland has its own along the bottom).
// Hidden in light mode by --wood-firefly; the look and drift are .page-fireflies
// in index.css. With Reduce Motion they stay still.

// [left %, top %, seconds, delay, drift x px, drift y px]
const FIREFLIES: [number, number, number, number, number, number][] = [
  [4, 22, 9, 0, 40, -30], [12, 58, 11, 3, -30, -40], [21, 8, 10, 6, 35, 25],
  [28, 40, 12, 1.5, -40, 30], [36, 70, 9, 4.5, 30, -35], [44, 18, 13, 2, -35, -25],
  [52, 52, 10, 7, 40, 30], [59, 30, 11, 0.5, -30, 40], [66, 64, 12, 5, 35, -30],
  [73, 12, 9, 3.5, -40, 25], [80, 46, 13, 1, 30, 35], [88, 26, 10, 6.5, -35, -30],
  [95, 60, 11, 2.5, 40, -25], [8, 84, 12, 8, 30, -40], [48, 88, 10, 4, -30, -35],
  [92, 86, 13, 7.5, -40, -30],
]

export function Fireflies() {
  return (
    <div aria-hidden className="page-fireflies pointer-events-none fixed inset-0 -z-1">
      {FIREFLIES.map(([left, top, dur, delay, dx, dy]) => (
        <span
          key={`${left}-${top}`}
          style={
            {
              left: `${left}%`,
              top: `${top}%`,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
