'use client'

import { MailOpen, RefreshCw, StickyNote } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Kbd } from '@/components/shared/components/Kbd'
import { LoadMore } from '@/components/shared/components/LoadMore'
import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'
import { STEP_KEYS, useStepHotkeys } from '@/hooks/use-step-hotkeys'

import { useDefenseReviewFacets } from '../hooks/use-defense-review-facets'
import { useDefenseReviewFilters } from '../hooks/use-defense-review-filters'
import { useDefenseReviewFocusReturn } from '../hooks/use-defense-review-focus-return'
import { useDefenseReviewQueue } from '../hooks/use-defense-review-queue'
import { useDefenseReviewReadState } from '../hooks/use-defense-review-read-state'
import { useDefenseReviewSelection } from '../hooks/use-defense-review-selection'
import { useDefenseReviewUnread } from '../hooks/use-defense-review-unread'
import { NEXT_UNREAD_KEY } from '../model/defense-review-stepping'
import { fromDefenseReviewQuery, toDefenseReviewQuery } from '../model/defense-review-url'
import { AdminNoteFeedModal } from './AdminNoteFeedModal'
import { DefenseReviewCard } from './DefenseReviewCard'
import { DefenseReviewFilterBar } from './DefenseReviewFilterBar'
import { DefenseReviewModal } from './DefenseReviewModal'
import { DefenseReviewPlaceholder } from './DefenseReviewPlaceholder'

/**
 * One key that walks the queue, and what its hint calls it.
 */
type ShortcutHint = {
  /** The key as it is printed on the keyboard. */
  key: string
  /** Which of the shortcut names says what it does. */
  name: 'next' | 'previous' | 'nextUnread'
}

/** The hints naming each key that walks the queue, in the order they read. */
const SHORTCUT_HINTS: ShortcutHint[] = [
  { key: STEP_KEYS.next, name: 'next' },
  { key: STEP_KEYS.previous, name: 'previous' },
  { key: NEXT_UNREAD_KEY, name: 'nextUnread' },
]

/** Button sizing tightened to the width a phone has to spare. */
const COMPACT_ACTION_CLASS = 'min-h-8 gap-1.5 px-2 text-xs sm:min-h-9 sm:gap-2 sm:px-3 sm:text-sm'

/**
 * The review queue: every student's defense conversations, the ones spoken to most recently first.
 *
 * Each conversation carries the problem it was held against on its own card, since the run is ordered by time and
 * two neighbours are rarely about the same problem. Reading the queue by problem is what the filters are for.
 *
 * The filter bar sticks under the site header, since re-filtering two hundred cards down should not mean
 * scrolling back to the top to reach the controls, and it carries no fill of its own: the page sits on a
 * gradient fixed to the viewport, which any tint there reads as a band across.
 *
 * Closing a conversation hands focus back from here rather than leaving it to the dialog, whose own restore
 * points at whatever was clicked however far along the reader has walked from it, and points at nothing at all
 * for one opened from the feed.
 */
