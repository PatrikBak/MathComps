'use client'

import { Link } from 'lucide-react'

import type { RawContentBlock } from '@/components/features/handouts/types/handout-types'
import { ProblemContentRenderer } from '@/components/math/ProblemContentRenderer'
import { cn } from '@/components/shared/utils/css-utils'

import { useProblemPermalink } from '../hooks/use-problem-permalink'
import type { Problem, SimilarProblem } from '../types/problem-api-types'
import { IconButton } from './IconButton'

const SimilarityScoreIndicator = ({ score }: { score: number }) => {
  const percentage = (score * 100).toFixed(0)
  const hue = score * 120 // 0 = red, 1 = green
  const color = `hsl(${hue}, 60%, 50%)`

  return (
    <div className="flex items-center gap-2" title={`Relevancia: ${percentage}%`}>
      <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
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
  const { copyPermalink } = useProblemPermalink()

  const handlePermalinkCopy = () => {
    copyPermalink(problem.slug)
  }
  return (
    <div className="overflow-hidden border rounded-lg bg-gray-800/50 border-gray-700">
      <div className="relative px-4 py-3 border-b border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          {/* Grouping element for positioning the similarity indicator */}
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 text-sm font-medium">#{ordinalNumber}</span>
              <span className="text-base font-semibold text-white">
                {problem.slug.toUpperCase()}
              </span>
            </div>
            {/* Absolutely positioned indicator, relative to the group above */}
            <div className="absolute left-0 top-full pt-1.5">
              <SimilarityScoreIndicator score={problem.similarityScore} />
            </div>
          </div>
          <IconButton Icon={Link} title="Získať permalink" onClick={handlePermalinkCopy} />
        </div>
        {/* Spacer to create empty space for the absolutely positioned element */}
        <div className="h-6" />
      </div>

      <div className="p-4 text-sm text-gray-300">
        {problem.statement ? (
          (() => {
            try {
              const parsedText = JSON.parse(problem.statement) as {
                content: RawContentBlock[]
              }
              // Include images from similar problem metadata
              return (
                <div className="problem-card-math">
                  <ProblemContentRenderer content={parsedText.content} images={problem.images} />
                </div>
              )
            } catch (error) {
              console.warn('Failed to parse statement content:', error)
              return <span>Error loading problem statement</span>
            }
          })()
        ) : (
          <span>No problem statement available</span>
        )}
      </div>
    </div>
  )
}

export const SimilarProblemView = ({ view, problem }: SimilarProblemViewProps) => {
  if (!view) return null

  const renderContent = () => {
    switch (view) {
      case 'similar':
        if (!problem.similarProblems || problem.similarProblems.length === 0) {
          return (
            <div className="text-center text-gray-400">
              <p>Nenašli sa žiadne podobné úlohy s dostatočnou relevanciou.</p>
            </div>
          )
        }
        return (
          <div className="space-y-4">
            <div className="flex justify-end mb-4">
              <p className="text-xs text-gray-500 italic">Relevancia je orientačná</p>
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
        return null
    }
  }

  return (
    <div
      className={cn(
        view === 'similar' ? 'pl-10 pr-6 py-5' : 'px-6 py-5',
        'border-t border-gray-700 bg-gray-900/50'
      )}
    >
      {renderContent()}
    </div>
  )
}
