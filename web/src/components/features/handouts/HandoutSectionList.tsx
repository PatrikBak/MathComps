import { ChevronRight, FileText, Lock, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { CommentCountProvider } from '@/components/features/comments/components/CommentCountContext'
import { CommentCountPill } from '@/components/features/comments/components/CommentCountPill'
import {
  type HandoutMetadata,
  type HandoutSection,
  isReadyHandout,
  type ReadyHandoutMetadata,
} from '@/components/features/handouts/handout-metadata-types'
import { AppLink } from '@/components/shared/components/AppLink'
import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import { ANCHORS, getLocalizedAnchor, type Locale, ROUTES } from '@/i18n/i18n'

import { joinAuthors, slugify } from '../../shared/utils/string-utils'

/**
 * Props for the {@link ReadyHandoutCard} component.
 */
type ReadyHandoutCardProps = {
  /** The ready handout to display */
  handout: ReadyHandoutMetadata
  /** Current locale */
  locale: Locale
}

/**
 * Renders a card for a ready (available) handout with link, author info, and comment count.
 */
function ReadyHandoutCard({ handout, locale }: ReadyHandoutCardProps) {
  // Translations for aria labels
  const tAria = useTranslations('handouts.aria')

  // Extract localized title and slug
  const title = handout.title[locale]
  const slug = handout.slug[locale]

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2.5 sm:gap-4 rounded-xl p-3 sm:p-4.5 md:p-5 border transition-all duration-200',
        'bg-surface/40 border-foreground/10 hover:bg-foreground/5 ring-1 ring-transparent hover:ring-focus/30'
      )}
    >
      {/* Main interaction - link to detail */}
      <AppLink
        href={`${ROUTES.HANDOUTS}/${slug}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 rounded-xl"
        aria-label={tAria('openHandout', { title })}
      />

      {/* Icon */}
      <FileText className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-brand-light shrink-0 relative z-10 pointer-events-none" />

      {/* Content */}
      <div className="min-w-0 flex-1 relative z-10 pointer-events-none">
        <span className="block line-clamp-2 lg:line-clamp-1 text-base sm:text-lg font-medium transition-colors leading-tight sm:leading-normal text-foreground/85 group-hover:text-foreground">
          {title}
        </span>
        <p className="mt-0.5 sm:mt-1 flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-70 shrink-0" />
          <span className="truncate">{joinAuthors(handout.authors, 2)}</span>
        </p>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4 relative z-10 shrink-0">
        {/* Comment count - Link to detail comments section */}
        <AppLink
          href={`${ROUTES.HANDOUTS}/${slug}#${getLocalizedAnchor(ANCHORS.COMMENTS, locale)}`}
          className={cn(
            'flex items-center gap-2 h-8 sm:h-9 md:h-10 px-2.5 sm:px-4 rounded-xl border border-foreground/10 bg-foreground/5 transition-all duration-200',
            ACCENT_COLOR_MAP.indigo.hoverBg,
            ACCENT_COLOR_MAP.indigo.hoverBorder,
            ACCENT_COLOR_MAP.indigo.hoverGlow
          )}
          aria-label={tAria('handoutComments')}
        >
          <CommentCountPill targetId={handout.id!} />
        </AppLink>

        {/* Arrow icon - hidden on mobile and tablet to save space */}
        <div
          className={cn(
            'hidden lg:grid place-items-center h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-full border border-foreground/10 bg-foreground/5 cursor-pointer shrink-0',
            ACCENT_COLOR_MAP.indigo.hoverBorder
          )}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform motion-safe:hover:scale-130',
              ACCENT_COLOR_MAP.indigo.text
            )}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Props for the {@link PlannedHandoutCard} component.
 */
type PlannedHandoutCardProps = {
  /** The planned handout to display */
  handout: HandoutMetadata
  /** Current locale */
  locale: Locale
}

