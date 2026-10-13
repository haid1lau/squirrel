import { cn } from '../lib/cn'

/**
 * The squirrel burying an acorn, from the Claude Design file (shapes in
 * assets/category-scenes.svg). Used for "All caught up" and while scanning.
 * Decorative; it stands still with reduced motion.
 */
export function DiggingSquirrel({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('shrink-0 overflow-hidden rounded-full', className)}
      style={{ background: 'oklch(0.93 0.045 55)' }}
    >
      <svg viewBox="0 0 200 200" className="block size-full">
        <g className="animate-dig" style={{ transformOrigin: '96px 180px' }}>
          <use href="#sq-tail" transform="translate(114 150)" />
          <use href="#sq-body" transform="translate(96 138)" />
          <use href="#sq-head" transform="translate(96 76)" />
          <use href="#eyes-happy" transform="translate(96 76)" />
          <use href="#sq-hand" transform="translate(74 158)" />
          <use href="#sq-hand" transform="translate(118 158)" />
        </g>
        <g className="animate-bury" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <ellipse cx="100" cy="166" rx="9" ry="11" fill="#c97a3d" stroke="#2b2520" strokeWidth="3" />
          <path d="M89 160 Q100 148 111 160 Z" fill="#7a4a26" stroke="#2b2520" strokeWidth="3" strokeLinejoin="round" />
        </g>
        <path
          d="M30 200 L30 188 Q100 160 170 188 L170 200 Z"
          fill="#9a6a43"
          stroke="#2b2520"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
