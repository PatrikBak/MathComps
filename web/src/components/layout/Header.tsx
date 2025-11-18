'use client'

import { useToggle } from '@mantine/hooks'
import { Menu } from 'lucide-react'

import MathCompsLogo from '@/components/layout/MathCompsLogo'
import UserMenu from '@/components/layout/UserMenu'
import { LoginNavItem } from '@/components/login/LoginNavItem'
import { NavLink } from '@/components/shared/components/NavLink'
import { ROUTES } from '@/constants/routes'

import { cn } from '../shared/utils/css-utils'
import { MobileNavigationDrawer } from './MobileNavigationDrawer'

/**
 * Props for the {@link Header} component.
 */
type HeaderProps = {
  /**
   * The starting authentication state of the user fetched from the server.
   * If they are we can render the logged-in state right away without waiting
   * for a client-side check of the user's data.
   */
  initialIsAuthenticated: boolean
}

/**
 * The main site header with logo + navigation + login button / user-data
 */
export default function Header({ initialIsAuthenticated }: HeaderProps) {
  // Keep track of whether the mobile menu is open
  const [isMobileNavigationOpen, toggleMobileNavigationOpen] = useToggle()

  return (
    <>
      <header className="sticky top-0 left-0 right-0 bg-slate-950/95 z-50">
        <nav className="max-w-7xl mx-auto flex justify-between items-center px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
          <MathCompsLogo />

          <div className="flex items-center gap-3">
            {/* Desktop Navigation */}
            <div
              className={cn(
                'hidden lg:flex items-center gap-6 xl:gap-8 text-xl font-semibold ml-8 xl:ml-12 py-2'
              )}
            >
              <NavLink href={ROUTES.PROBLEMS}>Úlohy</NavLink>
              <NavLink href={ROUTES.HANDOUTS}>Materiály</NavLink>
              <NavLink href={ROUTES.GUIDE}>Rozcestník</NavLink>
              <NavLink href={ROUTES.ABOUT}>O projekte</NavLink>

              {/* Auth Section */}
              <div>
                {/* Case where we are sure there will be a user  */}
                {initialIsAuthenticated ? (
                  <UserMenu />
                ) : (
                  <div className="pl-4">
                    {/* Just a login button */}
                    <LoginNavItem
                      className="text-violet-300 hover:text-violet-200 
                      transition-colors rounded-full outline outline-slate-700 outline-offset-8 
                      hover:outline-white/50 focus-visible:outline-4  focus-visible:outline-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Navigation Button */}
            <button
              onClick={() => toggleMobileNavigationOpen()}
              className="lg:hidden text-white p-2 rounded-lg hover:bg-slate-800/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Otvoriť navigáciu"
              aria-expanded={isMobileNavigationOpen}
            >
              <Menu width={24} height={24} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile maburger menu */}
      <MobileNavigationDrawer
        isOpen={isMobileNavigationOpen}
        onClose={toggleMobileNavigationOpen}
      />
    </>
  )
}
