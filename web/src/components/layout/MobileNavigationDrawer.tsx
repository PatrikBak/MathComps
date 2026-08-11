'use client'

import { useUser } from '@clerk/nextjs'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React, { Fragment } from 'react'

import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { MobileLanguageSwitcher } from '@/components/layout/MobileLanguageSwitcher'
import { UserInfoHeader } from '@/components/layout/UserInfoHeader'
import { UserMenuItem } from '@/components/layout/UserMenuItem'
import { LoginNavItem } from '@/components/login/LoginNavItem'
import { Button, buttonVariants } from '@/components/shared/components/Button'
import { NavLink } from '@/components/shared/components/NavLink'
import { useIsAdmin } from '@/hooks/use-is-admin'
import { ROUTES } from '@/i18n/i18n'
import { usePathname } from '@/i18n/navigation'

import { cn } from '../shared/utils/css-utils'

/**
 * Props for the {@link MobileNavigationDrawer} component.
 */
type MobileNavigationDrawerProps = {
  /** Whether the drawer is currently open */
  isOpen: boolean
  /** Callback function to close the drawer */
  onClose: () => void
  /** Opens the user's defenses. */
  onOpenDefenses: () => void
}

/**
 * Mobile-friendly navigation drawer using Headless UI Dialog.
 */
export const MobileNavigationDrawer = ({
  isOpen,
  onClose,
  onOpenDefenses,
}: MobileNavigationDrawerProps) => {
  // Get the logged-in user
  const { user, isLoaded } = useUser()

  // Closes the drawer and opens the defenses
  const handleOpenDefenses = () => {
    // Get the drawer out of the way
    onClose()

    // Show the defenses
    onOpenDefenses()
  }

  // Get the current pathname for active state detection
  const pathname = usePathname()

  // Whether the user reviews defenses
  const isAdmin = useIsAdmin()

  // Translations for navigation links
  const tNav = useTranslations('navigation')

  // Helper component for mobile navigation links
  const MobileLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    // We will higlight the current page in the navigation drawer
    const isActive = pathname === href

    return (
      <NavLink
        href={href}
        onClick={onClose}
        className={cn(
          'block -mx-6 px-6 py-3 text-lg font-semibold border-b border-foreground/5 last:border-0 transition-colors',
          isActive
            ? 'text-foreground bg-foreground/5'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {children}
      </NavLink>
    )
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-overlay lg:hidden">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-background/30" aria-hidden="true" />
        </TransitionChild>

        {/* Drawer panel */}
        <TransitionChild
          as={Fragment}
          enter="transition-transform ease-out duration-300"
          enterFrom="-translate-y-full"
          enterTo="translate-y-0"
          leave="transition-transform ease-in duration-200"
          leaveFrom="translate-y-0"
          leaveTo="-translate-y-full"
        >
          <DialogPanel className="fixed inset-x-0 top-0 max-h-[100dvh] w-full bg-surface/40 backdrop-blur-xl shadow-2xl rounded-b-2xl flex flex-col">
            {/* Header with logo and close button */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-foreground/10">
              <MathCompsLogo />
              <Button
                variant="ghost"
                onClick={onClose}
                aria-label={tNav('menuClose')}
                className="h-10 w-10 p-0 rounded-full bg-foreground/5 hover:bg-foreground/10"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-4 px-6 pt-1">
                {/* Who is signed in */}
                {isLoaded && user && (
                  <div className="mt-4 p-4 rounded-xl bg-foreground/5 border border-foreground/5">
                    <UserInfoHeader user={user} size="md" />
                  </div>
                )}

                {/* Main navigation */}
                <nav className="flex flex-col">
                  <MobileLink href={ROUTES.PROBLEMS}>{tNav('problems')}</MobileLink>
                  <MobileLink href={ROUTES.HANDOUTS}>{tNav('handouts')}</MobileLink>
                  <MobileLink href={ROUTES.GUIDE}>{tNav('guide')}</MobileLink>
                  <MobileLink href={ROUTES.NEWS}>{tNav('news')}</MobileLink>
                </nav>

                {/* Separator — only when logged in */}
                {isLoaded && user && <div className="-mx-6 -mt-2 border-t border-foreground/10" />}

                {/* Auth actions */}
                {isLoaded && (
                  <div>
                    {user ? (
                      <div className="flex flex-col -my-2">
                        {/* The user's defenses */}
                        <UserMenuItem
                          type="mathilda"
                          variant="mobile"
                          onClick={handleOpenDefenses}
                        />

                        {/* Everyone's defenses */}
                        {isAdmin && (
                          <UserMenuItem type="defenseReview" variant="mobile" onClick={onClose} />
                        )}

                        {/* Their profile */}
                        <UserMenuItem type="profile" variant="mobile" onClick={onClose} />

                        {/* And the way out */}
                        <UserMenuItem type="signOut" variant="mobile" onClick={onClose} />
                      </div>
                    ) : (
                      <div className="pb-4 flex justify-center">
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

                {/* Separator — only when logged in */}
                {isLoaded && user && <div className="-mx-6 border-t border-foreground/10" />}

                {/* Language switcher */}
                <div className="flex justify-center pb-4">
                  <MobileLanguageSwitcher onSelect={onClose} />
                </div>
              </div>
            </div>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
