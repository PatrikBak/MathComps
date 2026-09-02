'use client'

import { LogIn } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { NavLink } from '@/components/shared/components/NavLink'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'
import { usePathname } from '@/i18n/navigation'

import { cn } from '../shared/utils/css-utils'

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
  // Translations for section
  const t = useTranslations('auth')

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
        role="status"
        aria-label={t('loadingButton')}
        aria-busy="true"
      >
        {/* The skeleton for the icon */}
        <div className="w-5 h-5 rounded bg-current opacity-20" />
        {/* The skeleton for the text */}
        <span className="relative">
          <span className="invisible">{t('signIn')}</span>
          <span className="absolute inset-0 rounded bg-current opacity-20" />
        </span>
      </div>
    )
  }

  // Happy path - render the real button
  return (
    <NavLink
      href={loginUrl}
      className={cn(className, 'flex items-center gap-2 whitespace-nowrap')}
      onClick={onClick}
    >
      <LogIn className="w-5 h-5" />
      <span>{t('signIn')}</span>
    </NavLink>
  )
}
