'use client'

import { Link } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import { useProblemPermalink } from '../hooks/use-problem-permalink'
import type { Problem, SimilarProblem } from '../types/problem-api-types'
import { IconButton } from './IconButton'

const SimilarityScoreIndicator = ({ score }: { score: number }) => {
  const tProblems = useTranslations('problems')
  const percentage = (score * 100).toFixed(0)
  const hue = score * 120 // 0 = red, 1 = green
  const color = `hsl(${hue}, 60%, 50%)`

  return (
    <div className="flex items-center gap-2" title={tProblems('relevance', { percentage })}>
      <div className="w-16 h-2 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {percentage}%
      </span>
    </div>
  )
}

export type SimilarProblemViewMode = 'similar' | null

type SimilarProblemViewProps = {
  view: SimilarProblemViewMode
  problem: Problem
}

// A smaller, nested card for displaying similar problems
const SimilarProblemCard = ({
  problem,
  ordinalNumber,
}: {
  problem: SimilarProblem
  ordinalNumber: number
}) => {
  const copyPermalink = useProblemPermalink()
  const tActions = useTranslations('ui.actions')

  const handlePermalinkCopy = () => {
    copyPermalink(problem.slug)
  }
  return (
    <div className="overflow-hidden border rounded-lg bg-surface/50 border-foreground/10">
      <div className="relative px-4 py-3 border-b border-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Grouping element for positioning the similarity indicator */}
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="text-muted text-sm font-medium">#{ordinalNumber}</span>
              <span className="text-base font-semibold text-foreground">
                {problem.slug.toUpperCase()}
              </span>
            </div>
            {/* Absolutely positioned indicator, relative to the group above */}
            <div className="absolute left-0 top-full pt-1.5">
              <SimilarityScoreIndicator score={problem.similarityScore} />
            </div>
          </div>
          <IconButton Icon={Link} title={tActions('getPermalink')} onClick={handlePermalinkCopy} />
        </div>
        {/* Spacer to create empty space for the absolutely positioned element */}
        <div className="h-6" />
      </div>

      <div className="p-4 text-sm text-muted-foreground">
        <div className="math-typography">
          <RichMathEditorRenderer
            content={problem.statementMarkdown}
            imageContext="problems"
            lightImageBackground
          />
        </div>
      </div>
    </div>
  )
}

export const SimilarProblemView = ({ view, problem }: SimilarProblemViewProps) => {
  const tProblems = useTranslations('problems')
  if (!view) return null

  const renderContent = () => {
    switch (view) {
      case 'similar':
        if (!problem.similarProblems || problem.similarProblems.length === 0) {
          return (
            <div className="text-center text-muted">
              <p>{tProblems('noSimilarProblems')}</p>
            </div>
          )
        }
        return (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <p className="text-xs text-muted italic">{tProblems('relevanceNote')}</p>
            </div>
            {problem.similarProblems.map((similarProblem, index) => (
              <SimilarProblemCard
                key={similarProblem.slug}
                problem={similarProblem}
                ordinalNumber={index + 1}
              />
            ))}
          </div>
        )

      default:
        return assertNever(view)
    }
  }

  return (
    <div
      className={cn(
        view === 'similar' ? 'pl-10 pr-6 py-5' : 'px-6 py-5',
        'border-t border-foreground/10 bg-surface/50'
      )}
    >
      {renderContent()}
    </div>
  )
}
