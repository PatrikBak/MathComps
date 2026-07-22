'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState, useSyncExternalStore } from 'react'

import { useApi } from '@/hooks/use-api'
import { cachePolicy } from '@/lib/query-config'

import {
  DefenseConversationModel,
  type DefenseConversationServices,
  type DefenseConversationState,
  type RewindOutcome,
  type SendOutcome,
} from '../model/defense-conversation-model'
import type { DefenseProblem, DefenseSession } from '../model/defense-types'
import { deleteSession, listSessions, rewindTurns, submitTurn } from '../services/session-service'

/**
 * Builds the query key for the sessions held about a problem.
 *
 * @param problemKey - The stable key of the problem whose sessions these are.
 *
 * @returns The query key.
 */
function sessionsQueryKey(problemKey: string) {
  // One key per problem's session list
  return ['defenseSessions', problemKey] as const
}

/**
 * The live defense conversation and the controls that drive it: the model's observable state and
 * actions, each documented at its home on {@link DefenseConversationState} and
 * {@link DefenseConversationModel}, plus this problem's session history.
 */
type UseDefenseConversationResult = DefenseConversationState &
  Pick<DefenseConversationModel, 'stop' | 'startNew' | 'resume'> & {
    /** This problem's persisted sessions, oldest first. */
    sessions: DefenseSession[]
    /** Sends a student turn and folds in the examiner's reply. */
    send: (content: string) => Promise<SendOutcome>
    /** Deletes a session, dropping back to a fresh conversation when it was the open one. */
    deleteSession: (sessionId: string) => Promise<void>
    /** Rewinds the open conversation to a chosen point, dropping every later turn. */
    rewind: (keepThroughSequence: number) => Promise<RewindOutcome>
  }

/**
 * Drives one defense conversation: the live transcript, sending a student turn and getting the
 * examiner's reply, and persisting the session as it grows. Also surfaces this problem's session
 * history.
 *
 * A thin React binding over {@link DefenseConversationModel}: the model owns the state machine and its
 * concurrency, this hook wires it to React and to the session-history query. The problem's identity
 * must be stable for the life of the mount: the model is created once and keeps writing under the
 * first problem's key.
 *
 * @param problem - The problem being defended.
 * @param opener - The examiner's opening line, seeded as the first turn of a fresh conversation.
 *
 * @returns The live conversation, its send flow, and this problem's session history.
 */
export function useDefenseConversation(
  problem: DefenseProblem,
  opener: string
): UseDefenseConversationResult {
  // Cache handle for the session history
  const queryClient = useQueryClient()

  // The authenticated API client
  const api = useApi({ requireAuth: true })

  // The ready caller, or null while the client is still loading or the user is signed out. Stable across
  // renders (memoized inside useApi), so it anchors the memoized callbacks below.
  const apiCall = api.state === 'ready' ? api.apiCall : null

  // The backend calls bound to the current caller, unwrapped to their data or a throw. Memoized on the
  // caller so the send/delete callbacks keep a stable identity while the composer re-renders on keystrokes.
  const buildServices = useCallback((): DefenseConversationServices => {
    // The client must be ready (loaded and authenticated) to make a call
    if (apiCall === null) throw new Error('API not ready')

    // The two calls, each unwrapping its result
    return {
      submitTurn: async (request) => {
        // Send the turn
        const result = await submitTurn(apiCall, request)

        // A failed call throws
        if (!result.success) {
          throw new Error(result.error.message)
        }

        // The session grown with the turn and the reply
        return result.data
      },
      deleteSession: async (sessionId) => {
        // Remove the session
        const result = await deleteSession(apiCall, sessionId)

        // A failed call throws
        if (!result.success) {
          throw new Error(result.error.message)
        }
      },
      rewindTurns: async (sessionId, keepThroughSequence) => {
        // Truncate the session to the kept prefix
        const result = await rewindTurns(apiCall, sessionId, keepThroughSequence)

        // A failed call throws
        if (!result.success) {
          throw new Error(result.error.message)
        }
      },
    }
  }, [apiCall])

  // This problem's persisted sessions, oldest first
  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey(problem.key),
    queryFn: async () => {
      // The client must be ready to fetch
      if (apiCall === null) throw new Error('API not ready')

      // Fetch the sessions
      const result = await listSessions(apiCall, problem.key)

      // A failed call throws
      if (!result.success) {
        throw new Error(result.error.message)
      }

      // The sessions
      return result.data
    },
    enabled: apiCall !== null,
    // Sessions are the user's own recent activity
    ...cachePolicy.userData,
  })

  // The conversation's state machine, created once for the mount's life
  const [model] = useState(
    () =>
      new DefenseConversationModel({
        problem,
        opener,
        // Refresh the session history after any write
        onSessionsChanged: () =>
          queryClient.invalidateQueries({ queryKey: sessionsQueryKey(problem.key) }),
      })
  )

  // Track the model's state; a fresh model's snapshot is deterministic, so the same read doubles as
  // the server-render snapshot
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)

  // Sends a student turn against the current caller. A not-ready client reports a failed turn rather than
  // throwing. Stable across renders so a memoized child isn't re-rendered on every keystroke.
  const send = useCallback(
    async (content: string): Promise<SendOutcome> => {
      // A not-ready client can't run the turn; report it as a failed turn rather than throwing
      let services: DefenseConversationServices
      try {
        services = buildServices()
      } catch {
        return 'failed'
      }

      // Drive the turn against the ready services
      return model.send(content, services)
    },
    [model, buildServices]
  )

  // Deletes a session against the current caller. Stable across renders, like {@link send}.
  const removeSession = useCallback(
    // buildServices() throws when the client isn't ready; inside an async callback that surfaces as a
    // rejected promise the caller can handle, not a synchronous throw before the delete is even attempted
    async (sessionId: string): Promise<void> => model.deleteSession(sessionId, buildServices()),
    [model, buildServices]
  )

  // Rewinds the open conversation against the current caller. Stable across renders, like {@link send}.
  const rewind = useCallback(
    // buildServices() throws when the client isn't ready; that surfaces as a rejected promise, but rewind
    // is only reachable on a saved, loaded conversation, so the client is always ready by then
    async (keepThroughSequence: number): Promise<RewindOutcome> =>
      model.rewind(keepThroughSequence, buildServices()),
    [model, buildServices]
  )

  // The conversation state, this problem's history, and the controls that drive it
  return {
    ...state,
    sessions: sessionsQuery.data ?? [],
    send,
    stop: model.stop,
    startNew: model.startNew,
    resume: model.resume,
    deleteSession: removeSession,
    rewind,
  }
}
