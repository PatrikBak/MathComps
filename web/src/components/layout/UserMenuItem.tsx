import { useClerk } from '@clerk/nextjs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LogOut, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
import { useCurrentUrl } from '@/hooks/use-current-url'
import { ROUTES } from '@/i18n/i18n'

import { AppLink } from '../shared/components/AppLink'

/**
 * Type of user menu item to render.
 */
type UserMenuItemType = 'profile' | 'signOut'

/**
 * Props for the {@link UserMenuItem} component.
 */
type UserMenuItemProps = {
  /** The type of menu item to render */
  type: UserMenuItemType
  /** Whether the menu item is disabled */
  disabled?: boolean
  /** Variant determines the styling and wrapper behavior */
  variant: 'dropdown' | 'mobile'
  /** Callback invoked when the item is clicked*/
  onClick?: () => void
}

/**
 * Renders a user menu item with icon and label.
 * Supports both dropdown menu (Radix) and mobile drawer contexts.
 */
export const UserMenuItem = ({ type, disabled = false, variant, onClick }: UserMenuItemProps) => {
  // Translations for section
  const tCommon = useTranslations('common')
  const tAuth = useTranslations('auth')

  // Get the current URL for logout redirect
  const { signOut } = useClerk()

  // Get the current URL getter for logout redirect
  const getCurrentUrl = useCurrentUrl()

  // A function to handle sign out
  const handleSignOut = () => {
    // Call clerk sign out with the most up-to-date redirect URL
    signOut({ redirectUrl: getCurrentUrl() })
    // Call the onClick handler if provided
    onClick?.()
  }

  // Get the styles for the type
  const config = {
    profile: {
      icon: User,
      label: tCommon('profile'),
      bgColor: 'bg-violet-500/10',
      iconColor: 'text-violet-400',
    },
    signOut: {
      icon: LogOut,
      label: tAuth('signOut'),
      bgColor: 'bg-red-500/10',
      iconColor: 'text-red-400',
    },
  }[type]

  // The actual menu item
  const content = (
    <>
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
          config.bgColor
        )}
      >
        <config.icon className={cn('w-5 h-5', config.iconColor)} />
      </div>
      <span>{config.label}</span>
    </>
  )

  switch (variant) {
    case 'dropdown':
      // Dropdown variant uses Radix DropdownMenu.Item wrapper
      const baseClasses = cn(
        'flex items-center gap-3 px-4 py-2.5 text-sm',
        'text-white/70 hover:text-white',
        'transition-colors duration-150',
        'outline-none data-[highlighted]:bg-white/5 data-[highlighted]:text-white',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      switch (type) {
        case 'signOut':
          return (
            <DropdownMenu.Item asChild>
              <button onClick={handleSignOut} className={cn('w-full', baseClasses)}>
                {content}
              </button>
            </DropdownMenu.Item>
          )
        case 'profile':
          return (
            <DropdownMenu.Item asChild disabled={disabled}>
              <AppLink
                href={ROUTES.PROFILE}
                className={cn(
                  baseClasses,
                  'text-white/70 font-normal',
                  disabled && 'opacity-50 cursor-default'
                )}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : undefined}
              >
                {content}
              </AppLink>
            </DropdownMenu.Item>
          )
      }

    case 'mobile':
      // Mobile variant uses plain Link/button with mobile-specific styling
      const mobileClasses = cn(
        'w-full flex items-center gap-3 px-4 py-3 text-base font-medium text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      switch (type) {
        case 'signOut':
          return (
            <button onClick={handleSignOut} className={mobileClasses}>
              {content}
            </button>
          )
        case 'profile':
          return (
            <AppLink
              href={ROUTES.PROFILE}
              onClick={disabled ? undefined : onClick}
              className={mobileClasses}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : undefined}
            >
              {content}
            </AppLink>
          )
      }
  }
}
