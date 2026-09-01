'use client'

import { useLocale } from 'next-intl'
import { useCallback, useState, useTransition } from 'react'

import { useIsMountedRef } from '@/hooks/use-is-mounted-ref'
import type { Locale } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

import type { PendingEntry } from '../model/hosted-competition-types'
import { competitionAreaHref } from '../services/hosted-competition-routes'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { useEnterHostedCompetition } from './use-enter-hosted-competition'

/**
 * Return type for {@link useHostedCompetitionEntryDialog}.
 */
export type UseHostedCompetitionEntryDialogResult = {
  /** What the dialog is asking about, or null while it is closed. */
  pending: PendingEntry | null
  /** Asks about a competition, and warms the page the answer lands on. */
  open: (pending: PendingEntry) => void
  /** Drops the question without entering. */
  close: () => void
  /** Answers it, which takes the entry and starts the clock. */
  confirm: () => void
  /** Answers it the other way, spending the entry on the problems and starting no clock. */
  forfeit: () => void
  /** Whether an entry or a forfeit is in flight. */
  isEntering: boolean
  /** Whether the entry has landed and the area it bought is still on its way. */
  isLeaving: boolean
}

/**
 * The deliberate half of entering: which competition is being asked about, and taking the entry once the
 * student picks a category and says yes. The dialog closes on the entry landing rather than on the press,
 * so a failure leaves the question on screen instead of implying a clock that never started.
 *
 * @param readerKey - Who the cached answers belong to.
 *
 * @returns What the dialog is asking about, and the ways to answer it.
 */
export function useHostedCompetitionEntryDialog(
  readerKey: HostedCompetitionsReaderKey
): UseHostedCompetitionEntryDialogResult {
  // Which competition is being asked about
  const [pending, setPending] = useState<PendingEntry | null>(null)

  // The reader's language
  const locale = useLocale() as Locale

  // A function which drops the question
  const close = useCallback(() => setPending(null), [])

  // The localized router, for taking the student where the entry they just spent is read
  const router = useRouter()

  // Whether the area is still on its way, which the navigation itself answers: it reads true from the
  // push until the page it is waiting on has arrived
  const [isLeaving, startLeaving] = useTransition()

  // A function which asks about a competition
  const open = useCallback(
    (asked: PendingEntry) => {
      // The question
      setPending(asked)

      // And the page its answer lands on, fetched while the question is still on screen. Warmed no
      // earlier than that: this is the one route on the site whose arrival is measured against a clock
      // the reader is paying for
      router.prefetch(competitionAreaHref(asked.competition.slug[locale]))
    },
    [locale, router]
  )

  // Whether the list is still on screen, which the continuation the press leaves behind has to ask
  const isMountedRef = useIsMountedRef()

  // Where a landed entry leaves the student: inside the competition, which is where the problems both
  // answers to the dialog spend it on are read
  const land = useCallback(
    (competitionSlug: string) => {
      // The student went somewhere else while the entry was landing, and where they went is their answer
      if (!isMountedRef.current) {
        return
      }

      // The question is answered
      setPending(null)

      // And the student is where the entry they spent is read. Held as a transition so the list knows
      // it is on its way out: the row they pressed counts a clock down from here where they sat it, and
      // a student meets their own clock beside the problems it is being spent on
      startLeaving(() => router.push(competitionAreaHref(competitionSlug)))
    },
    [router, isMountedRef]
  )

  // Taking the entry, or giving it up, either of which lands the student inside the competition
  const { enter, forfeit, isEntering } = useEnterHostedCompetition(readerKey, land)

  // A function which answers the question
  const confirm = useCallback(() => {
    // Nothing to enter while the dialog is closed
    if (pending === null) {
      return
    }

    // Take the entry into whichever competition was asked about
    enter(pending.competition.slug[locale])
  }, [enter, locale, pending])

  // A function which answers it by giving the entry up for the problems
  const confirmForfeit = useCallback(() => {
    // Nothing to give up while the dialog is closed
    if (pending === null) {
      return
    }

    // Spend the entry on whichever competition was asked about
    forfeit(pending.competition.slug[locale])
  }, [forfeit, locale, pending])

  // What the dialog is asking about, and the ways to answer it
  return {
    pending,
    open,
    close,
    confirm,
    forfeit: confirmForfeit,
    isEntering,
    isLeaving,
  }
}
