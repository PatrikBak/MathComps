'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { replaceQuery } from '@/components/shared/utils/url-utils'
import { useCurrentUrl } from '@/hooks/use-current-url'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

import type { EntryBlocker } from '../model/entry-reader'
import type { HostedCompetitionGroup, PendingEntry } from '../model/hosted-competition-types'

/**
 * The query parameter a press carries across a sign-in, naming the competition to come back to.
 */
const ENTRY_INTENT_PARAM = 'enter'

/**
 * Parameters for {@link useEntryGuard}.
 */
type UseEntryGuardParams = {
  /** What stands between the reader and any entry, undefined while that is still on its way. */
  blocker: EntryBlocker | null | undefined
  /** Every group on screen. */
  groups: HostedCompetitionGroup[]
  /** Asks the reader about a competition, only ever somebody who can actually enter it. */
  openDialog: (pending: PendingEntry) => void
  /** Which competition a press before a sign-in was aimed at, if the return URL carried one. */
  entryIntentId: string | undefined
  /**
   * Whether the list has actually arrived.
   *
   * Its own flag rather than a non-empty list of groups: a program with nothing scheduled is a real answer
   * and an empty one, and reading emptiness as "still coming" would leave the intent in the address.
   */
  hasView: boolean
}

/**
 * What pressing Enter turns into, given what the reader still owes.
 *
 * One press and three endings: the entry's own question, a prompt for an account, or a prompt for the
 * profile fields. Neither prompt navigates; each is a toast carrying the action.
 *
 * A press made before signing in is carried across it and answered on the way back, so the reader lands on
 * the question they pressed rather than on the list they pressed it from.
 *
 * @param params - What is in the way, what is on screen, and where an unblocked press goes.
 *
 * @returns The call every entry press goes through.
 */
export function useEntryGuard({
  blocker,
  groups,
  openDialog,
  entryIntentId,
  hasView,
}: UseEntryGuardParams): (pending: PendingEntry) => void {
  // Competitions copy
  const t = useTranslations('competitions')

  // The shared sign-in prompt
  const showLoginPrompt = useLoginPromptToast()

  // The way to the profile, for a reader who has an account but has not finished filling it in
  const router = useRouter()

  // The page to come back to, which the intent is appended to
  const getCurrentUrl = useCurrentUrl()

  // A function which answers one press, given what the reader still owes
  const guard = useCallback(
    (pending: PendingEntry) => {
      // No account yet, so the press goes to one and brings this same competition back with it
      if (blocker === 'signIn') {
        // This page, plus which competition was pressed
        const [path, search = ''] = getCurrentUrl().split('?')
        const query = new URLSearchParams(search)
        query.set(ENTRY_INTENT_PARAM, pending.competition.id)

        // Ask for the account, naming the competition to come back to
        showLoginPrompt({
          reason: t('entryAuthReason'),
          redirectUrl: `${path}?${query}`,
        })

        // The press is answered on the way back rather than here
        return
      }

      // An account, but not the fields a published result would have to name them by
      if (blocker === 'profile') {
        // The header's own sentence, minus the link inside it, the toast's action carrying that
        // destination instead
        const message = t.rich('readiness.profileNeeded', { link: (chunks) => chunks })

        // Ask for the fields, with the way to them on the toast
        toast.warning(message, {
          action: {
            label: t('readiness.profileLink'),
            onClick: () => router.push(ROUTES.PROFILE),
          },
        })

        // Nothing opens until the profile has what a result would name them by
        return
      }

      // Nothing in the way. An unsettled answer is not the same thing, and never reaches here: the list is
      // held until it lands
      if (blocker === null) {
        openDialog(pending)
      }
    },
    [blocker, getCurrentUrl, openDialog, router, showLoginPrompt, t]
  )

  // Whether the press carried across the sign-in has been answered, so it is answered once and not again
  // on the render the stripped URL causes
  const hasResumed = useRef(false)

  // The query the intent has to be lifted out of
  const searchParams = useSearchParams()

  // Answering the press the reader made before they had an account, now that they have one
  useEffect(() => {
    // Nothing was carried, or it has been answered already
    if (entryIntentId === undefined || hasResumed.current) {
      return
    }

    // Neither the rows nor what stands in the way has landed, so there is nothing to answer with yet
    if (blocker === undefined || !hasView) {
      return
    }

    // Whichever competition was pressed, if it is still on the page
    const group = groups.find((candidate) =>
      candidate.competitions.some((competition) => competition.id === entryIntentId)
    )
    const competition = group?.competitions.find((candidate) => candidate.id === entryIntentId)

    // Answered, whatever comes of it below
    hasResumed.current = true

    // The address without the intent on it
    const remaining = new URLSearchParams(searchParams?.toString() ?? '')
    remaining.delete(ENTRY_INTENT_PARAM)
    const query = remaining.toString()

    // Drop it, so a reload is not the same press again
    replaceQuery(query)

    // The competition may have closed while they were signing in
    if (group !== undefined && competition !== undefined) {
      guard({ group, competition })
    }
  }, [blocker, groups, entryIntentId, guard, hasView, searchParams])

  // The call every entry press goes through
  return guard
}
