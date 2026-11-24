import { Eye } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactElement } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useKeyedState } from '@/hooks/use-keyed-state'

import type { TagDto } from '../types/problem-api-types'
import type { TagClickHandler } from '../types/problem-card-types'
import { sortTagsByCategory } from '../utils/tag-utils'
import Chip from './Chip'

/**
 * The props of {@link ProblemTagLine}.
 */
type ProblemTagLineProps = {
  /** The problem's tags. */
  tags: TagDto[]
  /** Whether technique tags show on every card. */
  areTechniquesGloballyVisible: boolean
  /** The slugs of the technique tags filtered on, which show even while techniques are hidden. */
  activeTechniqueFilterSlugs: Set<string>
  /** The slugs of the tags filtered on. */
  selectedTagSlugs: Set<string>
  /** {@link TagClickHandler}. */
  onTagClick: TagClickHandler
  /** What sits at the line's right end; undefined for nothing. */
  end: ReactElement | undefined
}

/**
 * A problem's tags, as chips filtering by them. While technique tags are hidden, the ones not filtered on stay
 * hidden behind a chip that reveals them on this card alone, until techniques are shown or hidden for every card.
 *
 * What ends the line keeps a column of its own beside the tags, level with their last row, and the tags wrap onto
 * further rows beside it.
 */
export function ProblemTagLine({
  tags,
  areTechniquesGloballyVisible,
  activeTechniqueFilterSlugs,
  selectedTagSlugs,
  onTagClick,
  end,
}: ProblemTagLineProps) {
  // Problems library translations
  const tProblems = useTranslations('problems')

  // The locale the tags are sorted in
  const locale = useLocale()

  // Whether the reader revealed this card's techniques, which holds until techniques are shown or hidden everywhere
  const [isRevealedHere, setIsRevealedHere] = useKeyedState(areTechniquesGloballyVisible, false)

  // Whether every technique tag shows
  const areTechniquesShown = areTechniquesGloballyVisible || isRevealedHere

  // The tags that show: every tag but a technique, and the techniques once shown or filtered on
  const shownTags = sortTagsByCategory(tags, locale).filter(
    (tag) =>
      tag.tagType !== 'technique' || areTechniquesShown || activeTechniqueFilterSlugs.has(tag.slug)
  )

  // How many technique tags stay hidden
  const hiddenTechniqueCount = tags.length - shownTags.length

  // Nothing to show: no tag, no way to reveal one, nothing ending the line
  if (shownTags.length === 0 && hiddenTechniqueCount === 0 && end === undefined) {
    return null
  }

  // Whether any technique tag shows already
  const hasShownTechnique = shownTags.some((tag) => tag.tagType === 'technique')

  return (
    <div className="mt-3 flex items-baseline-last gap-3">
      {/* The chips, wrapping onto as many rows as they need */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {/* The tags */}
        {shownTags.map((tag) => (
          <Chip
            key={tag.slug}
            onClick={(event) => onTagClick(tag, event)}
            isSelected={selectedTagSlugs.has(tag.slug)}
          >
            {tag.displayName}
          </Chip>
        ))}

        {/* The way to reveal the hidden techniques, counting them */}
        {hiddenTechniqueCount > 0 && (
          <Chip
            onClick={() => setIsRevealedHere(true)}
            className="bg-brand/40 text-foreground/85 hover:bg-brand/50"
            title={tProblems('showHiddenTechniques')}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              <span>
                {hasShownTechnique ? tProblems('showMoreTechniques') : tProblems('showTechniques')}
              </span>
              <span
                className={cn(
                  'inline-flex h-4 w-4 items-center justify-center rounded-full',
                  'bg-brand/50 text-xs font-medium text-foreground/85'
                )}
              >
                {hiddenTechniqueCount}
              </span>
            </span>
          </Chip>
        )}
      </div>

      {/* What ends the line */}
      {end !== undefined && <div className="shrink-0">{end}</div>}
    </div>
  )
}
