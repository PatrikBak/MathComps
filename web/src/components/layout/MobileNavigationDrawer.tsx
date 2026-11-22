'use client'

import { useUser } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'
import React from 'react'

import { useOwnOrganizations } from '@/components/features/problem-selection/hooks/use-own-organizations'
import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { MobileLanguageSwitcher } from '@/components/layout/MobileLanguageSwitcher'
import { UserInfoHeader } from '@/components/layout/UserInfoHeader'
import { UserMenuItem } from '@/components/layout/UserMenuItem'
import { UserMenuSelections } from '@/components/layout/UserMenuSelections'
import { LoginNavItem } from '@/components/login/LoginNavItem'
import { buttonVariants } from '@/components/shared/components/Button'
import { NavLink } from '@/components/shared/components/NavLink'
import { TopSheet } from '@/components/shared/components/TopSheet'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { usePathname } from '@/i18n/navigation'

import { cn } from '../shared/utils/css-utils'
import { NAVIGATION_ITEMS } from './navigation-items'

/**
 * Props for the {@link MobileNavigationDrawer} component.
 */
type MobileNavigationDrawerProps = {
  /** Whether the drawer is currently open */
  isOpen: boolean
  /** Closes the drawer */
  onClose: () => void
  /** Opens the user's defenses. */
  onOpenDefenses: () => void
}

/**
 * Props for the {@link MobileLink} component.
 */
type MobileLinkProps = {
  /** The page it opens */
  href: string
  /** Called when the link is pressed */
  onClick: () => void
  /** What it reads */
  children: React.ReactNode
}

/**
 * One of the site's pages as a link in the drawer, lit when it is the page being read.
 */
function MobileLink({ href, onClick, children }: MobileLinkProps) {
  // Whether it is the page being read
  const isActive = usePathname() === href

  return (
    <NavLink
      href={href}
      onClick={onClick}
      className={cn(
        'block -mx-6 px-6 py-3 text-lg font-semibold border-b border-foreground/5 last:border-0 transition-colors',
        isActive ? 'text-foreground bg-foreground/5' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </NavLink>
  )
}

/**
 * The navigation a phone or tablet gets in place of the header's links and user menu: the site's pages, the account's
 * items, and the language switcher, in a sheet sliding down from the top.
 */
export const MobileNavigationDrawer = ({
  isOpen,
  onClose,
  onOpenDefenses,
}: MobileNavigationDrawerProps) => {
  // Get the logged-in user
  const { user, isLoaded } = useUser()

  // A function closing the drawer and opening the defenses
  const handleOpenDefenses = () => {
    // Get the drawer out of the way
    onClose()

    // Show the defenses
    onOpenDefenses()
  }

  // Whether the user reviews defenses
  const isAdmin = useIsAdmin()

  // The organizations the user is a member of, read with the page so the drawer opens with them in hand
  const organizations = useOwnOrganizations()

  // The navigation's copy
  const tNav = useTranslations('navigation')

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={<MathCompsLogo />}
      closeLabel={tNav('menuClose')}
      keepsContentMounted={false}
      footer={null}
    >
      <div className="flex flex-col gap-4 px-6 pt-1">
        {/* Who is signed in */}
        {isLoaded && user && (
          <div className="mt-4 p-4 rounded-xl bg-foreground/5 border border-foreground/5">
            <UserInfoHeader user={user} size="md" />
          </div>
        )}

        {/* Main navigation */}
        <nav className="flex flex-col">
          {NAVIGATION_ITEMS.map((item) => (
            <MobileLink key={item.href} href={item.href} onClick={onClose}>
              {tNav(item.labelKey)}
            </MobileLink>
          ))}
        </nav>

        {/* Separator, for a signed-in user */}
        {isLoaded && user && <div className="-mx-6 -mt-2 border-t border-foreground/10" />}

        {/* Auth actions */}
        {isLoaded && (
          <div>
            {user ? (
              <div className="flex flex-col -my-2">
                {/* The user's defenses */}
                <UserMenuItem type="mathilda" variant="mobile" onClick={handleOpenDefenses} />

                {/* Everyone's defenses */}
                {isAdmin && (
                  <UserMenuItem type="defenseReview" variant="mobile" onClick={onClose} />
                )}

                {/* The selections they pick problems in */}
                <UserMenuSelections
                  organizations={organizations}
                  variant="mobile"
                  onClick={onClose}
                />

                {/* Their profile */}
                <UserMenuItem type="profile" variant="mobile" onClick={onClose} />

                {/* And the way out */}
                <UserMenuItem type="signOut" variant="mobile" onClick={onClose} />
              </div>
            ) : (
              <div className="pb-4 flex">
                <LoginNavItem
                  className={cn(
                    buttonVariants({
                      variant: 'primary',
                      shape: 'pill',
                      fullWidth: true,
                    }),
                    'max-w-xs'
                  )}
                  onClick={onClose}
                />
              </div>
            )}
          </div>
        )}

        {/* Separator, for a signed-in user */}
        {isLoaded && user && <div className="-mx-6 border-t border-foreground/10" />}

        {/* Language switcher */}
        <div className="flex justify-center pb-4">
          <MobileLanguageSwitcher onSelect={onClose} />
        </div>
      </div>
    </TopSheet>
  )
}
