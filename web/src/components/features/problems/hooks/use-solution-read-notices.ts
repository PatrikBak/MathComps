'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

import type { ProblemBySlug } from './use-problem-by-slug'
import { useProblemNotFoundNotice } from './use-problem-not-found-notice'

/**
 * Options for {@link useSolutionReadNotices}.
 */
type UseSolutionReadNoticesOptions = {
  /** What became of reading the problem whose solution is open. */
  read: ProblemBySlug
  /** The slug the solution was opened by. */
  problemSlug: string
  /** Closes the solution. */
  onClose: () => void
}

/**
 * The notices an open solution's read raises. A slug naming no problem is said once, and the solution closes. A read
 * failing otherwise is said for as long as it stands failed, with a way to read the problem again.
 *
 * @param options - The read, the slug the solution was opened by, and how to close it.
 */
export function useSolutionReadNotices({
  read,
  problemSlug,
  onClose,
}: UseSolutionReadNoticesOptions): void {
  // A function which tells the reader no problem goes by a slug
  const notifyProblemNotFound = useProblemNotFoundNotice()

  // Say so when no problem goes by the slug, and close the solution
  useEffect(() => {
    // Only a slug the archive said no problem goes by
    if (read.kind !== 'missing') return

    // Name the problem that is not there
    notifyProblemNotFound(problemSlug)

    // And close the solution nobody can read
    onClose()
  }, [read.kind, problemSlug, notifyProblemNotFound, onClose])

  // The way to read the problem again, while its read stands failed
  const retry = read.kind === 'failed' ? read.retry : null

  // Problems library error copy
  const tErrors = useTranslations('problems.errors')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // A notice while the read stands failed, offering to read the problem again
  useEffect(() => {
    // Only a failed read
    if (retry === null) return undefined

    // Tell the reader the solution did not load, and offer to read it again
    const toastId = toast.error(tErrors('solutionLoadFailed'), {
      duration: Infinity,
      action: { label: tActions('retry'), onClick: () => retry() },
    })

    // Drop the notice once the read leaves its failure behind
    return () => {
      toast.dismiss(toastId)
    }
  }, [retry, tErrors, tActions])
}