/**
 * Renders a disabled-style card for a planned (coming soon) handout.
 */
function PlannedHandoutCard({ handout, locale }: PlannedHandoutCardProps) {
  const title = handout.title[locale]

  return (
    <div
      aria-disabled
      className={cn(
        'group relative flex items-center gap-2.5 sm:gap-4 rounded-xl p-3 sm:p-4.5 md:p-5 border transition-all duration-200',
        'bg-surface/20 border-foreground/10 opacity-80 cursor-default'
      )}
    >
      {/* Icon */}
      <Lock className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-foreground/35 shrink-0 relative z-10" />

      {/* Content */}
      <div className="min-w-0 flex-1 relative z-10 opacity-70">
        <span className="block line-clamp-2 lg:line-clamp-1 text-base sm:text-lg font-medium transition-colors leading-tight sm:leading-normal text-foreground/35">
          {title}
        </span>
      </div>
    </div>
  )
}

/**
 * Props for the {@link HandoutSectionHeader} component.
 */
type HandoutSectionHeaderProps = {
  /** The section to display */
  section: HandoutSection
  /** Current locale */
  locale: Locale
}

/**
 * Renders the header for a handout section, displaying the category name and
 * counts of available and planned handouts.
 */
function HandoutSectionHeader({ section, locale }: HandoutSectionHeaderProps) {
  // Translations for plurals
  const tPlurals = useTranslations('plurals')

  // Count available, planned and total handouts
  const availableCount = section.handouts.filter(isReadyHandout).length
  const plannedCount = section.handouts.filter((handout) => !isReadyHandout(handout)).length
  const totalCount = section.handouts.length

  // Get localized category name
  const categoryName = section.category[locale]

  return (
    <div className="border-b border-foreground/10 pb-2.5 sm:pb-3 mb-3 sm:mb-5 md:mb-6 flex items-center justify-between gap-3">
      <h2 className="text-lg sm:text-2xl font-semibold text-foreground">{categoryName}</h2>
      <span className="text-xs sm:text-sm text-muted-foreground shrink-0">
        {plannedCount > 0 ? (
          <>
            {/* Mobile: compact format */}
            <span className="sm:hidden">
              <span className="text-foreground/85 font-medium">{availableCount}</span>
              <span className="mx-1 text-muted/40">/</span>
              <span className="text-foreground/85 font-medium">{totalCount}</span>
            </span>
            {/* Desktop: detailed format */}
            <span className="hidden sm:inline">
              {tPlurals('ready', { count: availableCount })}
              <span className="mx-2 text-muted/40">/</span>
              {tPlurals('planned', { count: plannedCount })}
            </span>
          </>
        ) : (
          <>{tPlurals('available', { count: totalCount })}</>
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
  /** Current locale */
  locale: Locale
}

/**
 * Renders a list of handout sections, each with a header and a grid of cards
 * for available and planned handouts.
 */
export function HandoutSectionList({ sections, locale }: HandoutSectionListProps) {
  // Extract all handout ids for comment counts that are fetched client-side in a batch
  const handoutIds = sections.flatMap((section) =>
    section.handouts.filter(isReadyHandout).map((handout) => handout.id)
  )

  return (
    <div id="sections" className="space-y-6 sm:space-y-10 md:space-y-12">
      <CommentCountProvider targetType="Handout" targetIds={handoutIds}>
        {sections.map((section) => (
          <section key={section.category[locale]} id={slugify(section.category[locale])}>
            <HandoutSectionHeader section={section} locale={locale} />
            <ul role="list" className="grid gap-2.5 sm:gap-4 md:grid-cols-2">
              {section.handouts.map((handout) => (
                <li key={handout.title[locale]}>
                  {isReadyHandout(handout) ? (
                    <ReadyHandoutCard handout={handout} locale={locale} />
                  ) : (
                    <PlannedHandoutCard handout={handout} locale={locale} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CommentCountProvider>
    </div>
  )
}
