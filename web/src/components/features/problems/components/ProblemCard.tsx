'use client'

import { ChevronDown, ExternalLink, Eye, EyeOff, Link, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { RawContentBlock } from '@/components/features/handouts/types/handout-types'
import { ProblemContentRenderer } from '@/components/math/ProblemContentRenderer'
import { cn } from '@/components/shared/utils/css-utils'

import { useProblemPermalink } from '../hooks/use-problem-permalink'
import type { Problem } from '../types/problem-api-types'
import { sortTagsByCategory } from '../utils/tag-utils'
import Chip from './Chip'
import type { SimilarProblemViewMode } from './SimilarProblemView'
import { SimilarProblemView } from './SimilarProblemView'

/**
 * Props for the ProblemCard component that displays a mathematical problem with its metadata and interactive features.
 *
 * @param problem - The problem data containing statement, tags, authors, and similar problems
 * @param ordinalNumber - Sequential number to display in the card header
 * @param areTechniquesGloballyVisible - Whether solution techniques should be shown globally across all cards
 * @param onTagClick - Callback when a tag is clicked for filtering
 * @param selectedTagSlugs - Set of currently selected tag slugs for highlighting
 * @param activeTechniqueFilterSlugs - Set of technique tag slugs that are actively being filtered (useful when technique tags are hidden in general - these should not be hidden though)
 * @param onAuthorClick - Callback when an author name is clicked for filtering
 * @param selectedAuthorSlugs - Set of currently selected author slugs for highlighting
 */
export type ProblemCardProps = {
  problem: Problem
  ordinalNumber: number
  areTechniquesGloballyVisible: boolean
  onTagClick: (tag: { displayName: string; slug: string }) => void
  selectedTagSlugs: Set<string>
  activeTechniqueFilterSlugs: Set<string>
  onAuthorClick: (author: { displayName: string; slug: string }) => void
  selectedAuthorSlugs: Set<string>
}

/**
 * Renders a problem card with interactive features for filtering, permalink sharing, and technique visibility.
 *
 * The card displays the problem statement, metadata (authors, tags), and provides controls for:
 * - Revealing/hiding solution techniques
 * - Filtering by tags and authors
 * - Sharing permalinks
 * - Viewing similar problems
 *
 * @param props - The component props containing problem data and interaction handlers
 * @returns JSX element representing the problem card
 */
export function ProblemCard({
  problem,
  ordinalNumber,
  areTechniquesGloballyVisible,
  onTagClick,
  selectedTagSlugs,
  activeTechniqueFilterSlugs,
  onAuthorClick,
  selectedAuthorSlugs,
}: ProblemCardProps) {
  const [expandedView, setExpandedView] = useState<SimilarProblemViewMode>(null)
  const [areTechniquesLocallyVisible, setAreTechniquesLocallyVisible] = useState(false)
  const { copyPermalink } = useProblemPermalink()

  /**
   * Toggles the expanded view for similar problems section.
   *
   * @param view - The view mode to toggle (null to collapse)
   */
  const toggleView = (view: SimilarProblemViewMode) => {
    setExpandedView((currentView) => (currentView === view ? null : view))
  }

  /**
   * Handles copying the permalink for the current problem to clipboard.
   */
  const handlePermalinkCopy = useCallback(() => {
    copyPermalink(problem.slug)
  }, [problem.slug, copyPermalink])

  // Reset local reveal state when global techniques are hidden
  useEffect(() => {
    if (!areTechniquesGloballyVisible) {
      setAreTechniquesLocallyVisible(false)
    }
  }, [areTechniquesGloballyVisible])

  // Calculate technique tag visibility based on global settings and active filters
  const { hiddenTechniqueCount, hasVisibleTechniques } = useMemo(() => {
    const allTechniqueTags = problem.tags.filter((tag) => tag.tagType === 'Technique')
    const visibleDueToFilter = allTechniqueTags.filter((tag) =>
      activeTechniqueFilterSlugs.has(tag.slug)
    )

    // Technique tags are hidden if they're not part of an active filter
    const hiddenCount = allTechniqueTags.length - visibleDueToFilter.length
    return {
      hiddenTechniqueCount: hiddenCount,
      hasVisibleTechniques: visibleDueToFilter.length > 0,
    }
  }, [problem.tags, activeTechniqueFilterSlugs])

  // Determine if the "reveal techniques" chip should be shown
  // Only show when techniques are globally hidden, locally not revealed, and there are hidden techniques
  const showRevealChip =
    !areTechniquesGloballyVisible && !areTechniquesLocallyVisible && hiddenTechniqueCount > 0

  return (
    <div
      className={cn(
        'bg-slate-800/90 border rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:border-slate-500/80',
        // Highlight border when similar problems section is expanded
        expandedView !== null ? 'border-indigo-500' : 'border-slate-600/60'
      )}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b border-slate-600/60">
        <div className="flex items-center gap-3">
          {/* Display ordinal number for list context */}
          <span className="text-gray-400 text-sm font-medium">#{ordinalNumber}</span>
          {/* Problem identifier in uppercase for consistency */}
          <h2 className="text-base font-medium text-gray-100">{problem.slug.toUpperCase()}</h2>
        </div>
        {/* Action buttons for solution link and permalink sharing */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* External solution link if available */}
          {problem.solutionLink && (
            <a
              href={problem.solutionLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors duration-200 rounded-md hover:bg-slate-700/50"
              title="Odkaz na riešenie (otvorí sa v novom okne)"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline">Riešenie</span>
            </a>
          )}
          {/* Permalink sharing button */}
          <button
            onClick={handlePermalinkCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors duration-200 rounded-md hover:bg-slate-700/50"
            title="Zdieľať"
          >
            <Link size={16} />
            <span className="hidden sm:inline">Zdieľať</span>
          </button>
        </div>
      </div>

      {/* Problem statement content with math rendering */}
      <div className="px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5 leading-relaxed text-gray-200 text-base">
        {problem.statementParsed ? (
          (() => {
            try {
              const parsedStatementContent = JSON.parse(problem.statementParsed) as {
                content: RawContentBlock[]
              }
              return (
                <div className="problem-card-math">
                  <ProblemContentRenderer
                    content={parsedStatementContent.content}
                    images={problem.images}
                  />
                </div>
              )
            } catch (parsingError) {
              console.warn('Failed to parse statement content:', parsingError)
              return <span>Error loading problem statement</span>
            }
          })()
        ) : (
          <span>No problem statement available</span>
        )}
        {/* Author attribution with optional filtering */}
        {problem.authors.length > 0 && (
          <div className="flex items-center justify-end mt-3 sm:mt-4 italic text-gray-400">
            <User size={14} className="mr-1.5 flex-shrink-0" />
            <div className="flex flex-wrap items-center gap-1">
              {problem.authors.map((author, authorIndex) => {
                // Determine author styling based on selection state
                const authorStyling = {
                  selected: 'text-slate-200 font-medium',
                  unselected: 'text-gray-400 hover:text-gray-200',
                }
                const isAuthorSelected = selectedAuthorSlugs.has(author.slug)
                const authorClassName = authorStyling[isAuthorSelected ? 'selected' : 'unselected']

                return (
                  <span key={author.slug} className="flex items-center">
                    <button
                      onClick={() => onAuthorClick(author)}
                      className={cn(
                        'text-sm transition-colors duration-200 hover:underline',
                        authorClassName
                      )}
                      title={`Filtrovať podľa autora: ${author.displayName}`}
                    >
                      {author.displayName}
                    </button>
                    {/* Add comma separator between multiple authors */}
                    {authorIndex < problem.authors.length - 1 && (
                      <span className="mx-1 text-gray-500">,</span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tag display with technique visibility controls */}
      <div className="border-t bg-slate-800/50 border-slate-600/60">
        <div className="px-3 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Render tags sorted by category with technique visibility logic */}
            {sortTagsByCategory(problem.tags)
              .filter((tag) => {
                if (tag.tagType !== 'Technique') {
                  return true // Always show non-technique tags
                }
                // Show technique tags if globally visible, locally revealed, or part of an active filter
                return (
                  areTechniquesGloballyVisible ||
                  areTechniquesLocallyVisible ||
                  activeTechniqueFilterSlugs.has(tag.slug)
                )
              })
              .map((tag) => (
                <Chip
                  key={tag.slug}
                  onClick={() => onTagClick({ displayName: tag.displayName, slug: tag.slug })}
                  clickable={true}
                  isSelected={selectedTagSlugs.has(tag.slug)}
                >
                  {tag.displayName}
                </Chip>
              ))}
            {/* Special chip to reveal hidden technique tags */}
            {showRevealChip && (
              <Chip
                onClick={() => setAreTechniquesLocallyVisible(true)}
                clickable={true}
                className="!bg-purple-600/30 !text-purple-200 hover:!bg-purple-600/50"
                title="Zobraziť skryté techniky riešenia pre túto úlohu"
              >
                <div className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  <span>
                    {hasVisibleTechniques ? 'Zobraziť ďalšie techniky' : 'Zobraziť techniky'}
                  </span>
                  {/* Badge showing count of hidden techniques */}
                  <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-medium text-purple-200 bg-purple-600/50 rounded-full">
                    {hiddenTechniqueCount}
                  </span>
                </div>
              </Chip>
            )}
          </div>
        </div>

        {/* Expandable section for similar problems */}
        {problem.similarProblems && problem.similarProblems.length > 0 && (
          <button
            onClick={() => toggleView('similar')}
            className={`w-full px-3 py-2 sm:px-4 sm:py-3 lg:px-6 flex items-center justify-center border-t border-slate-600/40 transition-all duration-200 ${
              expandedView === 'similar'
                ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                : 'hover:bg-slate-700/30'
            }`}
            title="Zobraziť/skryť podobné úlohy"
          >
            <div className="flex items-center gap-2.5">
              {/* Toggle between eye and eye-off icons based on expansion state */}
              {expandedView === 'similar' ? (
                <EyeOff size={18} className="text-gray-400" />
              ) : (
                <Eye size={18} className="text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-200">Podobné úlohy</span>
              {/* Badge showing count of similar problems */}
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 text-xs font-semibold text-indigo-200 bg-indigo-500/30 rounded-full border border-indigo-400/30">
                {problem.similarProblems.length}
              </span>
              {/* Chevron that rotates when expanded */}
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform duration-200 ml-1 ${
                  expandedView === 'similar' ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>
        )}
      </div>

      {/* Render expanded content when similar problems section is opened */}
      <SimilarProblemView view={expandedView} problem={problem} />
    </div>
  )
}
