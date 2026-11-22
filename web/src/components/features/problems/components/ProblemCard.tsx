import { ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { CommentModal } from '@/components/features/comments/components/CommentModal'
import { useCommentModal } from '@/components/features/comments/hooks/use-comment-modal'
import { AppLink } from '@/components/shared/components/AppLink'
import { PROBLEM_ROW_CLASS, ProblemRowLabel } from '@/components/shared/components/ProblemRow'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import { useProblem } from '@/stores/problem-store'

import { PROBLEM_CARD_LAYOUTS } from '../constants/problem-card-layouts'
import { PROBLEM_CARD_ATTRIBUTE } from '../constants/problem-list-attributes'
import type {
  AuthorClickHandler,
  ProblemCardView,
  TagClickHandler,
} from '../types/problem-card-types'
import { ProblemAuthorCredit } from './ProblemAuthorCredit'
import { ProblemCardActions } from './ProblemCardActions'
import { ProblemTagLine } from './ProblemTagLine'
import { SimilarProblemView } from './SimilarProblemView'

/**
 * Props for the {@link ProblemCard} component.
 */
export type ProblemCardProps = {
  /** The slug of the problem the card shows. */
  problemSlug: string
  /** The card's place in the list, counting from one. */
  ordinalNumber: number
  /** How the card is drawn. */
  view: ProblemCardView
  /** Whether technique tags show on every card. */
  areTechniquesGloballyVisible: boolean
  /** {@link TagClickHandler}. */
  onTagClick: TagClickHandler
  /** The slugs of the tags filtered on. */
  selectedTagSlugs: Set<string>
  /** The slugs of the technique tags filtered on, which show even while techniques are hidden. */
  activeTechniqueFilterSlugs: Set<string>
  /** {@link AuthorClickHandler}. */
  onAuthorClick: AuthorClickHandler
  /** The slugs of the authors filtered on. */
  selectedAuthorSlugs: Set<string>
  /** Shows the problems of one of the reader's lists, by the list's content id. */
  onSelectList: (contentId: string) => void
}

/**
 * A problem's card in the library: its number and name, what can be done to it, the statement closed by its authors,
 * its tags, and the rows opening its solution and the problems similar to it. A click on a tag or an author hands it to
 * the filters.
 *
 * Drawn compact, the card keeps only its number, the problem's name and the statement.
 */
export function ProblemCard({
  problemSlug,
  ordinalNumber,
  view,
  areTechniquesGloballyVisible,
  onTagClick,
  selectedTagSlugs,
  activeTechniqueFilterSlugs,
  onAuthorClick,
  selectedAuthorSlugs,
  onSelectList,
}: ProblemCardProps) {
  // The problem, once it has loaded
  const problem = useProblem(problemSlug)

  // Problems library translations
  const tProblems = useTranslations('problems')

  // Whether the reader opened the similar problems under the statement
  const [isSimilarOpen, setIsSimilarOpen] = useState(false)

  // The problem's comments modal
  const commentModal = useCommentModal({ targetType: 'Problem', targetId: problemSlug })

  // How the card is laid out in the view it is drawn in
  const layout = PROBLEM_CARD_LAYOUTS[view]

  // The problem's authors, once it has loaded
  const authors = problem?.authors

  // The authors closing the statement, none in a compact card or for a problem nobody is credited with. Kept the same
  // element while nothing it shows changes, since a new one draws the whole statement again
  const authorCredit = useMemo(
    () =>
      layout.hasDetails && authors !== undefined && authors.length > 0 ? (
        <ProblemAuthorCredit
          authors={authors}
          selectedAuthorSlugs={selectedAuthorSlugs}
          onAuthorClick={onAuthorClick}
        />
      ) : undefined,
    [layout.hasDetails, authors, selectedAuthorSlugs, onAuthorClick]
  )

  // A problem still on its way has no card yet
  if (!problem) {
    return null
  }

  // Whether any similar problem was found
  const hasSimilarProblems = problem.similarProblems.length > 0

  // Whether the card has a row to offer under its statement
  const hasRows = problem.solutionLink !== null || hasSimilarProblems

  // Whether the similar problems show: opened, on a card with room for them
  const areSimilarShown = layout.hasDetails && isSimilarOpen

  return (
    // The card, stating which problem it is so it can be found among the rest
    <div {...PROBLEM_CARD_ATTRIBUTE.stamp(problem.slug)}>
      {/* The card itself */}
      <SurfacePanel
        as="article"
        radius="xl"
        className={cn(
          'transition-[border-color,opacity] duration-300',
          layout.paddingClass,
          // Edged in the focus hue while its similar problems are open
          areSimilarShown && 'border-focus/40',
          // Dimmed once marked as dealt with
          problem.marked && 'opacity-50'
        )}
      >
        {/* Header: the number and the problem's name, then what can be done to it */}
        <header className="flex items-start gap-3">
          <h2 className="min-w-0 flex-1 text-sm text-foreground hyphens-none sm:text-base">
            <span className="mr-1 text-xs tabular-nums text-muted sm:text-sm">{`#${ordinalNumber}`}</span>{' '}
            <span className="font-medium">{problem.slug.toUpperCase()}</span>
          </h2>

          {layout.hasDetails && (
            <ProblemCardActions
              problem={problem}
              onOpenComments={commentModal.open}
              onSelectList={onSelectList}
            />
          )}
        </header>

        {/* Statement */}
        <div
          className={cn(
            'leading-relaxed text-muted-foreground text-[14px] sm:text-base',
            layout.statementGapClass
          )}
        >
          <div className="math-typography math-trim-edges">
            <RichMathEditorRenderer
              content={problem.statementMarkdown}
              imageContext="problems"
              closing={authorCredit}
            />
          </div>
        </div>

        {/* Tags */}
        {layout.hasDetails && (
          <ProblemTagLine
            tags={problem.tags}
            areTechniquesGloballyVisible={areTechniquesGloballyVisible}
            activeTechniqueFilterSlugs={activeTechniqueFilterSlugs}
            selectedTagSlugs={selectedTagSlugs}
            onTagClick={onTagClick}
          />
        )}

        {/* Rows opening the solution and the similar problems, pulled out by their padding so what a row says starts
            on the statement's left edge */}
        {layout.hasDetails && hasRows && (
          <div className="-mx-3 mt-2 flex flex-wrap gap-1">
            {/* Solution, opening in a new tab */}
            {problem.solutionLink !== null && (
              <AppLink
                href={problem.solutionLink}
                newTab
                plain
                className={PROBLEM_ROW_CLASS}
                title={tProblems('solutionLink')}
              >
                <ProblemRowLabel label={tProblems('solution')} icon={ExternalLink} count={null} />
              </AppLink>
            )}

            {/* Similar problems, opening under the statement */}
            {hasSimilarProblems && (
              <button
                type="button"
                onClick={() => setIsSimilarOpen(!isSimilarOpen)}
                aria-expanded={isSimilarOpen}
                className={cn(PROBLEM_ROW_CLASS, isSimilarOpen && 'bg-foreground/5')}
              >
                <ProblemRowLabel
                  label={tProblems('similarProblems')}
                  icon={isSimilarOpen ? EyeOff : Eye}
                  count={{ value: problem.similarProblems.length }}
                />
              </button>
            )}
          </div>
        )}

        {/* Similar problems, once opened */}
        {areSimilarShown && <SimilarProblemView similarProblems={problem.similarProblems} />}
      </SurfacePanel>

      {/* Comments */}
      <CommentModal
        isOpen={commentModal.isOpen}
        onClose={commentModal.close}
        title={problem.slug.toUpperCase()}
        target={{ targetType: 'Problem', targetId: problem.slug }}
      />
    </div>
  )
}
