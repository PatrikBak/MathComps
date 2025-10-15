import { ChevronRight, FileText, Lock, User } from 'lucide-react'
import React from 'react'

import type {
  HandoutEntry,
  HandoutSection,
} from '@/components/features/handouts/types/handout-types'
import { AppLink } from '@/components/shared/components/AppLink'
import { ROUTES } from '@/constants/routes'

import { joinAuthors, slovakPlural, slugify } from '../../shared/utils/string-utils'

// #region Types

type HandoutSectionListProps = {
  sections: HandoutSection[]
}

// #endregion

// #region UI components

/**
 * Renders a link card for an available handout, showing its title, authors,
 * and an icon indicating it is accessible.
 */
function HandoutCard({ handout }: { handout: HandoutEntry }) {
  const authors = handout.authors ?? ['Patrik Bak']
  return (
    <AppLink
      href={`${ROUTES.HANDOUTS}/${handout.slug}`}
      aria-label={`Otvoriť materiál: ${handout.title}`}
      className="group block rounded-xl p-3.5 sm:p-5 md:p-6 bg-white/[0.04] border border-white/10 hover:bg-white/[0.055] ring-1 ring-transparent hover:ring-indigo-500/30 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <FileText className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-indigo-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-base sm:text-lg font-medium text-gray-200 group-hover:text-white">
            {handout.title}
          </span>
          <p className="mt-0.5 sm:mt-1 flex items-center gap-2 text-xs sm:text-sm text-gray-400 truncate">
            <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-70" />
            {joinAuthors(authors, 2)}
          </p>
        </div>
        <div className="ml-auto grid place-items-center h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full border border-white/10 bg-white/[0.06] group-hover:border-indigo-400/40">
          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-300 transition-transform motion-safe:group-hover:translate-x-0.5" />
        </div>
      </div>
    </AppLink>
  )
}

/**
 * Renders a disabled-style card for a handout that is planned but not yet
 * available, showing its title with a lock icon to indicate it's unavailable.
 */
function PlannedHandoutCard({ handout }: { handout: HandoutEntry }) {
  return (
    <div
      aria-disabled
      className="rounded-xl p-3.5 sm:p-5 md:p-6 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.03))] border border-white/8 opacity-80 cursor-default"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <Lock className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-gray-500" />
        <div className="min-w-0 flex-1 opacity-70">
          <span className="block text-base sm:text-lg font-medium text-gray-500 truncate">
            {handout.title}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Renders the header for a handout section, displaying the category name and
 * counts of available and planned handouts.
 */
function HandoutSectionHeader({ section }: { section: HandoutSection }) {
  const availableCount = section.handouts.filter((handout) => handout.filename).length
  const plannedCount = section.handouts.filter((handout) => !handout.filename).length
  const totalCount = section.handouts.length

  return (
    <div className="border-b border-white/10 pb-2.5 sm:pb-3 mb-3 sm:mb-5 md:mb-6 flex items-center justify-between gap-3">
      <h2 className="text-lg sm:text-2xl font-semibold text-white">{section.category}</h2>
      <span className="text-xs sm:text-sm text-gray-400 shrink-0">
        {plannedCount > 0 ? (
          <>
            {/* Mobile: compact format */}
            <span className="sm:hidden">
              <span className="text-gray-200 font-medium">{availableCount}</span>
              <span className="mx-1 text-gray-600">/</span>
              <span className="text-gray-200 font-medium">{totalCount}</span>
            </span>
            {/* Desktop: detailed format */}
            <span className="hidden sm:inline">
              <span className="text-gray-200 font-medium">{availableCount}</span>{' '}
              {slovakPlural(availableCount, ['hotový', 'hotové', 'hotových'])}
              <span className="mx-2 text-gray-600">/</span>
              <span className="text-gray-200 font-medium">{plannedCount}</span>{' '}
              {slovakPlural(plannedCount, ['plánovaný', 'plánované', 'plánovaných'])}
            </span>
          </>
        ) : (
          <>
            <span className="text-gray-200 font-medium">{totalCount}</span>{' '}
            {slovakPlural(totalCount, ['dostupný', 'dostupné', 'dostupných'])}
          </>
        )}
      </span>
    </div>
  )
}

/**
 * Renders a list of handout sections, each with a header and a grid of cards
 * for available and planned handouts.
 */
export function HandoutSectionList({ sections }: HandoutSectionListProps) {
  if (sections.length === 0) {
    return <div className="text-gray-400">Žiadne materiály neboli nájdené.</div>
  }

  return (
    <div id="sections" className="space-y-6 sm:space-y-10 md:space-y-12">
      {sections.map((section) => (
        <section key={section.category} id={slugify(section.category)}>
          <HandoutSectionHeader section={section} />
          <ul role="list" className="grid gap-2.5 sm:gap-4 md:grid-cols-2">
            {section.handouts.map((handout) => (
              <li key={handout.slug}>
                {handout.filename ? (
                  <HandoutCard handout={handout} />
                ) : (
                  <PlannedHandoutCard handout={handout} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

// #endregion
