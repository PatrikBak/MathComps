import React from 'react'

import MathCompsLogo from '@/components/layout/MathCompsLogo'
import { AppLink } from '@/components/shared/components/AppLink'
import { ROUTES } from '@/constants/routes'

export default function Footer() {
  let dot = <span className="mx-2 text-lgborder-1 leading-0">•</span>
  return (
    <footer className="bg-slate-950/80 border-t border-slate-800/50">
      <div className="max-w-5xl mx-auto px-6 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8 text-base">
          {/* Brand Section */}
          <div className="col-span-1 md:col-span-2 pr-8">
            <MathCompsLogo className="mb-3 sm:mb-4" />
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed text-balance">
              Dlhodobobou víziou projektu je vytvoriť platformu pre začínajúcich i&nbsp;pokročilých
              riešiteľov matematických súťaží, ich tútorov a&nbsp;všetkých priaznivcov.
            </p>
          </div>

          {/* Navigation Sections - Side by side on mobile */}
          <div className="flex justify-evenly text-center md:gap-12 md:text-left md:col-span-2">
            {/* Navigation Links */}
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base tracking-wider mb-3 sm:mb-5">
                Navigácia
              </h3>
              <ul className="space-y-2 text-sm sm:text-base">
                <li>
                  <AppLink href={ROUTES.PROBLEMS}>Úlohy</AppLink>
                </li>
                <li>
                  <AppLink href={ROUTES.HANDOUTS}>Materiály</AppLink>
                </li>
                <li>
                  <AppLink href={ROUTES.GUIDE}>Rozcestník</AppLink>
                </li>
              </ul>
            </div>

            {/* Project Links */}
            <div>
              <h3 className="font-semibold text-white text-sm sm:text-base tracking-wider mb-3 sm:mb-5">
                Projekt
              </h3>
              <ul className="space-y-2 text-sm sm:text-base">
                <li>
                  <AppLink href={ROUTES.ABOUT}>O projekte</AppLink>
                </li>
                <li>
                  <AppLink href="/#contribute-section">Chcem prispieť</AppLink>
                </li>
                <li>
                  <AppLink href="/#sponsorship-section">Sponzori</AppLink>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-800/50 flex flex-col items-center text-center gap-2">
          <p className="text-slate-400 text-sm sm:text-base">
            <span className="whitespace-nowrap">MathComps</span>
            {dot}
            <span className="whitespace-nowrap">© 2025</span>
            {dot}
            <AppLink href={`${ROUTES.ABOUT}#aboutAuthor`} className="whitespace-nowrap">
              Patrik Bak
            </AppLink>
          </p>
        </div>
      </div>
    </footer>
  )
}
