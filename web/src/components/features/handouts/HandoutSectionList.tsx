import { ChevronRight, FileText, Lock, User } from 'lucide-react'

import { CommentCountProvider } from '@/components/features/comments/components/CommentCountContext'
import { CommentCountPill } from '@/components/features/comments/components/CommentCountPill'
import type { HandoutEntry, HandoutSection } from '@/components/features/handouts/handout-types'
import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'
import { ANCHORS, ROUTES } from '@/constants/routes'

import { joinAuthors, slovakPlural, slugify } from '../../shared/utils/string-utils'

/**
 * Props for the {@link HandoutCard} component.
 */
type HandoutCardProps = {
  /** The handout to display */
  handout: HandoutEntry
}

/**
 * Renders a card for a handout. If the handout is available, it renders as a
 * link with author information and a comment count. If it's planned but not
 * yet available, it renders as a disabled-style card with a lock icon.
 */
function HandoutCard({ handout }: HandoutCardProps) {
  // Check if the handout is available
  const isAvailable = !!handout.data

  // Extract title and slug from the handout
  const { title, slug } = handout

  return (
    <div
      aria-disabled={!isAvailable}
      className={cn(
        'group relative flex items-center gap-2.5 sm:gap-4 rounded-xl p-3 sm:p-4.5 md:p-5 border transition-all duration-200',
        isAvailable
          ? 'bg-white/[0.04] border-white/10 hover:bg-white/[0.055] ring-1 ring-transparent hover:ring-indigo-500/30'
          : 'bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.03))] border-white/8 opacity-80 cursor-default'
      )}
    >
      {/* Main interaction - link to detail (available only) */}
      {isAvailable && (
        <AppLink
          href={`${ROUTES.HANDOUTS}/${slug}`}
          className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-xl"
          aria-label={`Otvoriť materiál: ${title}`}
        />
      )}

      {/* Icon */}
      {isAvailable ? (
        <FileText className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-indigo-400 shrink-0 relative z-10 pointer-events-none" />
      ) : (
        <Lock className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-gray-500 shrink-0 relative z-10" />
      )}

      {/* Content */}
      <div
        className={cn(
          'min-w-0 flex-1 relative z-10',
          isAvailable ? 'pointer-events-none' : 'opacity-70'
        )}
      >
        <span
          className={cn(
            'block line-clamp-2 lg:line-clamp-1 text-base sm:text-lg font-medium transition-colors leading-tight sm:leading-normal',
            isAvailable ? 'text-gray-200 group-hover:text-white' : 'text-gray-500'
          )}
        >
          {title}
        </span>
        {isAvailable && (
          <p className="mt-0.5 sm:mt-1 flex items-center gap-2 text-xs sm:text-sm text-gray-400">
            <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-70 shrink-0" />
            <span className="truncate">{joinAuthors(handout.data!.authors, 2)}</span>
          </p>
        )}
      </div>

      {/* Actions (for available handouts only) */}
      {isAvailable && (
        <div className="ml-auto flex items-center gap-2 sm:gap-4 relative z-10 shrink-0">
          {/* Comment count - Link to detail comments section */}
          <AppLink
            href={`${ROUTES.HANDOUTS}/${slug}#${ANCHORS.COMMENTS}`}
            className={cn(
              'flex items-center gap-2 h-8 sm:h-9 md:h-10 px-2.5 sm:px-4 rounded-xl border border-white/10 bg-white/[0.06] transition-all duration-200',
              'hover:bg-indigo-500/10 hover:border-indigo-400/40 hover:shadow-[0_0_15px_rgba(129,140,248,0.15)] group/comments'
            )}
            aria-label="Komentáre k materiálu"
          >
            <CommentCountPill slug={slug} />
          </AppLink>

          {/* Arrow icon - hidden on mobile and tablet to save space */}
          <div className="hidden lg:grid place-items-center h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full border border-white/10 bg-white/[0.06] group-hover:border-indigo-400/40 cursor-pointer shrink-0">
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-300 transition-transform motion-safe:hover:scale-115" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Props for the {@link HandoutSectionHeader} component.
 */
type HandoutSectionHeaderProps = {
  /** The section to display */
  section: HandoutSection
}

/**
 * Renders the header for a handout section, displaying the category name and
 * counts of available and planned handouts.
 */
function HandoutSectionHeader({ section }: HandoutSectionHeaderProps) {
  // Count available, planned and total handouts
  const availableCount = section.handouts.filter((handout) => handout.data?.filename).length
  const plannedCount = section.handouts.filter((handout) => !handout.data?.filename).length
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
 * Props for the {@link HandoutSectionList} component.
 */
type HandoutSectionListProps = {
  /** The sections to display */
  sections: HandoutSection[]
}

/**
 * Renders a list of handout sections, each with a header and a grid of cards
 * for available and planned handouts.
 */
export function HandoutSectionList({ sections }: HandoutSectionListProps) {
  // Extract all handout slugs for comment counts that are fetched client-side in a batch
  const handoutSlugs = sections.flatMap((section) =>
    section.handouts.filter((handout) => handout.data?.filename).map((handout) => handout.slug)
  )

  return (
    <div id="sections" className="space-y-6 sm:space-y-10 md:space-y-12">
      <CommentCountProvider targetType="Handout" slugs={handoutSlugs}>
        {sections.map((section) => (
          <section key={section.category} id={slugify(section.category)}>
            <HandoutSectionHeader section={section} />
            <ul role="list" className="grid gap-2.5 sm:gap-4 md:grid-cols-2">
              {section.handouts.map((handout) => (
                <li key={handout.slug}>
                  <HandoutCard handout={handout} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CommentCountProvider>
    </div>
  )
}
