import { Gift } from 'lucide-react'
import type { CSSProperties } from 'react'
import scenes from '../assets/category-scenes.svg?raw'
import { PALETTE } from '../lib/categories'
import { cn } from '../lib/cn'

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
