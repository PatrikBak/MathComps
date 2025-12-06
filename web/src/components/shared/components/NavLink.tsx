import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link NavLink} component.
 */
type NavLinkProps = {
  /** Destination path rendered by {@link AppLink}. */
  href: string
  /** Child elements to render inside the nav link. */
  children: React.ReactNode
  /** Optional CSS classes forwarded to {@link AppLink}. */
  className?: string
  /** Callback invoked when the link is clicked (for closing drawers, etc.). */
  onClick?: () => void
}

/**
 * Navigation link wrapper that applies consistent header styling while delegating
 * routing responsibilities to {@link AppLink}.
 */
export const NavLink = ({ href, children, className, onClick }: NavLinkProps) => (
  <AppLink
    href={href}
    className={cn('text-slate-300 font-semibold hover:text-white transition-colors', className)}
    onClick={onClick}
  >
    {children}
  </AppLink>
)
