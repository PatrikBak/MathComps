import { useClerk } from '@clerk/nextjs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { LogOut, User } from 'lucide-react'
import type { ComponentType } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/constants/routes'
import { useCurrentUrl } from '@/hooks/useCurrentUrl'

import { AppLink } from '../shared/components/AppLink'

/**
 * Type of user menu item to render.
 */
type UserMenuItemType = 'profile' | 'sign-out'

/**
 * Configuration for each menu item type.
 */
type MenuItemConfig = {
  /**
   * React component to render as the menu item icon.
   * Accepts an optional className prop for styling.
   */
  icon: ComponentType<{ className?: string }>
  /** Display text shown next to the icon in the menu item. */
  label: string
  /** Tailwind CSS class for the background color of the icon container box. */
  bgColor: string
  /** Tailwind CSS class for the color of the icon itself. */
  iconColor: string
}

/**
 * The style config for each menu item
 */
const menuItemConfig: Record<UserMenuItemType, MenuItemConfig> = {
  profile: {
    icon: User,
    label: 'Profil',
    bgColor: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
  },
  'sign-out': {
    icon: LogOut,
    label: 'Odhlásiť sa',
    bgColor: 'bg-red-500/10',
    iconColor: 'text-red-400',
  },
}

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
  const config = menuItemConfig[type]

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
        case 'sign-out':
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
        'w-full flex items-center gap-3 px-6 py-4 text-base font-semibold text-white/80 transition-colors duration-150 active:bg-white/10',
        disabled ? 'opacity-50 cursor-default pointer-events-none' : 'cursor-pointer'
      )

      switch (type) {
        case 'sign-out':
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
