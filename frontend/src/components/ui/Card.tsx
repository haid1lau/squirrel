import type { LucideIcon } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'article'
}

export function Card({ as: Tag = 'div', className, ...rest }: CardProps) {
  return (
    <Tag
      className={cn('rounded-2xl border border-line bg-surface shadow-sm shadow-slate-900/5', className)}
      {...rest}
    />
  )
}

interface CardHeaderProps {
  icon: LucideIcon
  title: string
  titleId?: string
  action?: ReactNode
}

export function CardHeader({ icon: Icon, title, titleId, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex items-center gap-2.5">
        <Icon className="size-5 text-ink-muted" aria-hidden />
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {action}
    </div>
  )
}

export function CountChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-muted">
      {children}
    </span>
  )
}
