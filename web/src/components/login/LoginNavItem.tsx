'use client'

import { LogIn } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { NavLink } from '@/components/shared/components/NavLink'
import { ROUTES } from '@/constants/routes'
import { useLoginRedirect } from '@/hooks/use-login-redirect'

import { cn } from '../shared/utils/css-utils'

/** Label text for the login button - single source of truth for layout consistency. */
const LOGIN_LABEL = 'Prihlásiť sa'

/**
 * Props for the {@link LoginNavItem} component.
 */
type LoginNavItemProps = {
  /** Optional Tailwind classes forwarded to the underlying {@link NavLink}. */
  className?: string
  /** Click handler invoked after navigation (primarily for closing drawers). */
  onClick?: () => void
  /** When true, renders a skeleton placeholder matching the button dimensions. */
  isLoading?: boolean
}

/**
 * Navigation entry that links to the login route and pairs the {@link NavLink}
 * styling with the {@link LogIn} icon for both desktop and mobile menus.
 * Automatically captures the current page to redirect back after login.
 */
export const LoginNavItem = ({ className, onClick, isLoading }: LoginNavItemProps) => {
  // Get the function which generates the login URL
  const { getLoginUrl } = useLoginRedirect()

  // If already on login page
  const loginUrl =
    usePathname() === ROUTES.LOGIN
      ? // Do not add return URL
        ROUTES.LOGIN
      : // Otherwise add return URL determined at the time of navigation
        getLoginUrl()

  // Loading skeleton - matches exact dimensions of the real button
  if (isLoading) {
    return (
      <div
        className={cn(
          className,
          'flex items-center gap-2 animate-pulse cursor-progress select-none'
        )}
        aria-label="Loading login button"
        aria-busy="true"
      >
        <div className="w-5 h-5 rounded bg-current opacity-20" />
        {/* Visible skeleton bar overlaid on invisible text (for exact width) */}
        <span className="relative">
          <span className="invisible">{LOGIN_LABEL}</span>
          <span className="absolute inset-0 rounded bg-current opacity-20" />
        </span>
      </div>
    )
  }

  return (
    <NavLink href={loginUrl} className={cn(className, 'flex items-center gap-2')} onClick={onClick}>
      <LogIn className="w-5 h-5" />
      <span>{LOGIN_LABEL}</span>
    </NavLink>
  )
}
