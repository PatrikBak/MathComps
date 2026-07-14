import { useTranslations } from 'next-intl'
import React from 'react'

import ContactButton from '@/components/features/contact/ContactButton'
import { AppLink } from '@/components/shared/components/AppLink'
import { ROUTES } from '@/i18n/i18n'

import { cn } from '../shared/utils/css-utils'

/** The current year, evaluated once when the module loads. */
const BUILD_YEAR = new Date().getFullYear()

/**
 * Props for the {@link Footer} component
 */
type FooterProps = {
  /** Whether a mobile TOC bar is present. */
  hasToc: boolean
}

/**
 * The site footer.
 */
export default function Footer({ hasToc }: FooterProps) {
  // Translations for the footer
  const tFooter = useTranslations('footer')

  // Translations for navigation links
  const tNav = useTranslations('navigation')

  return (
    <footer
      className={cn(
        'max-w-5xl mx-auto bg-background/80 border-t border-surface/50 px-6 pt-5',
        hasToc ? 'pb-22' : 'pb-5'
      )}
    >
      {/* Footer links */}
      <div className="flex flex-col items-center text-center gap-2">
        <p className="text-muted text-sm sm:text-base flex flex-wrap justify-center items-center gap-x-6 gap-y-1">
          <AppLink href={ROUTES.ABOUT}>{tNav('about')}</AppLink>
          <ContactButton className="hover:text-foreground transition-colors duration-300">
            {tNav('contact')}
          </ContactButton>
          <AppLink href={ROUTES.PRIVACY}>{tFooter('privacy')}</AppLink>
          <span className="hyphens-none">© {BUILD_YEAR} MathComps z.s.</span>
        </p>
      </div>
    </footer>
  )
}
