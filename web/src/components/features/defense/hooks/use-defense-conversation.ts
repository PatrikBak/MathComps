'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState, useSyncExternalStore } from 'react'

import { useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api-error'
import { cachePolicy } from '@/lib/query-config'

import {
  DefenseConversationModel,
  type DefenseConversationServices,
  type DefenseConversationState,
  type DeleteOutcome,
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
 * The failed outcome every action reports when the client isn't ready to run it (still loading or signed
 * out). Structurally a member of each of {@link SendOutcome}, {@link DeleteOutcome}, and
 * {@link RewindOutcome}, so one value serves all three.
 */
const NOT_READY_OUTCOME = { kind: 'failed' as const, errorCode: undefined }

/**
 * The live defense conversation and the controls that drive it: the model's observable state and
 * actions, each documented at its home on {@link DefenseConversationState} and
 * {@link DefenseConversationModel}, plus this problem's session history.
 */
type UseDefenseConversationResult = DefenseConversationState &
  Pick<DefenseConversationModel, 'stop' | 'startNew' | 'resume'> & {
    /** This problem's persisted sessions, oldest first. */
    sessions: DefenseSession[]
    /** Whether loading this problem's session history failed. */
    sessionsFailed: boolean
    /** Sends a student turn and folds in the examiner's reply. */
    send: (content: string) => Promise<SendOutcome>
    /** Deletes a session, dropping back to a fresh conversation when it was the open one. */
    deleteSession: (sessionId: string) => Promise<DeleteOutcome>
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
  // renders (memoized inside useApi).
  const apiCall = api.state === 'ready' ? api.apiCall : null

  // The backend calls bound to the current caller (unwrapped to data or a throw), or null when the caller
  // isn't ready. Memoized on the caller so it keeps a stable identity across renders.
  const buildServices = useCallback((): DefenseConversationServices | null => {
    // No caller yet: the client is still loading or the user is signed out, so there are no services
    if (apiCall === null) {
      return null
    }

    // The calls, each unwrapping its result to data or a throw
    return {
      // Send the turn, returning the session grown with it and the reply
      submitTurn: async (request) => unwrap(await submitTurn(apiCall, request)),
      // Remove the session
      deleteSession: async (sessionId) => {
        unwrap(await deleteSession(apiCall, sessionId))
      },
      // Truncate the session to the kept prefix
      rewindTurns: async (sessionId, keepThroughSequence) => {
        unwrap(await rewindTurns(apiCall, sessionId, keepThroughSequence))
      },
    }
  }, [apiCall])

  // This problem's persisted sessions, oldest first
  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey(problem.key),
    queryFn: async () => {
      // The client must be ready to fetch
      if (apiCall === null) throw new Error('API not ready')

      // Fetch the sessions, unwrapped to the list or a throw
      return unwrap(await listSessions(apiCall, problem.key))
    },
    enabled: apiCall !== null,
    // Give up after a few tries instead of the global infinite retry, so a persistent failure reaches the
    // error state rather than leaving the history indefinitely empty
    retry: 3,
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

  // Runs a model action against the ready services, or reports the shared not-ready failure when the
  // client is still loading or signed out. Every action's not-ready path collapses here. Stable across
  // renders.
  const runWithServices = useCallback(
    <Outcome>(
      run: (services: DefenseConversationServices) => Promise<Outcome>
    ): Promise<Outcome | typeof NOT_READY_OUTCOME> => {
      // A not-ready client has no services to run against
      const services = buildServices()
      if (services === null) {
        return Promise.resolve(NOT_READY_OUTCOME)
      }

      // Drive the action against the ready services
      return run(services)
    },
    [buildServices]
  )

  // Sends a student turn and folds in the examiner's reply.
  const send = useCallback(
    (content: string): Promise<SendOutcome> =>
      runWithServices((services) => model.send(content, services)),
    [model, runWithServices]
  )

  // Deletes a session, dropping back to a fresh conversation when it was the open one.
  const removeSession = useCallback(
    (sessionId: string): Promise<DeleteOutcome> =>
      runWithServices((services) => model.deleteSession(sessionId, services)),
    [model, runWithServices]
  )

  // Rewinds the open conversation to a chosen point, dropping every later turn.
  const rewind = useCallback(
    (keepThroughSequence: number): Promise<RewindOutcome> =>
      runWithServices((services) => model.rewind(keepThroughSequence, services)),
    [model, runWithServices]
  )

  // The conversation state, this problem's history, and the controls that drive it
  return {
    ...state,
    sessions: sessionsQuery.data ?? [],
    sessionsFailed: sessionsQuery.isError,
    send,
    stop: model.stop,
    startNew: model.startNew,
    resume: model.resume,
    deleteSession: removeSession,
    rewind,
  }
}
