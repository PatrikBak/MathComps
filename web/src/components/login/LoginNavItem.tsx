import { LogIn } from 'lucide-react'

import { NavLink } from '@/components/shared/components/NavLink'
import { ROUTES } from '@/constants/routes'

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
 */
export const LoginNavItem = ({ className, onClick }: LoginNavItemProps) => {
  return (
    <NavLink
      href={ROUTES.LOGIN}
      className={cn(className, 'flex items-center gap-2')}
      onClick={onClick}
    >
      <LogIn className="w-5 h-5" />
      <span>Prihlásiť sa</span>
    </NavLink>
  )
}
