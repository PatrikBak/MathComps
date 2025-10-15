'use client'

import { useState } from 'react'

import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { ROUTES } from '@/constants/routes'

import { MobileNavigationButton, MobileNavigationDrawer } from './MobileNavigationDrawer'

type NavLinkProps = {
  href: string
  children: React.ReactNode
  className?: string
}

const NavLink = ({ href, children, className }: NavLinkProps) => (
  <AppLink href={href} className={cn('hover:text-white transition-colors', className)}>
    {children}
  </AppLink>
)

export default function Header() {
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false)

  const handleMobileNavigationToggle = () => {
    setIsMobileNavigationOpen((previousValue) => !previousValue)
  }

  const handleMobileNavigationClose = () => {
    setIsMobileNavigationOpen(false)
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 z-50">
        <nav className="max-w-7xl mx-auto flex justify-between items-center px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 min-w-0">
          <MathCompsLogo />

          <MobileNavigationButton
            isOpen={isMobileNavigationOpen}
            onClick={handleMobileNavigationToggle}
          />

          <div
            className="hidden md:flex items-center gap-6 xl:gap-8 text-xl font-semibold text-slate-400 ml-8 xl:ml-12 py-2 whitespace-nowrap"
            style={{ hyphens: 'none' }}
          >
            <NavLink href={ROUTES.PROBLEMS}>Úlohy</NavLink>
            <NavLink href={ROUTES.HANDOUTS}>Materiály</NavLink>
            <NavLink href={ROUTES.GUIDE}>Rozcestník</NavLink>
            <NavLink href={ROUTES.ABOUT}>O projekte</NavLink>
          </div>
        </nav>
      </header>

      {/* Mobile Navigation Drawer */}
      <MobileNavigationDrawer
        isOpen={isMobileNavigationOpen}
        onClose={handleMobileNavigationClose}
      />
    </>
  )
}
