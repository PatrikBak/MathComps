import Link, { type LinkProps } from 'next/link'
import React, { forwardRef } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement>

type AppLinkProps = Omit<AnchorProps, 'href'> & {
  href: string
  /** Only applies to internal links */
  prefetch?: LinkProps['prefetch']
  /** Force external behavior regardless of URL (rare) */
  external?: boolean
  /** Open in new tab (opt-in) */
  newTab?: boolean
}

const isExternalHref = (href: string) => {
  // scheme:// or //host, or common non-http schemes
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href) || /^(mailto|tel|sms|geo):/i.test(href)
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ href, className, prefetch, newTab, external, ...rest }, ref) => {
    const externalLink = external ?? isExternalHref(href)
    const classes = cn('text-slate-400 hover:text-white transition-colors duration-300', className)

    // hash anchors ("#..." or "/#...") or explicit external → use <a>
    if (externalLink || href.startsWith('#') || href.startsWith('/#')) {
      const target = newTab ? '_blank' : undefined
      const rel = target ? 'noopener noreferrer' : undefined
      return <a ref={ref} href={href} className={classes} target={target} rel={rel} {...rest} />
    }

    // internal (including /path#hash and /path?x=1)
    return <Link ref={ref} href={href} prefetch={prefetch} className={classes} {...rest} />
  }
)
AppLink.displayName = 'AppLink'
