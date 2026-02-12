import {
  Check,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Link,
  MessageSquare,
  User,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { CommentModal } from '@/components/features/comments/components/CommentModal'
import { usePendingCommentTarget } from '@/components/features/comments/hooks/use-pending-comment-target'
import type { RawContentBlock } from '@/components/features/handouts/handout-content-types'
import { ProblemContentRenderer } from '@/components/math/ProblemContentRenderer'
import { AppLink } from '@/components/shared/components/AppLink'
import { IconBadge } from '@/components/shared/components/IconBadge'
import { cn } from '@/components/shared/utils/css-utils'
import { useSmartLongPress } from '@/hooks/use-smart-long-press'
import { useProblem } from '@/stores/problem-store'

import { useProblemPermalink } from '../hooks/use-problem-permalink'
import { useToggleProblemLike } from '../hooks/use-toggle-problem-like'
import { useToggleProblemMark } from '../hooks/use-toggle-problem-mark'
import { sortTagsByCategory } from '../utils/tag-utils'
import { AddToListMenu } from './AddToListMenu'
import Chip from './Chip'
import type { SimilarProblemViewMode } from './SimilarProblemView'
import { SimilarProblemView } from './SimilarProblemView'

/**
 * Props for the {@link ProblemCard} component.
 */
export type ProblemCardProps = {
  /** The slug of the problem to display */
  problemSlug: string
  /** Sequential number to display in the card header */
  ordinalNumber: number
  /** Whether solution techniques should be shown globally across all cards */
  areTechniquesGloballyVisible: boolean
  /** Callback when a tag is clicked for filtering */
  onTagClick: (tag: { displayName: string; slug: string }, event: React.MouseEvent) => void
  /** Set of currently selected tag slugs for highlighting */
  selectedTagSlugs: Set<string>
  /**
   * Set of technique tag slugs that are actively being filtered
   * (useful when technique tags are hidden in general - these should not be hidden though)
   */
  activeTechniqueFilterSlugs: Set<string>
  /** Callback when an author name is clicked for filtering */
  onAuthorClick: (author: { displayName: string; slug: string }, event: React.MouseEvent) => void
  /** Set of currently selected author slugs for highlighting */
  selectedAuthorSlugs: Set<string>
  /** Callback when a list is selected for viewing (filter navigation) */
  onSelectList: (contentId: string) => void
}

/**
 * Author button component that can use hooks for long-press
 */
const AuthorButton = React.memo(function AuthorButton({
  author,
  isSelected,
  onAuthorClick,
}: {
  author: { displayName: string; slug: string }
  isSelected: boolean
  onAuthorClick: (author: { displayName: string; slug: string }, event: React.MouseEvent) => void
}) {
  const tProblems = useTranslations('problems')
  return (
    <button
      onClick={(event) => onAuthorClick(author, event)}
      // Long-press handler for exclusive selection
      {...useSmartLongPress(() => {
        onAuthorClick(author, {
          ctrlKey: true,
          metaKey: false,
        } as React.MouseEvent)
      })}
      className={cn(
        'text-xs sm:text-sm transition-colors duration-200 hover:underline select-none',
        isSelected ? 'text-slate-200 font-medium' : 'text-gray-400 hover:text-gray-200'
      )}
      title={tProblems('filterByAuthor', { name: author.displayName })}
    >
      {author.displayName}
    </button>
  )
})

/**
 * Renders a problem card with interactive features for filtering, permalink sharing, and technique visibility.
 *
 * The card displays the problem statement, metadata (authors, tags), and provides controls for:
 * - Revealing/hiding solution techniques
 * - Filtering by tags and authors
 * - Sharing permalinks
 * - Viewing similar problems
 * - Toggling likes
 *
 * @param props - The component props containing problem data and interaction handlers
 * @returns JSX element representing the problem card
 */
export function ProblemCard({
  problemSlug,
  ordinalNumber,
  areTechniquesGloballyVisible,
  onTagClick,
  selectedTagSlugs,
  activeTechniqueFilterSlugs,
  onAuthorClick,
  selectedAuthorSlugs,
  onSelectList,
}: ProblemCardProps) {
  // Get the problem data from the global store
  const problem = useProblem(problemSlug)

  // Stores if the similar problems view is expanded
  const [expandedView, setExpandedView] = useState<SimilarProblemViewMode>(null)

  // Stores if the techniques are locally visible (in this card
  // (even when they are globally hidden, we can show them per card basis)
  const [areTechniquesLocallyVisible, setAreTechniquesLocallyVisible] = useState(false)

  // Whether the comments modal is open
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  // Function for copying permalinks on problems
  const copyPermalink = useProblemPermalink()

  // The hook to toggle likes
  const toggleLike = useToggleProblemLike()

  // The hook to toggle mark status
  const toggleMark = useToggleProblemMark()

  // Get translations for the component
  const tProblems = useTranslations('problems')

  // Get the current locale (for sorting)
  const locale = useLocale()

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
    if (problem) {
      copyPermalink(problem.slug)
    }
  }, [problem, copyPermalink])

  // Reset local reveal state when global techniques are hidden
  useEffect(() => {
    if (!areTechniquesGloballyVisible) {
      setAreTechniquesLocallyVisible(false)
    }
  }, [areTechniquesGloballyVisible])

  // Hook for restoring comment modal state
  const { pendingTarget, clearPendingTarget } = usePendingCommentTarget()

  // Check for pending comment target on mount (after login redirect)
  useEffect(() => {
    // If this problem has a pending comment target
    if (
      problem &&
      pendingTarget &&
      pendingTarget.targetType === 'Problem' &&
      pendingTarget.targetId === problem.slug
    ) {
      // Open the comments modal
      setIsCommentsOpen(true)
    }
  }, [problem, pendingTarget])

  // Calculate technique tag visibility based on global settings and active filters
  const { hiddenTechniqueCount, hasVisibleTechniques } = useMemo(() => {
    // We need to have a problem to return something meaningful
    if (!problem) {
      return {
        hiddenTechniqueCount: 0,
        hasVisibleTechniques: false,
      }
    }

    // Get all technique tags
    const allTechniqueTags = problem.tags.filter((tag) => tag.tagType === 'Technique')

    // Get technique tags that are part of an active filter
    const visibleDueToFilter = allTechniqueTags.filter((tag) =>
      activeTechniqueFilterSlugs.has(tag.slug)
    )

    // Technique tags are hidden if they're not part of an active filter
    const hiddenCount = allTechniqueTags.length - visibleDueToFilter.length

    // Return the number of hidden technique tags and whether any are visible
    return {
      hiddenTechniqueCount: hiddenCount,
      hasVisibleTechniques: visibleDueToFilter.length > 0,
    }
  }, [problem, activeTechniqueFilterSlugs])

  // Determine if the "reveal techniques" chip should be shown
  // Only show when techniques are globally hidden, locally revealed, and there are hidden techniques
  const showRevealChip =
    !areTechniquesGloballyVisible && !areTechniquesLocallyVisible && hiddenTechniqueCount > 0

  // If problem hasn't loaded yet, nothing to render or do
  if (!problem) {
    return null
  }

  return (
    <div
      className={cn(
        'bg-slate-800 border rounded-lg shadow-lg overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/10 hover:border-slate-500/80',
        // Highlight border when similar problems section is expanded
        expandedView !== null ? 'border-indigo-500' : 'border-slate-600/60',
        // Dim marked cards for a "dealt with" feel
        problem.marked && 'opacity-50'
      )}
    >
      {/* Card Header — slug left, action icons right */}
      <div className="flex items-center justify-between px-2.5 py-1.5 sm:px-4 sm:py-3 lg:px-6 lg:py-4 border-b border-slate-600/60">
        {/* Problem identity */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-gray-400 text-xs sm:text-sm font-medium">#{ordinalNumber}</span>
          <h2 className="text-sm sm:text-base font-medium text-gray-100">
            {problem.slug.toUpperCase()}
          </h2>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mark toggle button */}
          <button
            onClick={() => toggleMark(problem.slug)}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all duration-200 rounded-md hover:bg-slate-700/50"
            title={problem.marked ? tProblems('marks.unmark') : tProblems('marks.mark')}
          >
            <Check
              size={14}
              className={cn(
                'sm:!w-[18px] sm:!h-[18px] transition-all duration-500',
                problem.marked ? 'text-emerald-400' : 'text-gray-400'
              )}
              strokeWidth={problem.marked ? 3 : 2}
            />
          </button>

          {/* Like button */}
          <button
            onClick={() => toggleLike(problem.slug)}
            className="w-8 h-8 sm:w-9 sm:h-9 pr-1 sm:pr-1.5 flex items-center justify-center transition-all duration-200 rounded-md hover:bg-slate-700/50"
            title={problem.liked ? tProblems('unlike') : tProblems('like')}
          >
            <IconBadge count={problem.likeCount} color="red" isHighlighted={problem.liked}>
              <Heart
                size={14}
                className={cn(
                  'sm:!w-[18px] sm:!h-[18px] transition-all duration-200',
                  problem.liked && 'fill-current'
                )}
              />
            </IconBadge>
          </button>

          {/* Comments button */}
          <button
            onClick={() => setIsCommentsOpen(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 pr-1 sm:pr-1.5 flex items-center justify-center transition-all duration-200 rounded-md hover:bg-slate-700/50"
            title={tProblems('commentsButton')}
          >
            <IconBadge
              count={problem.commentCount}
              color="indigo"
              isHighlighted={problem.commentCount > 0}
            >
              <MessageSquare size={14} className="sm:!w-[18px] sm:!h-[18px]" />
            </IconBadge>
          </button>

          {/* Add to list */}
          <AddToListMenu problemSlug={problem.slug} onSelectList={onSelectList} />

          {/* Permalink sharing button */}
          <button
            onClick={handlePermalinkCopy}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all duration-200 rounded-md hover:bg-slate-700/50 text-gray-400 hover:text-gray-200"
            title={tProblems('share')}
          >
            <Link size={14} className="sm:!w-[18px] sm:!h-[18px]" />
          </button>
        </div>
      </div>

      {/* Problem statement content with math rendering */}
      <div className="px-2.5 py-2 sm:px-4 sm:py-4 lg:px-6 lg:py-5 leading-relaxed text-gray-200 text-[14px] sm:text-base">
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
              return <span>{tProblems('errorLoadingStatement')}</span>
            }
          })()
        ) : (
          <span>{tProblems('noStatementAvailable')}</span>
        )}
      </div>

      {/* Footer row — authors left, solution link right */}
      {(problem.authors.length > 0 || problem.solutionLink) && (
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2 sm:gap-4 sm:px-4 sm:pb-3 lg:px-6 lg:pb-4">
          {/* Authors */}
          {problem.authors.length > 0 ? (
            <div className="flex items-center gap-1 sm:gap-1.5 italic text-gray-400 text-xs sm:text-sm min-w-0">
              <User size={12} className="shrink-0 sm:!w-[14px] sm:!h-[14px]" />
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {problem.authors.map((author, authorIndex) => (
                  <span key={author.slug} className="flex items-center">
                    <AuthorButton
                      author={author}
                      isSelected={selectedAuthorSlugs.has(author.slug)}
                      onAuthorClick={onAuthorClick}
                    />
                    {authorIndex < problem.authors.length - 1 && (
                      <span className="mx-1 text-gray-500">,</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div />
          )}

          {/* Solution link */}
          {problem.solutionLink && (
            <AppLink
              href={problem.solutionLink}
              newTab
              className="flex items-center gap-1 sm:gap-1.5 shrink-0 text-xs sm:text-sm text-gray-400 hover:text-gray-200 transition-colors duration-200"
              title={tProblems('solutionLink')}
            >
              <span>{tProblems('solution')}</span>
              <ExternalLink size={12} className="sm:!w-[14px] sm:!h-[14px]" />
            </AppLink>
          )}
        </div>
      )}

      {/* Tag display with technique visibility controls */}
      {problem.tags.length > 0 && (
        <div className="border-t bg-slate-800/50 border-slate-600/60">
          <div className="px-2.5 py-1.5 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Render tags sorted by category with technique visibility logic */}
              {sortTagsByCategory(problem.tags, locale)
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
                    onClick={(event) =>
                      onTagClick({ displayName: tag.displayName, slug: tag.slug }, event)
                    }
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
                  title={tProblems('showHiddenTechniques')}
                >
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    <span>
                      {hasVisibleTechniques
                        ? tProblems('showMoreTechniques')
                        : tProblems('showTechniques')}
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
              className={`w-full px-2.5 py-1.5 sm:px-4 sm:py-3 lg:px-6 flex items-center justify-center border-t border-slate-600/40 transition-all duration-200 ${
                expandedView === 'similar'
                  ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                  : 'hover:bg-slate-700/30'
              }`}
              title={tProblems('toggleSimilar')}
            >
              <div className="flex items-center gap-2">
                {/* Toggle between eye and eye-off icons based on expansion state */}
                {expandedView === 'similar' ? (
                  <EyeOff size={15} className="text-gray-400 sm:!w-[18px] sm:!h-[18px]" />
                ) : (
                  <Eye size={15} className="text-gray-400 sm:!w-[18px] sm:!h-[18px]" />
                )}
                <span className="text-xs sm:text-sm font-medium text-gray-200">
                  {tProblems('similarProblems')}
                </span>
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
      )}

      {/* Render expanded content when similar problems section is opened */}
      <SimilarProblemView view={expandedView} problem={problem} />

      {/* Comments Modal */}
      <CommentModal
        isOpen={isCommentsOpen}
        onClose={() => {
          // Close the modal
          setIsCommentsOpen(false)

          // No more pending target in case we wanna log in from this comment section
          clearPendingTarget()
        }}
        title={problem.slug.toUpperCase()}
        target={{
          targetType: 'Problem',
          targetId: problem.slug,
        }}
      />
    </div>
  )
}
