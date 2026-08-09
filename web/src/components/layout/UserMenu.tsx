'use client'

import { useUser } from '@clerk/nextjs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ComponentPropsWithoutRef } from 'react'
import { forwardRef, useEffect, useState } from 'react'

import { LoginNavItem } from '@/components/login/LoginNavItem'
import { cn } from '@/components/shared/utils/css-utils'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { ROUTES } from '@/i18n/i18n'
import { usePathname } from '@/i18n/navigation'

import { UserAvatarImage } from './UserAvatarImage'
import { UserInfoHeader } from './UserInfoHeader'
import { UserMenuItem } from './UserMenuItem'

/**
 * Shared trigger button layout for the user menu, keeping dimensions consistent.
 * It is meant to be passed to a Radix/headless component as the trigger.
 */
const UserMenuTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>(
  ({ className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'relative flex items-center gap-2 pl-4 pr-3 rounded-full min-w-[95px] border border-transparent transition-all duration-200 before:absolute before:inset-0 before:rounded-full before:ring-1 before:ring-transparent before:ring-offset-0 before:transition-all before:duration-200 before:pointer-events-none hover:before:ring-foreground/40 hover:before:-inset-x-1 hover:before:-inset-y-3 focus-visible:before:ring-foreground/60 focus-visible:before:-inset-x-1 focus-visible:before:-inset-y-3 focus-visible:outline-none',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  )
)
UserMenuTrigger.displayName = 'UserMenuTrigger'

/**
 * Props for the {@link UserMenu} component.
 */
type UserMenuProps = {
  /**
   * The authentication state of the user coming from the server. If we know this
   * state is true, we will show the user menu skeleton to prevent layout shift.
   */
  isAuthenticated: boolean
  /** Opens the user's defenses. */
  onOpenDefenses: () => void
}

/**
 * User menu dropdown component for the header.
 * Handles all auth states: loading, logged out (shows login), and logged in (shows dropdown).
 * Built with Radix UI Dropdown for better accessibility.
 */
export default function UserMenu({ isAuthenticated, onOpenDefenses }: UserMenuProps) {
  // Get the logged-in user
  const { user, isLoaded } = useUser()

  // Keep track of whether the component has mounted yet
  const [mounted, setMounted] = useState(false)

  // Setup that the component has mounted after the first render
  useEffect(() => {
    setMounted(true)
  }, [])

  // Disable profile menu item if already on profile page
  const isProfileDisabled = usePathname() === ROUTES.PROFILE

  // Whether the user reviews defenses
  const isAdmin = useIsAdmin()

  // Get translations
  const tUserMenu = useTranslations('ui.userMenu')
  const tProfile = useTranslations('profile')

  // If the server is saying we're authenticated but the user is not loaded yet,
  // we will show the skeleton of the user menu to prevent layout shift.
  // We also check for !mounted to match the server's output during hydration.
  if (isAuthenticated && (!isLoaded || !mounted)) {
    return (
      <UserMenuTrigger aria-label={tUserMenu('loading')}>
        <div className="w-10 h-10 rounded-full bg-surface-inset/50 animate-pulse -my-2" />
        <ChevronDown className="w-4 h-4 text-popover-foreground/30" aria-hidden="true" />
      </UserMenuTrigger>
    )
  }

  // Still loading auth state - use LoginNavItem skeleton which will handle loading animation
  // We also check !mounted to ensure hydration consistency: SSR always has isLoaded=false,
  // so the client must show the same skeleton until mounted.
  if (!isLoaded || !user) {
    return (
      <LoginNavItem
        isLoading={!isLoaded || !mounted}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-foreground hover:text-foreground hover:bg-focus/10 hover:ring-1 hover:ring-focus/30 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
    )
  }

  return (
    <DropdownMenu.Root modal={false}>
      {/* Trigger button */}
      <DropdownMenu.Trigger asChild>
        <UserMenuTrigger id="user-menu-trigger" aria-label={tUserMenu('label')}>
          <UserAvatarImage
            imageUrl={user.imageUrl}
            altText={user.firstName || tProfile('defaultUser')}
            size={40}
            className="-my-2"
          />
          <ChevronDown
            className={cn(
              'w-4 h-4 text-popover-foreground/60 transition-transform duration-200',
              'group-data-[state=open]:rotate-180'
            )}
            aria-hidden="true"
          />
        </UserMenuTrigger>
      </DropdownMenu.Trigger>

      {/* Dropdown content */}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          id="user-menu-content"
          className={cn(
            'w-full rounded-lg',
            'bg-surface/25 backdrop-blur-md border border-foreground/10',
            'shadow-lg',
            'overflow-hidden z-50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
          sideOffset={16}
          align="end"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {/* Who is signed in */}
          <div className="px-4 py-3 border-b border-foreground/10">
            <UserInfoHeader user={user} size="sm" />
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            {/* The user's defenses */}
            <UserMenuItem type="mathilda" variant="dropdown" onClick={onOpenDefenses} />

            {/* Everyone's defenses */}
            {isAdmin && <UserMenuItem type="defenseReview" variant="dropdown" />}

            {/* Their profile */}
            <UserMenuItem type="profile" variant="dropdown" disabled={isProfileDisabled} />

            {/* And the way out */}
            <UserMenuItem type="signOut" variant="dropdown" />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
