'use client'

import { LogIn } from 'lucide-react'
import type { LinkProps } from 'next/link'
import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { ROUTES } from '@/i18n/i18n'
import { usePathname } from '@/i18n/navigation'

import { cn } from '../shared/utils/css-utils'

/**
 * Props for the {@link LoginNavItem} component.
 */
type LoginNavItemProps = {
  /** Optional Tailwind classes forwarded to the underlying {@link AppLink}. */
  className?: string
  /** Click handler run as the link is followed (primarily for closing drawers). */
  onClick?: () => void
  /** When true, renders a skeleton placeholder matching the button dimensions. */
  isLoading?: boolean
}

/**
 * Cancels a press on the sign-in link made on the login page itself, since following the bare login
 * route would drop any way back the address holds.
 *
 * @param event - The navigation the press started.
 */
const stayOnLoginPage: NonNullable<LinkProps['onNavigate']> = (event) => {
  // The reader stays where they are
  event.preventDefault()
}

/**
 * Navigation entry that links to the login route and pairs the {@link LogIn} icon with the label,
 * for both desktop and mobile menus. The caller owns the appearance.
 * Automatically captures the current page to redirect back after login.
 */
export const LoginNavItem = ({ className, onClick, isLoading }: LoginNavItemProps) => {
  // Translations for section
  const t = useTranslations('auth')

  // The link to the login page, coming back to this one
  const { loginLink } = useLoginRedirect()

  // The link, which stays put on the login page itself
  const link =
    usePathname() === ROUTES.LOGIN ? { href: ROUTES.LOGIN, onNavigate: stayOnLoginPage } : loginLink

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
    <AppLink
      plain
      {...link}
      className={cn(className, 'flex items-center gap-2 whitespace-nowrap')}
      onClick={onClick}
    >
      <LogIn className="w-5 h-5" />
      <span>{t('signIn')}</span>
    </AppLink>
  )
}
