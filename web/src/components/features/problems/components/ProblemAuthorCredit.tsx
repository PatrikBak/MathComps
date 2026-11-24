import { useTranslations } from 'next-intl'
import { Fragment, memo } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { EXCLUSIVE_LONG_PRESS } from '@/components/shared/utils/event-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'

import type { LabeledSlug } from '../types/problem-api-types'
import type { AuthorClickHandler } from '../types/problem-card-types'

/**
 * The props of {@link AuthorButton}.
 */
type AuthorButtonProps = {
  /** The author the button names. */
  author: LabeledSlug
  /** Whether the author is filtered on. */
  isSelected: boolean
  /** {@link AuthorClickHandler}. */
  onAuthorClick: AuthorClickHandler
}

/**
 * One author's name, handing a click on it to the filters, and a long press as a click with the modifier held.
 */
const AuthorButton = memo(function AuthorButton({
  author,
  isSelected,
  onAuthorClick,
}: AuthorButtonProps) {
  // Problems library translations
  const tProblems = useTranslations('problems')

  // The handlers answering a long press, which a touchscreen offers in place of the modifier
  const longPressHandlers = useSmartLongPress(() => onAuthorClick(author, EXCLUSIVE_LONG_PRESS))

  return (
    <button
      onClick={(event) => onAuthorClick(author, event)}
      {...longPressHandlers}
      className={cn(
        'rounded-sm transition-colors duration-200 hover:underline select-none',
        FOCUS_RING_CLASS,
        isSelected ? 'text-foreground font-medium' : 'text-muted hover:text-foreground'
      )}
      title={tProblems('filterByAuthor', { name: author.displayName })}
    >
      {author.displayName}
    </button>
  )
})

/**
 * The props of {@link ProblemAuthorCredit}.
 */
type ProblemAuthorCreditProps = {
  /** The problem's authors, in the order they are credited. */
  authors: LabeledSlug[]
  /** The slugs of the authors filtered on. */
  selectedAuthorSlugs: Set<string>
  /** {@link AuthorClickHandler}. */
  onAuthorClick: AuthorClickHandler
}

/**
 * The authors of a problem, each name handing a click on it to the filters.
 */
export function ProblemAuthorCredit({
  authors,
  selectedAuthorSlugs,
  onAuthorClick,
}: ProblemAuthorCreditProps) {
  return (
    <span className="italic text-muted">
      {authors.map((author, authorIndex) => (
        <Fragment key={author.slug}>
          {/* The name */}
          <AuthorButton
            author={author}
            isSelected={selectedAuthorSlugs.has(author.slug)}
            onAuthorClick={onAuthorClick}
          />
          {/* A comma after every name but the last */}
          {authorIndex < authors.length - 1 && ', '}
        </Fragment>
      ))}
    </span>
  )
}
