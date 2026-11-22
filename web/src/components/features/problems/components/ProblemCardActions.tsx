import { Check, Heart, Link, MessageSquare, MessageSquarePlus, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { CountBadge } from '@/components/shared/components/CountBadge'
import { cn } from '@/components/shared/utils/css-utils'

import { useProblemPermalink } from '../hooks/use-problem-permalink'
import { useToggleProblemLike } from '../hooks/use-toggle-problem-like'
import { useToggleProblemMark } from '../hooks/use-toggle-problem-mark'
import type { Problem } from '../types/problem-api-types'
import { AddToListMenu } from './AddToListMenu'

/**
 * How large an action's icon is drawn on a phone, in pixels.
 */
const ACTION_ICON_SIZE = 14

/**
 * The classes drawing an action's icon larger from the small breakpoint up.
 */
const ACTION_ICON_CLASS = 'sm:!h-[18px] sm:!w-[18px]'

/**
 * The props of {@link ProblemCardActions}.
 */
type ProblemCardActionsProps = {
  /** The problem the actions act on. */
  problem: Problem
  /** Opens the problem's comments. */
  onOpenComments: () => void
  /** Shows the problems of one of the reader's lists, by the list's content id. */
  onSelectList: (contentId: string) => void
}

/**
 * What can be done to a problem from its card: marking it as dealt with, liking it, its comments, putting it on a
 * list and copying its link.
 */
export function ProblemCardActions({
  problem,
  onOpenComments,
  onSelectList,
}: ProblemCardActionsProps) {
  // Problems library translations
  const tProblems = useTranslations('problems')

  // A function which marks the problem as dealt with, or takes the mark back
  const toggleMark = useToggleProblemMark()

  // A function which likes the problem, or takes the like back
  const toggleLike = useToggleProblemLike()

  // A function which copies a problem's link
  const copyPermalink = useProblemPermalink()

  return (
    <div
      // Pulled up and in by the buttons' own padding, so the icons line up with the name and the card's edge
      className="-my-2 -mr-2 flex shrink-0 items-center gap-0.5 sm:gap-1"
    >
      {/* Mark */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => toggleMark(problem.slug)}
        title={problem.marked ? tProblems('marks.unmark') : tProblems('marks.mark')}
      >
        <Check
          size={ACTION_ICON_SIZE}
          className={cn(
            ACTION_ICON_CLASS,
            'transition-all duration-500',
            problem.marked ? 'text-success' : 'text-muted'
          )}
          strokeWidth={problem.marked ? 3 : 2}
        />
      </Button>

      {/* Like, its count beside the heart once anybody has liked the problem */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(problem.likeCount > 0 && 'pr-1 sm:pr-1.5')}
        onClick={() => toggleLike(problem.slug)}
        title={problem.liked ? tProblems('unlike') : tProblems('like')}
      >
        <CountBadge count={problem.likeCount} color="red" isHighlighted={problem.liked}>
          <Heart
            size={ACTION_ICON_SIZE}
            className={cn(
              ACTION_ICON_CLASS,
              'transition-all duration-200',
              problem.liked && 'fill-current'
            )}
          />
        </CountBadge>
      </Button>

      {/* Comments, inviting the first comment while there is none and counting them after */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(problem.commentCount > 0 && 'pr-1 sm:pr-1.5')}
        onClick={onOpenComments}
        title={tProblems('commentsButton')}
      >
        <CountBadge
          count={problem.commentCount}
          color="indigo"
          isHighlighted={problem.commentCount > 0}
        >
          {problem.commentCount > 0 ? (
            <MessageSquare size={ACTION_ICON_SIZE} className={ACTION_ICON_CLASS} />
          ) : (
            <MessageSquarePlus size={ACTION_ICON_SIZE} className={ACTION_ICON_CLASS} />
          )}
        </CountBadge>
      </Button>

      {/* Lists */}
      <AddToListMenu
        problemSlug={problem.slug}
        icon={<Plus size={ACTION_ICON_SIZE} className={ACTION_ICON_CLASS} />}
        onSelectList={onSelectList}
      />

      {/* Link */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => copyPermalink(problem.slug)}
        title={tProblems('share')}
      >
        <Link size={ACTION_ICON_SIZE} className={ACTION_ICON_CLASS} />
      </Button>
    </div>
  )
}
