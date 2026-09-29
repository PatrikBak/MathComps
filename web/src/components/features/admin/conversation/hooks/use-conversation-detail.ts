import { useLocale } from 'next-intl'

import { useApiQuery } from '@/hooks/use-api-query'
import { BackendApiError } from '@/lib/api/api-error'
import { cachePolicy } from '@/lib/query-config'
import type { QueryUiState } from '@/lib/query-ui-state'

import type { AdminConversation } from '../model/admin-conversation'
import { fetchConversationDetail } from '../services/conversation-service'
import { conversationDetailQueryKey } from './conversation-cache'

/**
 * Stands in for the conversation's id while none is open, so the idle cache entry is named rather than blank.
 */
const NO_CONVERSATION = 'none'

/**
 * What {@link useConversationDetail} hands back.
 */
type UseConversationDetailResult = {
  /** The whole conversation; null until it has been read. */
  detail: AdminConversation | null
  /** The state of the fetch. */
  uiState: QueryUiState
}

/**
 * Reads one conversation in full.
 *
 * @param sessionId - The conversation to read, or null while none is open.
 * @returns The conversation as described by {@link UseConversationDetailResult}.
 */
export function useConversationDetail(sessionId: string | null): UseConversationDetailResult {
  // The language it is read in
  const locale = useLocale()

  // The conversation itself
  const { data: detail, uiState } = useApiQuery({
    queryKey: conversationDetailQueryKey(sessionId ?? NO_CONVERSATION, locale),
    fetch: (apiCall) => {
      // The gate below keeps this from running with nothing open, so reaching here is a bug
      if (sessionId === null) {
        throw new BackendApiError({ message: 'No conversation is open', errorCode: 'SERVER_ERROR' })
      }

      // The transcript and everything read alongside it
      return fetchConversationDetail(apiCall, sessionId)
    },
    // The transcript is an admin's own read, so it is made as them
    requireAuth: true,
    // Nothing is read while no conversation is open
    enabled: sessionId !== null,
    ...cachePolicy.userData,
  })

  // The conversation once it has arrived, and how the fetch is going meanwhile
  return { detail: detail ?? null, uiState }
}
