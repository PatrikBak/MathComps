'use client'

import { type HotkeyItem, useHotkeys } from '@mantine/hooks'
import { MailOpen, StickyNote } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Kbd } from '@/components/shared/components/Kbd'
import { LoadMore } from '@/components/shared/components/LoadMore'

import {
  useDefenseReviewAddressSync,
  useDefenseReviewInitialAddress,
} from '../hooks/use-defense-review-address'
import { useDefenseReviewFacets } from '../hooks/use-defense-review-facets'
import { useDefenseReviewFilters } from '../hooks/use-defense-review-filters'
import { useDefenseReviewFocusReturn } from '../hooks/use-defense-review-focus-return'
import { useDefenseReviewQueue } from '../hooks/use-defense-review-queue'
import { useDefenseReviewReadState } from '../hooks/use-defense-review-read-state'
import {
  useDefenseReviewSelection,
  type UseDefenseReviewSelectionResult,
} from '../hooks/use-defense-review-selection'
import { useDefenseReviewUnread } from '../hooks/use-defense-review-unread'
import { AdminNoteFeedModal } from './AdminNoteFeedModal'
import { DefenseReviewCard } from './DefenseReviewCard'
import { DefenseReviewFilterBar } from './DefenseReviewFilterBar'
import { DefenseReviewModal } from './DefenseReviewModal'
import { DefenseReviewPlaceholder } from './DefenseReviewPlaceholder'

/**
 * One key that walks the queue, what it is called, and the move it makes.
 */
type StepShortcut = {
  /** The key as it is printed on the keyboard. */
  key: string
  /** Which of the shortcut names says what it does. */
  name: 'next' | 'previous' | 'nextUnread'
  /** The move the key makes on the queue. */
  run: (selection: UseDefenseReviewSelectionResult) => void
}

/** The keys that walk the queue, in the order they read. */
const STEP_SHORTCUTS: StepShortcut[] = [
  { key: 'j', name: 'next', run: (selection) => selection.step(1) },
  { key: 'k', name: 'previous', run: (selection) => selection.step(-1) },
  { key: 'u', name: 'nextUnread', run: (selection) => selection.stepUnread() },
]

/**
 * How many dialogs currently stand over the page, counted off the document itself.
 *
 * @returns The number of dialogs on screen.
 */
function countOpenDialogs(): number {
  // Every dialog on screen, which is what each one announces itself as
  return document.querySelectorAll('[role="dialog"]').length
}

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
  const initialAddress = useDefenseReviewInitialAddress()

  // Which conversations to show
  const { filter, setField, clearAll, activeCount } = useDefenseReviewFilters(initialAddress.filter)

  // What the filters can be set to
  const { options } = useDefenseReviewFacets()

  // The queue itself
  const queue = useDefenseReviewQueue(filter)

  // Whether anything matched
  const hasConversations = queue.conversations.length > 0

  // Which conversations have been read
  const { markRead, markUnread, markMany } = useDefenseReviewReadState()

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
  useDefenseReviewAddressSync({ filter, openId: selection.openId })

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

  // A test of whether a key is the reader walking the queue or a stray press behind something standing over
  // it. The conversation dialog is the queue's own and is stepped from happily; anything past that count was
  // stacked on top of it, from the feed to a question waiting on an answer, and walking the queue out from
  // under one of those answers something nobody asked. Counting them keeps that true of the next one too.
  const canStep = () => countOpenDialogs() <= (selection.openId === null ? 0 : 1)

  // Walking the queue from the keyboard, which works with none open too, so a reading session never has to
  // begin with a click
  useHotkeys(
    STEP_SHORTCUTS.map(
      (shortcut): HotkeyItem => [shortcut.key, () => canStep() && shortcut.run(selection)]
    )
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Page title */}
      <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>

      {/* The filter bar, stuck under the site header */}
      <div className="sticky top-[var(--header-height)] z-20 -mx-1 px-1 py-2 backdrop-blur">
        <DefenseReviewFilterBar
          filter={filter}
          onFieldChange={setField}
          onClearAll={clearAll}
          activeCount={activeCount}
          options={options}
        />
      </div>

      {/* The toolbar over the queue */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {/* The count and the keys that walk the queue, emptied rather than dropped while nothing
            matched, so that the buttons beside it keep their end of the row */}
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-muted">
          {hasConversations && (
            <>
              {/* How many there are, loaded or not */}
              {tPlurals('conversations', { count: queue.totalConversations })}

              {/* The shortcut hints, only where there is a keyboard to press them on */}
              <span className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                {STEP_SHORTCUTS.map((shortcut) => (
                  <span key={shortcut.key} className="flex items-center gap-1">
                    <Kbd>{shortcut.key}</Kbd>
                    {t(`shortcuts.${shortcut.name}`)}
                  </span>
                ))}
              </span>
            </>
          )}
        </p>

        {/* What can be done to the whole of it */}
        <div className="flex items-center gap-2">
          {/* Clearing what is loaded, disabled rather than absent so the button beside it never shifts */}
          <Button
            variant="outline"
            size="sm"
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
            onClick={() => setIsFeedOpen(true)}
          >
            <StickyNote size={14} aria-hidden="true" />
            {t('openNotes')}
          </Button>
        </div>
      </div>

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
          onRetry={queue.retry}
          onClearFilters={clearAll}
        />
      )}

      {/* The end of the list, and the way past it */}
      <LoadMore
        hasMore={queue.hasMore}
        isLoading={queue.isLoadingMore}
        hasFailed={queue.hasFailed}
        onLoadMore={queue.loadMore}
      />

      {/* One conversation, read back in full */}
      <DefenseReviewModal
        selection={selection}
        landingNoteId={landingNoteId}
        onMarkRead={markRead}
        onMarkUnread={markUnread}
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
