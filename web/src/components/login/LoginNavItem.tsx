'use client'

import { LogIn } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { NavLink } from '@/components/shared/components/NavLink'
import { ROUTES } from '@/constants/routes'
import { useCurrentUrl } from '@/hooks/useCurrentUrl'

import { cn } from '../shared/utils/css-utils'

/**
 * Props for the {@link LoginNavItem} component.
 */
type LoginNavItemProps = {
  /** Optional Tailwind classes forwarded to the underlying {@link NavLink}. */
  className?: string
  /** Click handler invoked after navigation (primarily for closing drawers). */
  onClick?: () => void
}

/**
 * Navigation entry that links to the login route and pairs the {@link NavLink}
 * styling with the {@link LogIn} icon for both desktop and mobile menus.
 * Automatically captures the current page to redirect back after login.
 */
export const LoginNavItem = ({ className, onClick }: LoginNavItemProps) => {
  // Get the function which finds the current address bar url
  const currentUrl = useCurrentUrl()

  // If already on login page
  const loginUrl =
    usePathname() === ROUTES.LOGIN
      ? // Do not add return URL
        ROUTES.LOGIN
      : // Otherwise add return URL determined at the time of navigation
        `${ROUTES.LOGIN}?returnUrl=${encodeURIComponent(currentUrl())}`

  return (
    <NavLink href={loginUrl} className={cn(className, 'flex items-center gap-2')} onClick={onClick}>
      <LogIn className="w-5 h-5" />
      <span>Prihlásiť sa</span>
    </NavLink>
  )
}
