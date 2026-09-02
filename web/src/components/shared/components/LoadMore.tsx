'use client'

import { useIntersection } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useEffect, useEffectEvent } from 'react'

import { Button } from '@/components/shared/components/Button'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'

/**
 * How far ahead of the control to start loading, so the next page is usually there by the time the reader
 * reaches the end of the one they are on.
 */
const PREFETCH_MARGIN = '400px'

/**
 * Props for the {@link LoadMore} component.
 */
type LoadMoreProps = {
  /** Whether more pages remain; the control is absent once none do. */
  hasMore: boolean
  /** Whether one is on its way. */
  isLoading: boolean
  /** Whether the last attempt gave up. */
  hasFailed: boolean
  /** Asks for the next page. */
  onLoadMore: () => void
}

/**
 * The end of a paged list, and the way past it.
 *
 * It is a real button that also asks for itself as it comes into view. A bare sentinel loads the next page
 * with nothing on screen to say a page boundary was ever crossed, which leaves a reader unable to tell a list
 * that has ended from one still arriving; a button alone makes them click through a backlog they only wanted
 * to scroll. Once the fetch has given up the automatic ask stops and the button is the only way on, so a
 * reader scrolling at a backend that turned them down doesn't spend a fresh burst of retries per scroll.
 */
export function LoadMore({ hasMore, isLoading, hasFailed, onLoadMore }: LoadMoreProps) {
  // Shared paging copy
  const t = useTranslations('ui.pagination')

  // Watches for the control coming into view
  const { ref, entry } = useIntersection({ rootMargin: PREFETCH_MARGIN })

  // Whether the reader has reached it
  const isInView = entry?.isIntersecting === true

  // The ask, held apart from what triggers it: a caller handing down a fresh function each render would
  // re-run the effect below, and a page landing is exactly such a render
  const askForNextPage = useEffectEvent(onLoadMore)

  // Ask for the next page as it approaches, until an attempt gives up and the reader has to say so themselves
  useEffect(() => {
    if (isInView && !hasFailed) askForNextPage()
  }, [isInView, hasFailed])

  // Nothing left to ask for
  if (!hasMore) return null

  return (
    <div ref={ref} className="flex justify-center py-4">
      {isLoading ? (
        <span className="flex items-center gap-2 text-sm text-muted">
          <LoadingSpinner className="size-4" />
          {t('loading')}
        </span>
      ) : (
        <span className="flex items-center gap-3">
          {hasFailed && <span className="text-sm text-muted">{t('failed')}</span>}

          <Button variant="secondary" size="sm" onClick={onLoadMore}>
            {t('loadMore')}
          </Button>
        </span>
      )}
    </div>
  )
}
