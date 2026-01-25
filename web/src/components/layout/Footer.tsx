import { useTranslations } from 'next-intl'
import React from 'react'

import ContactButton from '@/components/features/contact/ContactButton'
import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { AppLink } from '@/components/shared/components/AppLink'
import { ROUTES } from '@/i18n/i18n'

import { cn } from '../shared/utils/css-utils'

/** The year when the page was built - computed at build time to avoid */
const BUILD_YEAR = new Date().getFullYear()

/**
 * Props for the {@link Footer} component
 */
type FooterProps = {
  /* When we are in a layout with a mobile toc, we need to push the 
  footer a bit higher to fit the mobile toc navigation*/
  hasToc: boolean
}

/**
 * The footer used in the {@link Layout}
 */
export default function Footer({ hasToc }: FooterProps) {
  // Translations for section
  const tFooter = useTranslations('footer')

  // Translations for navigation links
  const tNav = useTranslations('navigation')

  return (
    <footer
      className={cn(
        'max-w-5xl mx-auto bg-slate-950/80 border-t border-slate-800/50 px-6 pt-6 sm:pt-8 lg:pb-6',
        hasToc ? 'pb-22' : 'pb-4'
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8 text-base">
        {/* Brand Section */}
        <div className="col-span-1 md:col-span-2 pr-8">
          <MathCompsLogo className="mb-3 sm:mb-4" />
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed text-balance">
            {tFooter('description')}
          </p>
        </div>

        {/* Navigation Sections - Side by side on mobile */}
        <div className="flex justify-evenly text-center md:gap-12 md:text-left md:col-span-2">
          {/* Navigation Links */}
          <div>
            <h3 className="font-semibold text-white text-sm sm:text-base tracking-wider mb-3 sm:mb-5">
              {tFooter('navigation')}
            </h3>
            <ul className="space-y-2 text-sm sm:text-base">
              <li>
                <AppLink href={ROUTES.PROBLEMS}>{tNav('problems')}</AppLink>
              </li>
              <li>
                <AppLink href={ROUTES.HANDOUTS}>{tNav('handouts')}</AppLink>
              </li>
              <li>
                <AppLink href={ROUTES.GUIDE}>{tNav('guide')}</AppLink>
              </li>
            </ul>
          </div>

          {/* Project Links */}
          <div>
            <h3 className="font-semibold text-white text-sm sm:text-base tracking-wider mb-3 sm:mb-5">
              {tFooter('project')}
            </h3>
            <ul className="space-y-2 text-sm sm:text-base">
              <li>
                <AppLink href={ROUTES.ABOUT}>{tNav('about')}</AppLink>
              </li>
              <li>
                <AppLink href="/#sponsorship-section">{tNav('sponsors')}</AppLink>
              </li>
              <li>
                <ContactButton className="text-slate-400 hover:text-white transition-colors duration-300">
                  {tNav('contact')}
                </ContactButton>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-800/50 flex flex-col items-center text-center gap-2">
        <p className="text-slate-400 text-sm sm:text-base flex flex-wrap justify-center items-center gap-x-2">
          <span className="whitespace-nowrap">© {BUILD_YEAR} MathComps</span>
          <span className="whitespace-nowrap">
            <span className="text-lg">•</span>
            <span className="ml-2">
              <AppLink href={`${ROUTES.ABOUT}#aboutAuthor`}>Patrik Bak</AppLink>
            </span>
          </span>
          <span className="whitespace-nowrap">
            <span className="text-lg">•</span>
            <span className="ml-2">
              <AppLink href={ROUTES.PRIVACY}>{tFooter('privacy')}</AppLink>
            </span>
          </span>
        </p>
      </div>
    </footer>
  )
}
