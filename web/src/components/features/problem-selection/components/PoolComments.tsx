'use client'

import { ArrowUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'

import { CommentList } from '@/components/features/comments/components/CommentList'
import {
  useCollapsedComments,
  type UseCollapsedCommentsResult,
} from '@/components/features/comments/hooks/use-collapsed-comments'
import { useCommentReply } from '@/components/features/comments/hooks/use-comment-reply'
import { countAllComments } from '@/components/features/comments/utils/comment-utils'
import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import { WaitingChangeButton } from '@/components/shared/components/WaitingChangeButton'
import { WindowVirtualList } from '@/components/shared/components/WindowVirtualList'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { focusForReader } from '@/components/shared/utils/focus-utils'
import { hueTextStyle } from '@/components/shared/utils/hue-colors'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import { useShowFromTop } from '@/hooks/use-show-from-top'
import type { QueryUiState } from '@/lib/query-ui-state'

import { type DrawnThread, useDrawnThreads } from '../hooks/use-drawn-threads'
import { usePoolThreads } from '../hooks/use-pool-threads'
import {
  type DiscussedSubject,
  discussionTargetOf,
  threadKeyOf,
} from '../model/selection-discussions'
import { categoryHue } from '../model/selection-state'
import { MarkSeenButton } from './MarkSeenButton'
import { PoolSkeleton } from './PoolSkeleton'
import { ProposalBox } from './ProposalBody'
import { DetailLink } from './SelectionLinks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link PoolComments} component.
 */
type PoolCommentsProps = {
  /** Where the line over the pool says how many comments show, once it is on the page. */
  countSlot: HTMLElement | null
}

/**
 * The reviewers' discussions of everything the selection holds as one list: every top-level comment with its
 * replies, each under a heading opening its problem or paper on the discussion, every thread {@link usePoolThreads}
 * gives. Anything new anybody else posts while the list is open waits behind a button, so it never moves the list
 * under the reader. The reader's own writes show at once, and so do others' edits, reactions and deletions. A problem
 * opened from the list and closed again finds it as it was left. The line over the pool says how many comments the
 * threads hold, that they are on their way, or that they are not to be had. While some comments are new to the
 * reader, it says how many, with the eye marking them seen.
 */
export function PoolComments({ countSlot }: PoolCommentsProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // Every thread, what waits to be shown, and how far the read has got
  const { threads, uiState, retry, hasNews, showNews } = usePoolThreads()

  // The line over the pool, which takes the focus when whatever held it goes
  const { poolCountRef: countRef } = useSelectionWorkspace()

  // The list, and the way to show what waited from its top, the focus on the line over the pool
  const { listRef, showFromTop: showWhatsNew } = useShowFromTop({
    show: showNews,
    focusTarget: countRef,
  })

  // A function which reads the threads again, the focus on the line over the pool before the button leaves
  const retryRead = () => {
    // The focus moved on, the page staying where it is
    focusForReader(countRef.current, { preventScroll: true })

    // Read again
    retry()
  }

  // How many comments still stand in the threads shown, or what the read is doing until it lands
  const countLine =
    threads !== null
      ? tPlurals('comments', { count: countAllComments(threads.map((thread) => thread.comment)) })
      : t(waitingLineKey(uiState))

  // Each thread as the list draws it, how many comments in them are new to the reader, and the way to mark them seen
  const { drawn, newCount, markShownSeen } = useDrawnThreads({ threads })

  // The comment count or the waiting line, with what is new, drawn in the line over the pool
  const count =
    countSlot === null
      ? null
      : createPortal(
          <>
            <span>{countLine}</span>
            {newCount > 0 && (
              <NewCommentTools count={newCount} onMarkSeen={markShownSeen} countRef={countRef} />
            )}
          </>,
          countSlot
        )

  // Which comments of the list have their replies folded away
  const collapsed = useCollapsedComments()

  // The read still to land, or given up before it did
  if (threads === null) {
    return (
      <>
        {/* That the threads are on their way or not to be had, in the line over the pool */}
        {count}

        {/* How far the read has got */}
        <ThreadsPlaceholder uiState={uiState} onRetry={retryRead} />
      </>
    )
  }

  return (
    // The threads, and what waits over them
    <div>
      {/* How many comments show and how many of them are new, in the line over the pool */}
      {count}

      {/* What arrived since the threads were shown, waiting to be asked for */}
      <WaitingChangeButton
        label={t('showWhatsNew')}
        icon={ArrowUp}
        isWaiting={hasNews}
        onShow={showWhatsNew}
        fallbackRef={countRef}
      />

      {/* Every thread under its heading, or why there are none */}
      <div ref={listRef}>
        {threads.length === 0 ? (
          // Nothing said about anything the selection holds
          <div className={COMPACT_PANEL_CLASS}>
            <p className="text-sm text-muted">{t('emptyComments')}</p>
          </div>
        ) : (
          // The threads, only those in or near the window drawn
          <WindowVirtualList
            items={drawn}
            keyOf={(item) => threadKeyOf(item.thread)}
            renderItem={(item) => <PoolThread drawn={item} collapsed={collapsed} />}
            fallbackRef={countRef}
          />
        )}
      </div>
    </div>
  )
}

/**
 * What the line over the pool says while no thread shows yet: that the threads are on their way, as they are while
 * the read is held back or tried again, or that they are not to be had.
 *
 * @param uiState - How far the read has got.
 *
 * @returns The line's key in the pool's copy.
 */
function waitingLineKey(uiState: QueryUiState): 'loadingComments' | 'commentsUnavailable' {
  // By how far the read has got
  switch (uiState.kind) {
    case 'loading':
    case 'retrying':
    case 'offline':
    case 'ready':
      return 'loadingComments'
    case 'failed':
      return 'commentsUnavailable'

    // Every state is handled above
    default:
      return assertNever(uiState)
  }
}

/**
 * Props for the {@link ThreadsPlaceholder} component.
 */
type ThreadsPlaceholderProps = {
  /** How far the read has got. */
  uiState: QueryUiState
  /** Reads the threads again after the read gave up. */
  onRetry: () => void
}

/**
 * What stands in for the threads until the first read lands: the pool's own placeholder cards while the read is out,
 * so a list opened cold loads as one, and how the read is faring once it is held back or gives up.
 */
function ThreadsPlaceholder({ uiState, onRetry }: ThreadsPlaceholderProps) {
  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // By how far the read has got
  switch (uiState.kind) {
    // On its way, the pool's own placeholder cards
    case 'loading':
      return <PoolSkeleton />

    // Held back, trying again, given up, or in with nothing to show yet
    case 'offline':
    case 'retrying':
    case 'failed':
    case 'ready':
      return (
        <FetchStatePlaceholder
          uiState={uiState}
          className={COMPACT_PANEL_CLASS}
          empty={null}
          failed={
            <div className={cn(COMPACT_PANEL_CLASS, 'text-sm text-muted')}>
              <p>{t('commentsFailed')}</p>
              <Button size="sm" variant="secondary" onClick={onRetry}>
                {tActions('retry')}
              </Button>
            </div>
          }
        />
      )

    // Every state is handled above
    default:
      return assertNever(uiState)
  }
}

/**
 * Props for the {@link NewCommentTools} component.
 */
type NewCommentToolsProps = {
  /** How many comments of the list are new to the reader. */
  count: number
  /** Marks what the list shows as seen. */
  onMarkSeen: () => void
  /** The line over the pool. */
  countRef: RefObject<HTMLParagraphElement | null>
}

/**
 * The part of the line over the pool about new comments: how many are new to the reader, and the eye marking them all
 * seen.
 */
function NewCommentTools({ count, onMarkSeen, countRef }: NewCommentToolsProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  return (
    <span className="inline-flex items-center gap-0.5">
      {/* How many are new */}
      <span className="mr-1 font-medium text-brand-light">{`, ${t('newCount', { count })}`}</span>

      {/* The eye marking the new comments seen */}
      <MarkSeenButton onPress={onMarkSeen} fallbackRef={countRef} />
    </span>
  )
}

/**
 * Props for the {@link PoolThread} component.
 */
type PoolThreadProps = {
  /** The thread as the list draws it. */
  drawn: DrawnThread
  /** Which comments of the tab have their replies folded away. */
  collapsed: UseCollapsedCommentsResult
}

/**
 * One top-level comment with its replies, under a heading naming its problem or paper. It is replied to, edited,
 * deleted and reacted to in place, the way it is on its problem's or paper's own page, the reply shared with every
 * other thread in the tab, and what in it is new to the reader shows as such.
 */
function PoolThread({ drawn, collapsed }: PoolThreadProps) {
  // The thread, how the comment components draw it, and how far its discussion is seen
  const { thread, comments, newness } = drawn

  // The discussion the thread was posted in
  const target = discussionTargetOf(thread.subject)

  // The reply, open in this thread while it is opened under one of its comments
  const reply = useCommentReply({ target, comments })

  return (
    <ProposalBox as="article">
      {/* Where the thread was posted */}
      <ThreadHeading subject={thread.subject} />

      {/* The comment and its replies */}
      <div className="mt-3">
        <CommentList
          target={target}
          comments={comments}
          variant="inline"
          showReactions
          reply={reply}
          collapsed={collapsed}
          newness={newness}
        />
      </div>
    </ProposalBox>
  )
}

/**
 * Props for the {@link ThreadHeading} component.
 */
type ThreadHeadingProps = {
  /** What the thread's discussion hangs off. */
  subject: DiscussedSubject
}

/**
 * A thread's heading: its problem's number and name, or its paper's name in its category's colour with the board's
 * name, opening that page on its discussion.
 */
function ThreadHeading({ subject }: ThreadHeadingProps) {
  // The selection's categories, in the order they run
  const { categories } = useLoadedSelection()

  // The heading by what the thread hangs off
  switch (subject.kind) {
    case 'proposal':
      return (
        <h2 className="text-foreground hyphens-none">
          <DetailLink
            page={{ kind: 'proposal', id: subject.proposal.id, tab: 'comments' }}
            // Named so the list can come back to it, focus and all, once the problem closes
            {...OPEN_ID_ATTRIBUTE.stamp(subject.proposal.id)}
            className="hover:text-link"
            plain
          >
            <span className="mr-1 text-sm tabular-nums text-muted">{`#${subject.proposal.number}`}</span>{' '}
            <span className="font-medium">{subject.proposal.title}</span>
          </DetailLink>
        </h2>
      )
    case 'paper':
      return (
        <h2 className="hyphens-none">
          <DetailLink
            page={{ kind: 'paper', id: subject.paper.id, tab: 'comments' }}
            // Named so the list can come back to it, focus and all, once the paper closes
            {...OPEN_ID_ATTRIBUTE.stamp(subject.paper.id)}
            className="hover:underline"
            style={hueTextStyle(categoryHue(categories, subject.paper.category))}
            plain
          >
            <span className="font-medium">{subject.paper.name}</span>{' '}
            <span className="ml-1 text-sm text-muted">{subject.board.name}</span>
          </DetailLink>
        </h2>
      )

    // Every kind is handled above
    default:
      return assertNever(subject)
  }
}
