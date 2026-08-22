'use client'

import { useDisclosure, useToggle } from '@mantine/hooks'
import { Menu } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'

import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import MathCompsLogo from '@/components/layout/MathCompsLogo'
import UserMenu from '@/components/layout/UserMenu'
import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { NavLink } from '@/components/shared/components/NavLink'
import { MATHILDA_NAME } from '@/constants/mathilda'
import { useIsAdmin } from '@/hooks/use-is-admin'

import { MobileNavigationDrawer } from './MobileNavigationDrawer'
import { visibleNavigationItems } from './navigation-items'

/**
 * The user's defenses, loaded on demand: the chat is heavy and most visits never open it.
 */
const MathildaLibraryModal = dynamic(() =>
  import('@/components/features/defense/components/MathildaLibraryModal').then(
    (module) => module.MathildaLibraryModal
  )
)

/**
 * Props for {@link MathildaLibraryPlaceholder}.
 */
type MathildaLibraryPlaceholderProps = {
  /** Dismisses the placeholder */
  onClose: () => void
}

/**
 * Stands in for the defenses while their chunk downloads, so the tap that opened them lands on something.
 *
 * Its caller renders it only while the list is meant to be open, which is why it can hardcode
 * `isOpen`.
 */
function MathildaLibraryPlaceholder({ onClose }: MathildaLibraryPlaceholderProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  return (
    <Modal isOpen onClose={onClose} title={MATHILDA_NAME} showCloseButton className="max-w-2xl">
      <p className="py-8 text-center text-sm text-muted">{t('libraryLoading')}</p>
    </Modal>
  )
}

/**
 * The main site sticky header with logo + left-aligned navigation + right-aligned actions
 *
 * Layout: [Logo | Nav Links] --- [Language | User]
 *
 * @remarks The links are anchored to the wordmark, so when the sign-in button gives way to the
 *   narrower avatar only the right-hand cluster takes up the difference. That is what lets the bar
 *   take no auth state from the server and settle it in the browser.
 *
 * @remarks The header's height is owned by `--header-height` in globals.css; it drives this bar's
 *   height and the derived `--scroll-offset`. Change the height there, in one place.
 */
export default function Header() {
  // Keep track of whether the mobile menu is open
  const [isMobileNavigationOpen, toggleMobileNavigationOpen] = useToggle()

  // The defenses list's open state
  const [isDefensesOpen, { open: openDefenses, close: closeDefenses }] = useDisclosure(false)

  // Whether the list has ever been opened
  const [hasOpenedDefenses, setHasOpenedDefenses] = useState(false)

  // Opens the defenses list, mounting it on the first open
  const handleOpenDefenses = () => {
    // Mount the list
    setHasOpenedDefenses(true)

    // Show it
    openDefenses()
  }

  // Translations for navigation
  const tNav = useTranslations('navigation')

  // Whether the reader is an admin
  const isAdmin = useIsAdmin()

  return (
    <>
      <header className="sticky top-0 left-0 right-0 bg-background/95 z-header">
        <nav className="max-w-7xl mx-auto flex items-center px-3 sm:px-4 md:px-6 h-[var(--header-height)]">
          {/* Left: Logo */}
          <MathCompsLogo className="shrink-0" />

          {/* Navigation Links (desktop only) */}
          <div className="hidden lg:flex shrink-0 items-center gap-5 xl:gap-8 ml-6 xl:ml-12 whitespace-nowrap">
            {visibleNavigationItems(isAdmin).map((item) => (
              <NavLink key={item.href} href={item.href}>
                {tNav(item.labelKey)}
              </NavLink>
            ))}
          </div>

          {/* Right: Actions (desktop) + Mobile menu button */}
          <div className="flex items-center ml-auto lg:mr-0 mr-2">
            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center gap-1">
              <LanguageSwitcher />
              <UserMenu onOpenDefenses={handleOpenDefenses} />
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
        onOpenDefenses={handleOpenDefenses}
      />

      {/* The user's defenses, over whichever menu opened them */}
      {hasOpenedDefenses && (
        <Suspense
          fallback={isDefensesOpen ? <MathildaLibraryPlaceholder onClose={closeDefenses} /> : null}
        >
          <MathildaLibraryModal isOpen={isDefensesOpen} onClose={closeDefenses} />
        </Suspense>
      )}
    </>
  )
}
