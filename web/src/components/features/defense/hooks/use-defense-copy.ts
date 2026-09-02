'use client'

import { useLocale } from 'next-intl'

import { useApiQuery } from '@/hooks/use-api-query'

import { fetchDefenseCopy } from '../services/session-service'
import { defenseCopyQueryKey } from './defense-cache'

/**
 * The examiner's canned lines, as far as the chat has them.
 */
type UseDefenseCopyResult = {
  /** The greeting that opens every conversation, or null until the read lands. */
  opener: string | null
}

/**
 * Reads the examiner's canned lines in the reader's language.
 *
 * Open to a visitor with no account, the chat greeting one whether or not they have signed in.
 *
 * @returns The lines.
 */
export function useDefenseCopy(): UseDefenseCopyResult {
  // The active locale
  const locale = useLocale()

  // The examiner's canned lines
  const { data: copy } = useApiQuery({
    queryKey: defenseCopyQueryKey(locale),
    fetch: (caller) => fetchDefenseCopy(caller),
    // The chat greets a visitor who has yet to sign in
    requireAuth: false,
    // Never stale: the lines are written down in the backend's own resource, so a deploy is the only
    // thing that can change them and nothing this side of one has a newer answer to go and ask for
    staleTime: Infinity,
  })

  // The lines, or nothing while the read is still out or has failed
  return { opener: copy?.opener ?? null }
}