export function DefenseReviewQueue() {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // What the address was asking for when the queue opened
  const initialAddress = useInitialUrlState(fromDefenseReviewQuery)

  // Which conversations to show
  const { filter, setField, clearAll, activeCount } = useDefenseReviewFilters(initialAddress.filter)

  // What the filters can be set to
  const { options } = useDefenseReviewFacets()

  // The queue itself
  const queue = useDefenseReviewQueue(filter)

  // Whether anything matched
  const hasConversations = queue.conversations.length > 0

  // Which conversations have been read
  const { markRead, markUnread, markUnreadFrom, markMany } = useDefenseReviewReadState()

  // Which of the loaded ones are still unread, and the way to clear the lot of them
  const { unreadConversationIds, markLoadedRead } = useDefenseReviewUnread(
    queue.conversations,
    markMany
  )

  // Which conversation is being read
  const selection = useDefenseReviewSelection(
    queue.orderedConversationIds,
    unreadConversationIds,
    initialAddress.openId
  )

  // Keep the address saying what is on screen, so a reload comes back to it and it can be handed on
  useAddressSync(toDefenseReviewQuery({ filter, openId: selection.openId }))

  // Whether every note ever written is showing
  const [isFeedOpen, setIsFeedOpen] = useState(false)

  // The note the reader was sent to out of the feed, which the conversation then opens on; null for one
  // opened on its own account
  const [landingNoteId, setLandingNoteId] = useState<string | null>(null)

  // Where closing a conversation hands focus back to
  const { feedButtonRef, openFromCard, openFromFeed, restoreFocus } = useDefenseReviewFocusReturn(
    selection.openId,
    selection.open
  )

  // Walking the queue from the keyboard, skipping to the next unread one included
  useStepHotkeys(selection, [[NEXT_UNREAD_KEY, () => selection.stepUnread()]])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* The page title, and what can be done to the whole queue */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-bold text-foreground hyphens-none">{t('title')}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clearing what is loaded, disabled rather than absent so the buttons after it never shift */}
          <Button
            variant="outline"
            size="sm"
            className={COMPACT_ACTION_CLASS}
            disabled={unreadConversationIds.size === 0}
            onClick={markLoadedRead}
          >
            <MailOpen size={14} aria-hidden="true" />
            {t('markAllRead')}
          </Button>

          {/* The way into every note already written */}
          <Button
            ref={feedButtonRef}
            variant="outline"
            size="sm"
            className={COMPACT_ACTION_CLASS}
            onClick={() => setIsFeedOpen(true)}
          >
            <StickyNote size={14} aria-hidden="true" />
            {t('openNotes')}
          </Button>

          {/* Reading the queue again, for conversations that moved since it loaded. Only an icon, so
              it carries its name as a hover hint too */}
          <Button
            variant="outline"
            size="icon"
            className="size-8 sm:size-9"
            loading={queue.isRefreshing}
            aria-label={t('refresh')}
            title={t('refresh')}
            onClick={queue.refetch}
          >
            <RefreshCw size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* The filter bar, stuck under the site header */}
      <div className="sticky-below-header -mx-1 px-1 py-2 backdrop-blur">
        <DefenseReviewFilterBar
          filter={filter}
          onFieldChange={setField}
          onClearAll={clearAll}
          activeCount={activeCount}
          options={options}
        />
      </div>

      {/* What is in the queue, and the keys that walk it */}
      {hasConversations && (
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-muted">
          {/* How many there are, loaded or not */}
          {tPlurals('conversations', { count: queue.totalConversations })}

          {/* The shortcut hints, only where there is a keyboard to press them on */}
          <span className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
            {SHORTCUT_HINTS.map((shortcut) => (
              <span key={shortcut.key} className="flex items-center gap-1">
                <Kbd>{shortcut.key}</Kbd>
                {t(`shortcuts.${shortcut.name}`)}
              </span>
            ))}
          </span>
        </p>
      )}

      {/* The queue, or whatever stands in its place */}
      {hasConversations ? (
        <div className="flex flex-col gap-2">
          {queue.conversations.map((conversation) => (
            <DefenseReviewCard
              key={conversation.id}
              conversation={conversation}
              onOpen={openFromCard}
            />
          ))}
        </div>
      ) : (
        <DefenseReviewPlaceholder
          uiState={queue.uiState}
          isFiltered={activeCount > 0}
          onRetry={queue.refetch}
          onClearFilters={clearAll}
        />
      )}

      {/* The end of the list, and the way past it */}
      <LoadMore
        hasMore={queue.hasMore}
        isLoading={queue.isLoadingMore}
        hasFailed={queue.uiState.kind === 'failed'}
        onLoadMore={queue.loadMore}
      />

      {/* One conversation, read back in full */}
      <DefenseReviewModal
        selection={selection}
        landingNoteId={landingNoteId}
        onMarkRead={markRead}
        onMarkUnread={markUnread}
        onMarkUnreadFrom={markUnreadFrom}
        onClosed={() => {
          // Whatever the reader was sent to has been read by now, so the next open is nobody's note
          setLandingNoteId(null)
          restoreFocus()
        }}
      />

      {/* Every note already written, across every conversation */}
      <AdminNoteFeedModal
        isOpen={isFeedOpen}
        onClose={() => setIsFeedOpen(false)}
        onOpenNote={(sessionId, noteId) => {
          // The feed goes on the way through, since a conversation opened under it would stack two dialogs
          setIsFeedOpen(false)

          // Which note the conversation is being opened for, and then the conversation itself
          setLandingNoteId(noteId)
          openFromFeed(sessionId)
        }}
      />
    </div>
  )
}
