import { useClerk } from '@clerk/nextjs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Bot, Inbox, LogOut, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { MATHILDA_NAME } from '@/constants/mathilda'
import { useCurrentUrl } from '@/hooks/use-current-url'
import { ROUTES } from '@/i18n/i18n'

import { AppLink } from '../shared/components/AppLink'

/**
 * Type of user menu item to render.
 */
type UserMenuItemType = 'mathilda' | 'defenseReview' | 'profile' | 'signOut'

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
  const tDefenseReview = useTranslations('admin.defenseReview')

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
    mathilda: {
      icon: Bot,
      label: MATHILDA_NAME,
      bgColor: 'bg-brand/10',
      iconColor: 'text-brand-light',
    },
    defenseReview: {
      icon: Inbox,
      label: tDefenseReview('title'),
      bgColor: 'bg-warning/10',
      iconColor: 'text-warning',
    },
    profile: {
      icon: User,
      label: tCommon('profile'),
      bgColor: 'bg-info/10',
      iconColor: 'text-info-light',
    },
    signOut: {
      icon: LogOut,
      label: tAuth('signOut'),
      bgColor: 'bg-error/10',
      iconColor: 'text-error',
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
        'text-foreground/70 hover:text-foreground',
        'transition-colors duration-150',
        // Radix focuses an item when the pointer enters it, so a focus ring would double as a hover
        // style. The highlight is the indicator for both routes.
        'outline-none data-[highlighted]:bg-foreground/5 data-[highlighted]:text-foreground',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      switch (type) {
        case 'mathilda':
          return (
            <DropdownMenu.Item asChild>
              <button onClick={onClick} className={cn('w-full', baseClasses)}>
                {content}
              </button>
            </DropdownMenu.Item>
          )
        case 'signOut':
          return (
            <DropdownMenu.Item asChild>
              <button onClick={handleSignOut} className={cn('w-full', baseClasses)}>
                {content}
              </button>
            </DropdownMenu.Item>
          )
        case 'defenseReview':
          return (
            <DropdownMenu.Item asChild>
              <AppLink href={ROUTES.ADMIN_DEFENSES} plain className={baseClasses}>
                {content}
              </AppLink>
            </DropdownMenu.Item>
          )
        case 'profile':
          return (
            <DropdownMenu.Item asChild disabled={disabled}>
              <AppLink
                href={ROUTES.PROFILE}
                plain
                className={cn(baseClasses, disabled && 'opacity-50 cursor-default')}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : undefined}
              >
                {content}
              </AppLink>
            </DropdownMenu.Item>
          )
        default:
          return assertNever(type)
      }

    case 'mobile':
      // Mobile variant uses plain Link/button with mobile-specific styling
      const mobileClasses = cn(
        'w-full flex items-center gap-3 px-4 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-xl transition-all duration-200',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      switch (type) {
        case 'mathilda':
          return (
            <button onClick={onClick} className={mobileClasses}>
              {content}
            </button>
          )
        case 'signOut':
          return (
            <button onClick={handleSignOut} className={mobileClasses}>
              {content}
            </button>
          )
        case 'defenseReview':
          return (
            <AppLink href={ROUTES.ADMIN_DEFENSES} plain onClick={onClick} className={mobileClasses}>
              {content}
            </AppLink>
          )
        case 'profile':
          return (
            <AppLink
              href={ROUTES.PROFILE}
              plain
              onClick={disabled ? undefined : onClick}
              className={mobileClasses}
              aria-disabled={disabled}
              tabIndex={disabled ? -1 : undefined}
            >
              {content}
            </AppLink>
          )
        default:
          return assertNever(type)
      }
    default:
      return assertNever(variant)
  }
}
