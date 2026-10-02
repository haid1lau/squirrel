import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'danger'

const base =
  'inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-semibold transition-colors duration-150 active:translate-y-px aria-disabled:cursor-not-allowed aria-disabled:opacity-70'

const variants: Record<Variant, string> = {
  primary: 'border-transparent bg-cta text-white hover:bg-cta-hover',
  secondary: 'border-line bg-surface text-ink hover:bg-surface-2',
  danger: 'border-line bg-transparent text-danger hover:bg-danger-soft',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  /** Shows a spinner and ignores clicks, but stays focusable (no double submits). */
  loading?: boolean
  loadingLabel?: string
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'secondary',
  icon,
  loading = false,
  loadingLabel,
  type = 'button',
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], className)}
      onClick={(e) => {
        if (loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  )
}
