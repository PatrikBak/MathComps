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
import { COMPACT_PANEL_CLASS } from '@/components/shared/components/EmptyState'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import type { NumberReferenceRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { WaitingChangeButton } from '@/components/shared/components/WaitingChangeButton'
import { WindowVirtualList } from '@/components/shared/components/WindowVirtualList'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { focusForReader } from '@/components/shared/utils/focus-utils'
import { hueTextStyle } from '@/components/shared/utils/hue-colors'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import { useShowFromTop } from '@/hooks/use-show-from-top'
import type { Locale } from '@/i18n/i18n'
import type { QueryUiState } from '@/lib/query-ui-state'

import { type DrawnThread, useDrawnThreads } from '../hooks/use-drawn-threads'
import { usePoolThreads } from '../hooks/use-pool-threads'
import { useProposalReference } from '../hooks/use-proposal-reference'
import { isNarrowed } from '../model/pool-filter'
import {
  type DiscussedSubject,
  discussionTargetOf,
  shareDiscussion,
  threadKeyOf,
} from '../model/selection-discussions'
import type { CommentsOrder } from '../model/selection-routes'
import { categoryHue } from '../model/selection-state'
import { CommentsOrderSwitch } from './CommentsOrderSwitch'
import { MarkSeenButton } from './MarkSeenButton'
import { PoolSkeleton } from './PoolSkeleton'
import { PoolTools } from './PoolTools'
import { ProposalBox } from './ProposalBody'
import { DetailLink } from './SelectionLinks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'
import { StatementPreview } from './StatementPreview'

/** Whether each order groups the threads of one problem or paper under a single heading. */
const GROUPS_BY_SUBJECT: Record<CommentsOrder, boolean> = { newest: false, problem: true }

/**
 * Props for the {@link PoolComments} component.
 */
type PoolCommentsProps = {
  /** Where the line over the pool says how many comments show, once it is on the page. */
  countSlot: HTMLElement | null
  /** The slot for the order switch at the right end of the line over the pool, once it is on the page. */
  orderSlot: HTMLElement | null
  /** The language the problems are read in. */
  language: Locale
  /** Where the pool's search and filters stand, once it is on the page. */
  toolsSlot: HTMLElement | null
}

/**
 * The reviewers' discussions of everything the selection holds as one list: every top-level comment with its
 * replies, under a heading opening its problem or paper on the discussion, every thread {@link usePoolThreads} lets
 * through. The pool's search and filters stand over it, their options counting comments, and each change to them
 * lays the list out afresh. A problem's heading previews its statement in the language the problems are read in.
 * Anything new anybody else posts, and any change of theirs to the selection, waits behind a button where it would
 * change the threads the filters let through, so it never moves the list under the reader. The reader's own writes
 * show at once, and so do others' edits, reactions and deletions. A problem opened from the list and closed again
 * finds it as it was left. The line over the pool says how many comments the threads shown hold, that they are on
 * their way, or that they are not to be had. While some comments shown are new to the reader, it says how many, with
 * the eye marking them seen where that stops some comment shown from being new. The right end of that line holds a
 * switch between newest first and by problem, and the URL keeps the choice. By problem, all threads of one problem or
 * paper share one box and one heading.
 */
export function PoolComments({ countSlot, orderSlot, toolsSlot, language }: PoolCommentsProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // The threads the filters let through and those they keep out, the counts beside the filters' options, what waits
  // to be shown, the filters, the order the threads run in, the key the list is drawn afresh under, and how far the
  // read has got
  const {
    threads,
    hidden,
    counts,
    uiState,
    retry,
    hasNews,
    showNews,
    filters,
    order: { option: order, choose: chooseOrder },
    listKey,
  } = usePoolThreads()

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
  const { drawn, newCount, markShownSeen } = useDrawnThreads({ threads, hidden })

  // The search and the filters, in their spot over the pool
  const tools =
    toolsSlot === null
      ? null
      : createPortal(<PoolTools mode="comments" filters={filters} counts={counts} />, toolsSlot)

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

  // The order switch, at the right end of the line over the pool
  const orderSwitch =
    orderSlot === null
      ? null
      : createPortal(<CommentsOrderSwitch order={order} onChange={chooseOrder} />, orderSlot)

  // A function which says whether a thread goes under the previous thread's heading: by problem, when both are about
  // the same problem or paper
  const runsUnder = (before: DrawnThread, thread: DrawnThread) =>
    GROUPS_BY_SUBJECT[order] && shareDiscussion(before.thread, thread.thread)

  // Which comments of the list have their replies folded away
  const collapsed = useCollapsedComments()

  // What a `#N` in a comment is drawn as
  const renderNumberReference = useProposalReference(language)

  // The read still to land, or given up before it did
  if (threads === null) {
    return (
      // The same element the threads come in, so the search and the filters keep the focus as the threads land
      <div>
        {/* The search and the filters over the pool */}
        {tools}

        {/* That the threads are on their way or not to be had, in the line over the pool */}
        {count}

        {/* The order switch, at the right end of the line */}
        {orderSwitch}

        {/* How far the read has got */}
        <ThreadsPlaceholder uiState={uiState} onRetry={retryRead} />
      </div>
    )
  }

  return (
    // The threads, and what waits over them
    <div>
      {/* The search and the filters over the pool */}
      {tools}

      {/* How many comments show and how many of them are new, in the line over the pool */}
      {count}

      {/* The order switch, at the right end of the line */}
      {orderSwitch}

      {/* What arrived since the threads were shown, waiting to be asked for */}
      <WaitingChangeButton
        label={t('showWhatsNew')}
        icon={ArrowUp}
        isWaiting={hasNews}
        onShow={showWhatsNew}
        fallbackRef={countRef}
      />

      {/* Every thread let through under its heading, or why there are none */}
      <div ref={listRef}>
        {threads.length === 0 ? (
          // Nothing said the search and the facets let through, or nothing said in the view on screen
          <div className={COMPACT_PANEL_CLASS}>
            <p className="text-sm text-muted">
              {t(isNarrowed(filters.filter) ? 'emptyCommentsFiltered' : 'emptyComments')}
            </p>
          </div>
        ) : (
          // The threads, only those near the window drawn. The list starts over on each filter change except the
          // search, on each order change, and on each board change the threads depend on. A thread joins the next one
          // when that one shares its heading
          <WindowVirtualList
            key={listKey}
            items={drawn}
            keyOf={(item) => threadKeyOf(item.thread)}
            joinsNext={runsUnder}
            renderItem={(item, joins) => (
              <PoolThread
                drawn={item}
                isHeaded={!joins.previous}
                isContinued={joins.next}
                collapsed={collapsed}
                language={language}
                renderNumberReference={renderNumberReference}
              />
            )}
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
  /** Marks what the list shows as seen; null where that would stop no comment shown from being new. */
  onMarkSeen: (() => void) | null
  /** The line over the pool. */
  countRef: RefObject<HTMLParagraphElement | null>
}

/**
 * The part of the line over the pool about new comments: how many are new to the reader, and the eye marking them all
 * seen, offered only where that stops some comment shown from being new.
 */
function NewCommentTools({ count, onMarkSeen, countRef }: NewCommentToolsProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  return (
    <>
      {/* The comma after the count, which stays with it where a narrow line breaks */}
      {', '}

      <span
        // As tall as the line it sits on, the eye standing out over the line's margins, so the line keeps one height
        // in every layout of the pool, with the eye or without it
        className="-my-2 inline-flex items-center gap-0.5"
      >
        {/* How many are new */}
        <span className="mr-1 font-medium text-brand-light">{t('newCount', { count })}</span>

        {/* The eye marking the new comments seen */}
        {onMarkSeen !== null && <MarkSeenButton onPress={onMarkSeen} fallbackRef={countRef} />}
      </span>
    </>
  )
}

/**
 * Props for the {@link PoolThread} component.
 */
type PoolThreadProps = {
  /** The thread as the list draws it. */
  drawn: DrawnThread
  /** Whether the thread shows its own heading, which it skips when it shares the previous thread's. */
  isHeaded: boolean
  /** Whether the next thread shares this thread's heading and box. */
  isContinued: boolean
  /** Which comments of the tab have their replies folded away. */
  collapsed: UseCollapsedCommentsResult
  /** The language the problems are read in. */
  language: Locale
  /** What a `#N` in a comment is drawn as. */
  renderNumberReference: NumberReferenceRenderer
}

/**
 * One top-level comment with its replies, under a heading naming its problem or paper. A thread sharing the previous
 * thread's heading shows none, and the two share one box, spaced as on the problem's own page. A thread is replied
 * to, edited, deleted and reacted to in place, the way it is on its problem's or paper's own page, the reply shared
 * with every other thread in the tab, and what in it is new to the reader shows as such.
 */
function PoolThread({
  drawn,
  isHeaded,
  isContinued,
  collapsed,
  language,
  renderNumberReference,
}: PoolThreadProps) {
  // The thread, how the comment components draw it, and how far its discussion is seen
  const { thread, comments, newness } = drawn

  // The discussion the thread was posted in
  const target = discussionTargetOf(thread.subject)

  // The reply, open in this thread while it is opened under one of its comments
  const reply = useCommentReply({ target, comments })

  return (
    <ProposalBox
      as="article"
      // Named after its problem or paper when it shows no heading, so a screen reader still says what it is about
      aria-label={isHeaded ? undefined : subjectNameOf(thread.subject)}
      className={cn(
        // No bottom edge, since the next thread continues the same box
        isContinued && 'rounded-b-none border-b-0 pb-0',
        // No top edge, since it continues the box above; the gap matches a problem's own page
        !isHeaded && 'rounded-t-none border-t-0 pt-0'
      )}
    >
      {/* Where the thread was posted, unless the thread above already shows it */}
      {isHeaded && <ThreadHeading subject={thread.subject} language={language} />}

      {/* The comment and its replies */}
      <div className={cn(isHeaded && 'mt-3')}>
        <CommentList
          target={target}
          comments={comments}
          variant="inline"
          showReactions
          reply={reply}
          collapsed={collapsed}
          newness={newness}
          renderNumberReference={renderNumberReference}
        />
      </div>
    </ProposalBox>
  )
}

/**
 * The name of the problem or paper a thread is about, as its heading shows it.
 *
 * @param subject - The problem or paper the thread is about.
 *
 * @returns The problem's number and name, or the paper's name with its board's.
 */
function subjectNameOf(subject: DiscussedSubject): string {
  // By whether it's a problem or a paper
  switch (subject.kind) {
    case 'proposal':
      return `#${subject.proposal.number} ${subject.proposal.title}`
    case 'paper':
      return `${subject.paper.name} ${subject.board.name}`

    // Every kind is handled above
    default:
      return assertNever(subject)
  }
}

/**
 * Props for the {@link ThreadHeading} component.
 */
type ThreadHeadingProps = {
  /** What the thread's discussion hangs off. */
  subject: DiscussedSubject
  /** The language the problems are read in. */
  language: Locale
}

/**
 * A thread's heading: its problem's number and name, or its paper's name in its category's colour with the board's
 * name, opening that page on its discussion. A problem's heading opens with the preview of its statement.
 */
function ThreadHeading({ subject, language }: ThreadHeadingProps) {
  // The selection's categories, in the order they run
  const { categories } = useLoadedSelection()

  // The heading by what the thread hangs off
  switch (subject.kind) {
    case 'proposal':
      return (
        <h2 className="text-foreground hyphens-none">
          <StatementPreview proposal={subject.proposal} language={language} />{' '}
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
