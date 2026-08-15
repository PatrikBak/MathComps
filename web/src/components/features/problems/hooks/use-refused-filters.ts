'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { assertNever } from '@/components/shared/utils/assert-never'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { useLoginRedirect } from '@/hooks/use-login-redirect'
import { useRouter } from '@/i18n/navigation'

import { getProblemsPageUrl } from '../services/problem-routes'
import type { SearchFiltersState } from '../types/problem-library-types'
import { serializeFilters } from '../utils/search-url-serialization'

/**
 * A refusal the reader can act on by signing in, named by what the filter is for.
 */
type SignInOffer = {
  /** What this notice is. */
  kind: 'sign-in'
  /** What the account is needed for, as the control offering the filter puts it. */
  reason: string
}

/**
 * A refusal that reads as its own sentence, with signing in still offered underneath it.
 */
type SignInMessage = {
  /** What this notice is. */
  kind: 'sign-in-message'
  /** The sentence the reader gets. */
  message: string
}

/**
 * A refusal nothing the reader does will change.
 */
type PlainRefusal = {
  /** What this notice is. */
  kind: 'plain'
  /** The sentence the reader gets. */
  message: string
}

/** How a reader is told a filter they asked for will not be applied. */
type RefusalNotice = SignInOffer | SignInMessage | PlainRefusal

/**
 * The parameters of {@link useRefusedFilters}.
 */
type UseRefusedFiltersParams = {
  /** The filters as the URL has them once the reader has been weighed, null before it is read. */
  filtersInForce: SearchFiltersState | null
  /** The filters the URL asked for, before anyone was weighed, null before it is read. */
  filtersRequested: SearchFiltersState | null
}

/**
 * The return type of the {@link useRefusedFilters} hook.
 */
type UseRefusedFiltersResult = {
  /**
   * Takes filters this reader cannot have out of the URL and tells them so.
   *
   * @param dropped - The filters to clear, on top of the ones the reader was already refused.
   * @param notice - What to tell them about it.
   */
  dropAndExplain: (dropped: Partial<SearchFiltersState>, notice: RefusalNotice) => void
}

/**
 * Answers a filter the reader turns out not to be able to have.
 *
 * One answer for every way a filter stops holding, whether the archive refused it or the reader was
 * never entitled to it: the filter itself goes, every other filter stays exactly as it was, the
 * reader keeps the page they were on, and one notice says what happened. A reader who loses a whole
 * search because one of its parts stopped being theirs has been charged for somebody else's
 * problem, and one thrown onto a sign-in page never asked to go there.
 *
 * @param params - The two readings of the URL described by {@link UseRefusedFiltersParams}.
 *
 * @returns The handler described by {@link UseRefusedFiltersResult}.
 */
export function useRefusedFilters({
  filtersInForce,
  filtersRequested,
}: UseRefusedFiltersParams): UseRefusedFiltersResult {
  // The router the URL is rewritten through
  const router = useRouter()

  // Translations for the sign-in copy
  const tAuth = useTranslations('auth')

  // A function which asks a reader to sign in, carrying where to return to
  const showLoginPrompt = useLoginPromptToast()

  // A function which sends the reader off to sign in
  const { redirectToLogin } = useLoginRedirect()

  // A function which drops the filters that cannot hold and says why
  const dropAndExplain = useCallback(
    (dropped: Partial<SearchFiltersState>, notice: RefusalNotice) => {
      // Nothing has been read off the URL yet, so there is nothing to take out of it
      if (!filtersInForce || !filtersRequested) return

      // The filters left once the refused ones are gone
      const remaining = { ...filtersInForce, ...dropped }

      // Written back, which is what takes the refused filter off the screen and out of the URL
      router.replace(getProblemsPageUrl(serializeFilters(remaining)), { scroll: false })

      // Where signing in would bring the reader, which is the search as they asked for it
      const wayBack = getProblemsPageUrl(serializeFilters(filtersRequested))

      // Say what happened, in whichever of the three shapes this refusal calls for
      switch (notice.kind) {
        // A filter that needs an account, named by what it is for
        case 'sign-in':
          showLoginPrompt({ reason: notice.reason, redirectUrl: wayBack })

          return

        // A sentence of its own, with signing in offered underneath it
        case 'sign-in-message':
          toast.error(notice.message, {
            action: { label: tAuth('login'), onClick: () => redirectToLogin(wayBack) },
          })

          return

        // Nothing the reader does will bring this filter back
        case 'plain':
          toast.error(notice.message)

          return

        // The union is closed; a new member is a bug
        default:
          return assertNever(notice)
      }
    },
    [filtersInForce, filtersRequested, router, showLoginPrompt, redirectToLogin, tAuth]
  )

  // The one handler every refusal in the library goes through
  return { dropAndExplain }
}
