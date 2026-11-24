'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { toast } from 'sonner'

/**
 * A function which tells the reader that no problem of the archive goes by the slug they asked for. One slug makes one
 * notice, however many parts of the page find it missing at once.
 *
 * @returns The function, taking the slug the reader asked for.
 */
export function useProblemNotFoundNotice(): (problemSlug: string) => void {
  // Problems library error copy
  const tErrors = useTranslations('problems.errors')

  // A function which names the problem that is not there
  return useCallback(
    (problemSlug: string) => {
      // How much of a slug a notice can carry
      const MAX_NOTICE_SLUG_LENGTH = 20

      // The slug, cut short when it runs past what a notice can carry
      const shownSlug =
        problemSlug.length > MAX_NOTICE_SLUG_LENGTH
          ? `${problemSlug.slice(0, MAX_NOTICE_SLUG_LENGTH)}...`
          : problemSlug

      // Name the missing problem, in the one notice its slug gets
      toast.error(tErrors('problemNotFound', { problemId: shownSlug }), {
        id: `problem-not-found:${problemSlug}`,
      })
    },
    [tErrors]
  )
}
