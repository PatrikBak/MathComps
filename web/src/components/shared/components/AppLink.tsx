import type { LinkProps } from 'next/link'
import type { ComponentProps } from 'react'
import React, { forwardRef } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { Link } from '@/i18n/navigation'

import { isExternalHref } from '../utils/url-utils'

/**
 * Props for the {@link AppLink} component.
 */
type AppLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /**
   * The destination URL. Can be:
   * - An internal path (e.g., `/about`, `/problems?category=imo`)
   * - An external URL (e.g., `https://example.com`)
   * - A hash anchor (e.g., `#section`, `/#hero`)
   */
  href: string
  /**
   * Controls Next.js prefetching behavior for internal links.
   * Has no effect on external links or hash anchors.
   *
   * @default true
   */
  prefetch?: LinkProps['prefetch']
  /**
   * Force external link behavior (renders `<a>` instead of Next.js `Link`),
   * bypassing the automatic URL detection.
   *
   * Useful when the URL pattern doesn't match typical external URLs but should
   * still be treated as external (e.g., protocol-relative URLs, internal document paths).
   */
  external?: boolean
  /**
   * Open the link in a new browser tab.
   * Automatically adds `target="_blank"` and `rel="noopener noreferrer"` for security.
   */
  newTab?: boolean
}

/**
 * Unified link component that handles both internal and external navigation.
 *
 * Automatically detects external URLs and renders the appropriate element:
 * - **Internal links**: Uses Next.js `Link` for client-side navigation with prefetching
 * - **External links**: Uses native `<a>` tag
 * - **Hash anchors**: Uses native `<a>` tag (Next.js `Link` can interfere with same-page scrolling)
 *
 * Provides consistent styling and security defaults (`rel="noopener noreferrer"` for new tabs).
 */
export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ href, className, prefetch, newTab, external, ...rest }, ref) => {
    // Apply default link styling with any custom classes
    const classes = cn('text-slate-400 hover:text-white transition-colors duration-300', className)

    // Determine if this should behave as an external link:
    // - Explicitly marked as external, OR
    // - Detected as external by URL pattern (starts with http:// or https://)
    const isExternal = external ?? isExternalHref(href)

    // Configure new tab behavior with security attributes
    const target = newTab ? '_blank' : undefined
    const rel = target ? 'noopener noreferrer' : undefined

    // Use native <a> for:
    // - External links (no client-side navigation needed)
    // - Pure hash anchors ("#section") — Next.js Link would add locale prefix and break scrolling
    // - Root hash anchors ("/#section") — same reason
    if (isExternal || href.startsWith('#') || href.startsWith('/#')) {
      return <a ref={ref} href={href} className={classes} target={target} rel={rel} {...rest} />
    }

    // Internal links use Next.js Link for:
    // - Client-side navigation (no full page reload)
    // - Automatic prefetching (configurable)
    // - Locale-aware routing via i18n/navigation
    // Note: Paths with hash or query params (e.g., "/page#section", "/page?x=1") work correctly
    return (
      <Link
        ref={ref}
        href={href as ComponentProps<typeof Link>['href']}
        prefetch={prefetch ?? true}
        className={classes}
        target={target}
        rel={rel}
        {...rest}
      />
    )
  }
)
AppLink.displayName = 'AppLink'
