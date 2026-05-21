import { FileText, Lock, User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { CommentCountPill } from '@/components/features/comments/components/CommentCountPill'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { AppLink } from '@/components/shared/components/AppLink'
import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import { ANCHORS, getLocalizedAnchor, type Locale, ROUTES } from '@/i18n/i18n'

import { joinAuthors } from '../../shared/utils/string-utils'
import type { HandoutMetadata, ReadyHandoutMetadata } from './handout-metadata-types'
import { HandoutStyleBadge } from './HandoutStyleBadge'

/**
 * The props for the {@link CategoryTab} component.
 */
type CategoryTabProps = {
  /** Localized category name */
  category: string
}

/**
 * Category label sitting on the top edge of the card.
 */
function CategoryTab({ category }: CategoryTabProps) {
  return (
    <span
      className={cn(
        'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10',
        'px-2 sm:px-2.5 py-px rounded-md bg-background',
        'text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-medium text-foreground/55',
        'whitespace-nowrap'
      )}
    >
      {category}
    </span>
  )
}

/**
 * Props for the {@link ReadyHandoutCard} component.
 */
type ReadyHandoutCardProps = {
  /** The ready handout to display */
  handout: ReadyHandoutMetadata
  /** Localized category name shown on the top tab */
  category: string
  /** Current locale */
  locale: Locale
}

/**
 * Card for a ready handout: a full-card overlay link to the detail page, a category
 * tab on the top border, a generic source badge, author, and a comment count pill.
 */
export function ReadyHandoutCard({ handout, category, locale }: ReadyHandoutCardProps) {
  // Translations for aria labels and source badge fallback
  const tAria = useTranslations('handouts.aria')
  const tStyles = useTranslations('handouts.styles')

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
      <CategoryTab category={category} />

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
          <MathRendererClient content={title} />
        </span>
        {/* Source badge + author on the same line; wraps if the badge runs long */}
        <p className="mt-1 sm:mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
          <HandoutStyleBadge source={handout.source} label={tStyles(handout.source)} />
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 opacity-70 shrink-0" />
            <span className="truncate">{joinAuthors(handout.authors, 2)}</span>
          </span>
        </p>
      </div>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2 sm:gap-4 relative z-10 shrink-0">
        {/* Comment count - link to detail comments section */}
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
          <CommentCountPill targetId={handout.id} />
        </AppLink>
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
  /** Localized category name shown on the top tab */
  category: string
  /** Current locale */
  locale: Locale
}

/**
 * Renders a disabled-style card for a planned (coming soon) handout with the
 * category tab on top.
 */
export function PlannedHandoutCard({ handout, category, locale }: PlannedHandoutCardProps) {
  // Extract localized title
  const title = handout.title[locale]

  return (
    <div
      aria-disabled
      className={cn(
        'group relative flex items-center gap-2.5 sm:gap-4 rounded-xl p-3 sm:p-4.5 md:p-5 border transition-all duration-200',
        'bg-surface/20 border-foreground/10 opacity-80 cursor-default'
      )}
    >
      <CategoryTab category={category} />

      {/* Icon */}
      <Lock className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-foreground/35 shrink-0 relative z-10" />

      {/* Content */}
      <div className="min-w-0 flex-1 relative z-10 opacity-70">
        <span className="block line-clamp-2 lg:line-clamp-1 text-base sm:text-lg font-medium transition-colors leading-tight sm:leading-normal text-foreground/35">
          <MathRendererClient content={title} />
        </span>
      </div>
    </div>
  )
}
