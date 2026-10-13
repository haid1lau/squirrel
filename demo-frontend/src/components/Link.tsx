import type { AnchorHTMLAttributes } from 'react'
import { navigate } from '../lib/router'

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
}

/** An in-app link: a normal <a> (so new-tab and copy-link still work) that navigates without a reload. */
export function Link({ href, onClick, ...rest }: LinkProps) {
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(href)
      }}
      {...rest}
    />
  )
}
