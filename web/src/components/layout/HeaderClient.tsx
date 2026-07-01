'use client'

import { useToggle } from '@mantine/hooks'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import MathCompsLogo from '@/components/layout/MathCompsLogo'
import UserMenu from '@/components/layout/UserMenu'
import { Button } from '@/components/shared/components/Button'
import { NavLink } from '@/components/shared/components/NavLink'
import { ROUTES } from '@/i18n/i18n'

import { MobileNavigationDrawer } from './MobileNavigationDrawer'

/**
 * Props for the {@link HeaderClient} component.
 */
type HeaderClientProps = {
  /**
   * Authentication state passed from the server. When we know this server-side,
   * we can render the right skeleton (either user avatar or login button)
   */
  isAuthenticated: boolean
}

/**
 * The main site sticky header with logo + centered navigation + right-aligned actions
 *
 * Layout: [Logo] --- [Centered Nav Links] --- [Language | User]
 *
 * @remarks The header's height is owned by `--header-height` in globals.css; it drives this bar's
 *   height and the derived `--scroll-offset`. Change the height there, in one place.
 */
export default function HeaderClient({ isAuthenticated }: HeaderClientProps) {
  // Keep track of whether the mobile menu is open
  const [isMobileNavigationOpen, toggleMobileNavigationOpen] = useToggle()

  // Translations for navigation
  const tNav = useTranslations('navigation')

  return (
    <>
      <header className="sticky top-0 left-0 right-0 bg-background/95 z-50">
        <nav className="max-w-7xl mx-auto flex items-center px-3 sm:px-4 md:px-6 h-[var(--header-height)]">
          {/* Left: Logo */}
          <MathCompsLogo />

          {/* Center: Navigation Links (desktop only) */}
          <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 flex-1">
            <NavLink href={ROUTES.PROBLEMS}>{tNav('problems')}</NavLink>
            <NavLink href={ROUTES.HANDOUTS}>{tNav('handouts')}</NavLink>
            <NavLink href={ROUTES.GUIDE}>{tNav('guide')}</NavLink>
            <NavLink href={ROUTES.NEWS}>{tNav('news')}</NavLink>
          </div>

          {/* Right: Actions (desktop) + Mobile menu button */}
          <div className="flex items-center ml-auto lg:mr-0 mr-2">
            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-1">
              <LanguageSwitcher />
              <UserMenu isAuthenticated={isAuthenticated} />
            </div>

            {/* Mobile Navigation Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleMobileNavigationOpen()}
              className="lg:hidden text-foreground"
              aria-label={tNav('menuOpen')}
              aria-expanded={isMobileNavigationOpen}
            >
              <Menu width={24} height={24} />
            </Button>
          </div>
        </nav>
      </header>

      {/* Mobile hamburger menu */}
      <MobileNavigationDrawer
        isOpen={isMobileNavigationOpen}
        onClose={toggleMobileNavigationOpen}
      />
    </>
  )
}
