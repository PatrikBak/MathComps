'use client'

import { useTranslations } from 'next-intl'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { LoadMore } from '@/components/shared/components/LoadMore'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

import { useAdminNoteFeed } from '../hooks/use-admin-note-feed'
import { AdminNoteFeedItem } from './AdminNoteFeedItem'

/**
 * Props for the {@link AdminNoteFeedModal} component.
 */
type AdminNoteFeedModalProps = {
  /** Whether the feed is showing. */
  isOpen: boolean
  /** Closes it. */
  onClose: () => void
  /** Opens the conversation a note was written about, standing on the note itself. */
  onOpenNote: (sessionId: string, noteId: string) => void
}

/**
 * Every note ever written, newest first.
 *
 * Read-only on purpose: the point of it is scanning back over what has already been concluded, and each note
 * is settled or revised where it was written, in the conversation it is about.
 */
export function AdminNoteFeedModal({ isOpen, onClose, onOpenNote }: AdminNoteFeedModalProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // The feed itself, read only while it is up
  const feed = useAdminNoteFeed(isOpen)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton
      title={t('feed.title')}
      align="top"
      className="flex max-w-3xl flex-col sm:max-h-[85vh]"
    >
      {/* What to leave out */}
      <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={feed.openOnly}
          onChange={(event) => feed.setOpenOnly(event.target.checked)}
          className={cn('size-4 accent-brand', FOCUS_RING_CLASS)}
        />
        {t('feed.openOnly')}
      </label>

      {/* The notes themselves */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
        {/* The notes, or whatever stands in their place */}
        {feed.items.length === 0 ? (
          <FetchStatePlaceholder
            uiState={feed.uiState}
            className="flex flex-col items-center gap-2 py-8 text-center"
            // It arrived and held nothing, which the narrowing above is the usual reason for
            empty={<p className="py-8 text-center text-sm text-muted">{t('feed.empty')}</p>}
            // It gave up, which is not the same as there being nothing to show
            failed={<p className="py-8 text-center text-sm text-muted">{t('failed')}</p>}
          />
        ) : (
          feed.items.map((item) => (
            <AdminNoteFeedItem key={item.note.id} item={item} onOpenNote={onOpenNote} />
          ))
        )}

        {/* The way on to older notes, inside the scroll so reaching the end is what asks for the rest */}
        <LoadMore
          hasMore={feed.hasMore}
          isLoading={feed.isLoadingMore}
          hasFailed={feed.uiState.kind === 'failed'}
          onLoadMore={feed.loadMore}
        />
      </div>
    </Modal>
  )
}
