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
import { NavLink } from '@/components/shared/components/NavLink'
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
}

/**
 * Mobile-friendly navigation drawer using Headless UI Dialog.
 */
export const MobileNavigationDrawer = ({ isOpen, onClose }: MobileNavigationDrawerProps) => {
  // Get the logged-in user
  const { user, isLoaded } = useUser()

  // Get the current pathname for active state detection
  const pathname = usePathname()

  // Translations for navigation links
  const tNav = useTranslations('navigation')

  // Translations for common text
  const tCommon = useTranslations('common')

  // Helper component for mobile navigation links
  const MobileLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    // We will higlight the current page in the navigation drawer
    const isActive = pathname === href

    return (
      <NavLink
        href={href}
        onClick={onClose}
        className={cn(
          'block -mx-6 px-6 pt-4 pb-3 -mt-1 text-lg font-semibold border-b border-foreground/5 last:border-0 transition-colors',
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
      <Dialog onClose={onClose} className="relative z-50 lg:hidden">
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
          <div className="fixed inset-0 bg-background/80" aria-hidden="true" />
        </TransitionChild>

        {/* Drawer Panel */}
        <TransitionChild
          as={Fragment}
          enter="transition-transform ease-out duration-300"
          enterFrom="-translate-y-full"
          enterTo="translate-y-0"
          leave="transition-transform ease-in duration-200"
          leaveFrom="translate-y-0"
          leaveTo="-translate-y-full"
        >
          <DialogPanel className="fixed inset-x-0 top-0 h-[100dvh] w-full bg-surface shadow-2xl flex flex-col">
            {/* Header with logo and close button */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-foreground/10 bg-surface">
              <MathCompsLogo />
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 text-muted hover:bg-foreground/10 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-focus"
                aria-label={tNav('menuClose')}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col min-h-full px-6 py-2 scroll-p-2">
                {/* User Info Section */}
                {isLoaded && user && (
                  <div className="mb-2 p-4 rounded-xl bg-foreground/5 border border-foreground/5">
                    <UserInfoHeader user={user} size="md" />
                  </div>
                )}

                {/* Main Navigation */}
                <nav className="space-y-1 mb-4">
                  <MobileLink href={ROUTES.PROBLEMS}>{tNav('problems')}</MobileLink>
                  <MobileLink href={ROUTES.HANDOUTS}>{tNav('handouts')}</MobileLink>
                  <MobileLink href={ROUTES.GUIDE}>{tNav('guide')}</MobileLink>
                  <MobileLink href={ROUTES.NEWS}>{tNav('news')}</MobileLink>
                </nav>

                {/* Bottom Actions (Language & Auth) */}
                <div className="space-y-6 pb-8">
                  {/* Language Section */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-muted uppercase tracking-wider">
                      {tCommon('language.label')}
                    </div>
                    <MobileLanguageSwitcher onSelect={onClose} />
                  </div>

                  {/* Auth Actions */}
                  {isLoaded && (
                    <div className="pt-4 border-t border-foreground/10">
                      {user ? (
                        <div className="space-y-1">
                          <UserMenuItem type="profile" variant="mobile" onClick={onClose} />
                          <UserMenuItem type="signOut" variant="mobile" onClick={onClose} />
                        </div>
                      ) : (
                        <LoginNavItem
                          className="flex items-center justify-center max-w-[240px] mx-auto py-2.5 px-4 rounded-lg text-sm font-semibold text-brand-foreground bg-brand/70 hover:bg-brand/80 active:bg-brand/60 transition-colors shadow-lg shadow-brand/20"
                          onClick={onClose}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
