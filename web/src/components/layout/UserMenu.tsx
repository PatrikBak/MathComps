'use client'

import { useUser } from '@clerk/nextjs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import type { ComponentPropsWithoutRef } from 'react'
import { forwardRef } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/constants/routes'

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
        'flex items-center gap-2 pl-4 pr-3 rounded-full min-w-[84px]',
        'border border-transparent',
        'hover:outline-1 outline-offset-6 transition-all duration-200 focus-visible:outline-1 focus-visible:outline-white/60',
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
 * User menu dropdown component for the header.
 * Shows user avatar, name, and provides logout functionality.
 * Built with Radix UI Dropdown for better accessibility.
 */
export default function UserMenu() {
  // Get the logged-in user
  const { user, isLoaded } = useUser()

  // Disable profile menu item if already on profile page
  const isProfileDisabled = usePathname() === ROUTES.PROFILE

  // Render placeholder while the user data loads to prevent layout shifts
  if (!isLoaded || !user) {
    return (
      <UserMenuTrigger
        aria-label="Loading user menu"
        aria-busy="true"
        disabled
        className="bg-white/5 border-white/10 cursor-progress select-none animate-pulse"
      >
        <div className="w-8 h-8 rounded-full bg-white/20" />
        <div className="w-4 h-4 rounded-full bg-white/10" />
      </UserMenuTrigger>
    )
  }

  return (
    <DropdownMenu.Root modal={false}>
      {/* Trigger Button */}
      <DropdownMenu.Trigger asChild>
        <UserMenuTrigger aria-label="Používateľské menu">
          <UserAvatarImage
            imageUrl={user.imageUrl}
            altText={user.firstName || 'Používateľ'}
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <ChevronDown
            className={cn(
              'w-4 h-4 text-white/60 transition-transform duration-200',
              'group-data-[state=open]:rotate-180'
            )}
            aria-hidden="true"
          />
        </UserMenuTrigger>
      </DropdownMenu.Trigger>

      {/* Dropdown Content */}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'w-full rounded-lg',
            'bg-slate-900/95 backdrop-blur-sm border border-white/10',
            'shadow-lg',
            'overflow-hidden z-50',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2'
          )}
          sideOffset={8}
          align="end"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {/* User Info */}
          <div className="px-4 py-3 border-b border-white/10">
            <UserInfoHeader user={user} size="sm" />
          </div>

          {/* Menu Items */}
          <div className="py-1.5">
            <UserMenuItem type="profile" variant="dropdown" disabled={isProfileDisabled} />
            <UserMenuItem type="sign-out" variant="dropdown" />
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
