'use client'

import { useAuth } from '@clerk/nextjs'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { useApi } from '@/hooks/use-api'
import { unwrap } from '@/lib/api/api-error'
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
import { defenseSessionsQueryKey, invalidateDefenseLists } from './defense-cache'

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
  Pick<
    DefenseConversationModel,
    'stop' | 'startNew' | 'resume' | 'setFeedback' | 'setReport' | 'clearReport'
  > & {
    /** This problem's persisted sessions, oldest first. */
    sessions: DefenseSession[]
    /**
     * Whether the conversation asked for on open has had its chance to be resumed: the history has loaded and the
     * resume either happened or found nothing to resume.
     */
    initialResumeSettled: boolean
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
 * first problem's target.
 *
 * @param problem - The problem being defended.
 * @param opener - The examiner's opening line, seeded as the first turn of a fresh conversation.
 * @param initialSessionId - The id of a specific saved session to resume on open rather than the newest; when it
 *   isn't among this problem's sessions, none is resumed.
 *
 * @returns The live conversation, its send flow, and this problem's session history.
 */
export function useDefenseConversation(
  problem: DefenseProblem,
  opener: string,
  initialSessionId: string | undefined
): UseDefenseConversationResult {
  // Cache handle for the session history
  const queryClient = useQueryClient()

  // The authenticated API client
  const api = useApi({ requireAuth: true })

  // Whose sessions these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

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
    queryKey: defenseSessionsQueryKey(problem.target, isUserLoaded ? (userId ?? null) : null),
    queryFn: async () => {
      // The client must be ready to fetch
      if (apiCall === null) throw new Error('API not ready')

      // Fetch the sessions, unwrapped to the list or a throw
      return unwrap(await listSessions(apiCall, problem.target))
    },
    // Only fetch once the client is ready and the key's user is settled
    enabled: apiCall !== null && isUserLoaded,
    // Sessions are the user's own recent activity
    ...cachePolicy.userData,
  })

  // The conversation's state machine, created once for the mount's life
  const [model] = useState(
    () =>
      new DefenseConversationModel({
        problem,
        opener,
        // Refresh every list the written session appears in
        onSessionsChanged: () => invalidateDefenseLists(queryClient),
      })
  )

  // Track the model's state; a fresh model's snapshot is deterministic, so the same read doubles as
  // the server-render snapshot
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)

  // Whether the one-time auto-resume has already run
  const didAutoResume = useRef(false)

  // Whether that resume has settled: the asked-for conversation is open, or known not to be coming
  const [initialResumeSettled, setInitialResumeSettled] = useState(false)

  // Auto-resume a saved defense the first time this problem's history loads: the one the caller named, else the
  // newest, so opening a problem you have defended before continues that conversation rather than a blank one.
  // Runs once: afterwards the persisted model keeps wherever the student navigated, whether a fresh chat or a
  // different session.
  useEffect(() => {
    // Nothing to do until the first successful history load, and never more than once
    if (didAutoResume.current || !sessionsQuery.isSuccess) {
      return
    }

    // The chosen saved defense to open, or the newest when none was named
    const target =
      initialSessionId !== undefined
        ? sessionsQuery.data.find((session) => session.id === initialSessionId)
        : sessionsQuery.data.at(-1)

    // A named session missing from a list that is still being refreshed may yet arrive with it, so wait for the
    // refreshed list rather than settling on a stale one
    if (initialSessionId !== undefined && target === undefined && sessionsQuery.isFetching) {
      return
    }

    // Latch before resuming so this never runs a second time
    didAutoResume.current = true

    // The live conversation state
    const { currentSessionId, isThinking } = model.getSnapshot()

    // Resume it only on an untouched fresh conversation: an open session or an in-flight turn means
    // the student is mid-interaction and must not be pulled away
    if (currentSessionId === null && !isThinking && target !== undefined) {
      model.resume(target)
    }

    // Whatever the outcome, the conversation the caller asked for has had its chance to open
    setInitialResumeSettled(true)
  }, [
    sessionsQuery.isSuccess,
    sessionsQuery.isFetching,
    sessionsQuery.data,
    model,
    initialSessionId,
  ])

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
    initialResumeSettled,
    sessionsFailed: sessionsQuery.isError,
    send,
    stop: model.stop,
    startNew: model.startNew,
    resume: model.resume,
    setFeedback: model.setFeedback,
    setReport: model.setReport,
    clearReport: model.clearReport,
    deleteSession: removeSession,
    rewind,
  }
}
