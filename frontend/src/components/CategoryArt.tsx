import { Gift } from 'lucide-react'
import type { CSSProperties } from 'react'
import scenes from '../assets/category-scenes.svg?raw'
import { cn } from '../lib/cn'

// Each category's tile tint (a hue) and the colours its scene is painted with.
// From the Claude Design file; "other" has no scene and gets a plain gift icon.
const PALETTE: Record<string, [number, string, string, string?, string?]> = {
  dining: [30, 'oklch(0.64 0.17 25)', 'oklch(0.88 0.13 90)', 'oklch(0.5 0.1 40)'],
  transport: [90, 'oklch(0.86 0.16 92)', 'oklch(0.9 0.05 230)', 'oklch(0.32 0.03 260)'],
  travel: [200, 'oklch(0.66 0.12 200)', 'oklch(0.75 0.15 55)'],
  wellness: [150, 'oklch(0.72 0.12 150)', 'oklch(0.84 0.1 150)'],
  shopping: [350, 'oklch(0.7 0.15 350)', 'oklch(0.7 0.12 240)'],
  entertainment: [290, 'oklch(0.62 0.19 25)', 'oklch(0.95 0.06 95)', 'oklch(0.65 0.2 25)', 'oklch(0.8 0.12 210)'],
}

/** The shared scene drawings. Render once, near the top of the app. */
export function CategoryArtSprite() {
  return (
    <svg
      aria-hidden
      width="0"
      height="0"
      className="absolute size-0 overflow-hidden"
      // A static file from this repo, with no scripts or event handlers.
      dangerouslySetInnerHTML={{ __html: scenes }}
    />
  )
}

/** A rounded tile with the squirrel scene for a benefit's category. Decorative. */
export function CategoryArt({ category, className }: { category: string; className?: string }) {
  const p = PALETTE[category]
  if (!p) {
    return (
      <div aria-hidden className={cn('grid shrink-0 place-items-center rounded-[27%] bg-surface-2 text-ink-muted', className)}>
        <Gift className="size-1/2" />
      </div>
    )
  }
  const style = {
    background: `oklch(0.93 0.045 ${p[0]})`,
    '--a': p[1],
    '--b': p[2],
    '--c': p[3] ?? p[1],
    '--d': p[4] ?? p[2],
  } as CSSProperties
  return (
    <div aria-hidden className={cn('shrink-0 overflow-hidden rounded-[27%]', className)} style={style}>
      <svg viewBox="0 0 200 200" className="block size-full">
        <use href={`#scene-${category}`} />
      </svg>
    </div>
  )
}
