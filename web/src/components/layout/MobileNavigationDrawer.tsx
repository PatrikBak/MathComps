'use client'

import { Transition } from '@headlessui/react'
import { useHotkeys } from '@mantine/hooks'
import { Menu, X } from 'lucide-react'
import React, { Fragment, useEffect } from 'react'

import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { AppLink } from '@/components/shared/components/AppLink'
import { ROUTES } from '@/constants/routes'

type MobileNavigationDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

type NavigationLinkProps = {
  href: string
  children: React.ReactNode
  onClick?: () => void
}

const NavigationLink = ({ href, children, onClick }: NavigationLinkProps) => (
  <AppLink
    href={href}
    className="block py-3 text-xl font-semibold text-slate-300 hover:text-white transition-colors border-b border-slate-700/50 last:border-b-0"
    onClick={onClick}
  >
    {children}
  </AppLink>
)

/**
 * Mobile-friendly navigation drawer that slides out from the left side.
 * Contains the main navigation links in a mobile-optimized layout.
 *
 * Features:
 * - Smooth slide animation from left
 * - Backdrop overlay with blur effect
 * - Escape key and backdrop click to close
 * - Prevents background scrolling when open
 * - Full-height layout optimized for mobile screens
 */
export const MobileNavigationDrawer = ({ isOpen, onClose }: MobileNavigationDrawerProps) => {
  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle escape key to close drawer
  useHotkeys([['Escape', onClose]], [], isOpen)

  return (
    <Transition show={isOpen} as={Fragment}>
      <div className="fixed inset-0 z-50 md:hidden">
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
        </Transition.Child>

        {/* Drawer Panel */}
        <Transition.Child
          as={Fragment}
          enter="transition-transform ease-out duration-300"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition-transform ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <div className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-slate-800 shadow-xl">
            {/* Header with logo and close button */}
            <div className="flex items-center justify-between border-b border-slate-600/60 p-3 h-14 sm:h-16 lg:h-20">
              <MathCompsLogo />
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Zavrieť navigáciu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Content */}
            <div className="h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] lg:h-[calc(100vh-5rem)] overflow-y-auto">
              <div className="p-6">
                <nav className="space-y-1">
                  <NavigationLink href={ROUTES.PROBLEMS} onClick={onClose}>
                    Úlohy
                  </NavigationLink>
                  <NavigationLink href={ROUTES.HANDOUTS} onClick={onClose}>
                    Materiály
                  </NavigationLink>
                  <NavigationLink href={ROUTES.GUIDE} onClick={onClose}>
                    Rozcestník
                  </NavigationLink>
                  <NavigationLink href={ROUTES.ABOUT} onClick={onClose}>
                    O projekte
                  </NavigationLink>
                </nav>
              </div>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  )
}

/**
 * Mobile navigation trigger button.
 * Always shows hamburger menu icon since the drawer has its own close button.
 */
type MobileNavigationButtonProps = {
  isOpen: boolean
  onClick: () => void
}

export const MobileNavigationButton = ({ isOpen, onClick }: MobileNavigationButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="md:hidden text-white p-2 rounded-lg hover:bg-slate-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      aria-label="Otvoriť navigáciu"
      aria-expanded={isOpen}
    >
      <Menu width={24} height={24} />
    </button>
  )
}
