'use client'

import { useUser } from '@clerk/nextjs'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import React, { Fragment } from 'react'

import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { UserInfoHeader } from '@/components/layout/UserInfoHeader'
import { UserMenuItem } from '@/components/layout/UserMenuItem'
import { LoginNavItem } from '@/components/login/LoginNavItem'
import { NavLink } from '@/components/shared/components/NavLink'
import { ROUTES } from '@/constants/routes'

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
 * Shared styles for mobile navigation links
 */
const mobileNavLinkClassName = 'block py-3 text-xl font-semibold text-slate-300'

/**
 * Mobile-friendly navigation drawer using Headless UI Dialog.
 */
export const MobileNavigationDrawer = ({ isOpen, onClose }: MobileNavigationDrawerProps) => {
  // Get the logged-in user
  const { user, isLoaded } = useUser()

  // Helper component for mobile navigation links
  const MobileLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <NavLink href={href} onClick={onClose} className={mobileNavLinkClassName}>
      {children}
    </NavLink>
  )

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
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" aria-hidden="true" />
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
          <DialogPanel className="fixed left-0 top-0 w-full bg-slate-800 shadow-xl">
            {/* Header with logo and close button */}
            <div className="flex items-center justify-between border-b border-slate-600/60 p-3 h-14 sm:h-16 lg:h-20">
              <MathCompsLogo />
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Zavrieť navigáciu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Content */}
            <div className="max-h-[calc(100vh-3.5rem)] sm:max-h-[calc(100vh-4rem)] lg:max-h-[calc(100vh-5rem)] overflow-y-auto">
              <div className="px-6 pt-2">
                {/* User Info Header */}
                {isLoaded && user && (
                  <div className="mb-4 pb-4 border-b border-white/10 -mx-6 px-6">
                    <div className="py-3">
                      <UserInfoHeader
                        user={user}
                        size="md"
                        avatarClassName="border-2 border-violet-500/30"
                      />
                    </div>
                  </div>
                )}

                <nav className="space-y-1">
                  <MobileLink href={ROUTES.PROBLEMS}>Úlohy</MobileLink>
                  <MobileLink href={ROUTES.HANDOUTS}>Materiály</MobileLink>
                  <MobileLink href={ROUTES.GUIDE}>Rozcestník</MobileLink>
                  <MobileLink href={ROUTES.NEWS}>Novinky</MobileLink>
                  <MobileLink href={ROUTES.ABOUT}>O projekte</MobileLink>
                </nav>

                {/* Auth Section */}
                {isLoaded && (
                  <div className="mt-4 -mx-6">
                    {user ? (
                      <div className="border-t border-white/10 bg-slate-800/50">
                        <UserMenuItem type="profile" variant="mobile" onClick={onClose} />
                        <UserMenuItem type="sign-out" variant="mobile" onClick={onClose} />
                      </div>
                    ) : (
                      <div className="border-t border-white/10 bg-slate-800/50 px-6">
                        <LoginNavItem className={cn(mobileNavLinkClassName)} onClick={onClose} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
