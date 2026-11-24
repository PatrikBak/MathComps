'use client'

import { Link } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

import { useProblemPermalink } from '../hooks/use-problem-permalink'
import type { SimilarProblem } from '../types/problem-api-types'
import { IconButton } from './IconButton'

/**
 * The hue a perfect match reads in, on the colour wheel: green. A score of nothing reads at zero, red, and everything
 * between runs along the wheel.
 */
const FULL_MATCH_HUE = 120

/**
 * The props of {@link SimilarityScoreIndicator}.
 */
type SimilarityScoreIndicatorProps = {
  /** How close the problem is, from 0 for nothing alike to 1 for a match. */
  score: number
}

/**
 * How close a similar problem is, as a bar and a percentage running from red to green.
 */
function SimilarityScoreIndicator({ score }: SimilarityScoreIndicatorProps) {
  // Problems library translations
  const tProblems = useTranslations('problems')

  // The score as a whole percentage
  const percentage = (score * 100).toFixed(0)

  // The colour the score reads in
  const color = `hsl(${score * FULL_MATCH_HUE}, 60%, 50%)`

  return (
    <div className="flex items-center gap-2" title={tProblems('relevance', { percentage })}>
      {/* The bar */}
      <div className="w-16 h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>

      {/* The percentage */}
      <span className="text-xs font-semibold" style={{ color }}>
        {percentage}%
      </span>
    </div>
  )
}

/**
 * The props of {@link SimilarProblemItem}.
 */
type SimilarProblemItemProps = {
  /** The similar problem. */
  problem: SimilarProblem
  /** Its place among the similar problems, counting from one. */
  ordinalNumber: number
}

/**
 * One similar problem: its number and name, how close it is, its link, and its statement.
 */
function SimilarProblemItem({ problem, ordinalNumber }: SimilarProblemItemProps) {
  // A function which copies a problem's link
  const copyPermalink = useProblemPermalink()

  // Translations for the shared actions
  const tActions = useTranslations('ui.actions')

  return (
    <div>
      {/* Header: the number and the problem's name, how close it is, and its permalink */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-foreground">
            <span className="mr-1 text-xs tabular-nums text-muted">{`#${ordinalNumber}`}</span>{' '}
            <span className="font-medium">{problem.slug.toUpperCase()}</span>
          </span>
          <SimilarityScoreIndicator score={problem.similarityScore} />
        </div>
        <IconButton
          Icon={Link}
          title={tActions('getPermalink')}
          onClick={() => copyPermalink(problem.slug)}
        />
      </div>

      {/* The statement */}
      <div className="mt-1.5 text-sm text-muted-foreground">
        <div className="math-typography math-trim-edges">
          <RichMathEditorRenderer content={problem.statementMarkdown} imageContext="problems" />
        </div>
      </div>
    </div>
  )
}

/**
 * The props of {@link SimilarProblemView}.
 */
type SimilarProblemViewProps = {
  /** The problems similar to the card's own. */
  similarProblems: SimilarProblem[]
}

/**
 * The problems similar to a card's own, set apart from what's above them by a hairline.
 */
export function SimilarProblemView({ similarProblems }: SimilarProblemViewProps) {
  // Problems library translations
  const tProblems = useTranslations('problems')

  return (
    <div className="mt-3 border-t border-foreground/10 pt-4">
      <div className="space-y-5">
        {/* What the scores mean */}
        <p className="text-xs text-muted italic">{tProblems('relevanceNote')}</p>

        {/* The problems */}
        {similarProblems.map((similarProblem, index) => (
          <SimilarProblemItem
            key={similarProblem.slug}
            problem={similarProblem}
            ordinalNumber={index + 1}
          />
        ))}
      </div>
    </div>
  )
}
