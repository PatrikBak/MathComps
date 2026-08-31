'use client'

import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { invalidateCompetitionProblems } from '@/components/features/hosted-competitions/hooks/hosted-competition-cache'
import { assertNever } from '@/components/shared/utils/assert-never'
import { apiCallOf, useApi } from '@/hooks/use-api'
import { useApiQuery } from '@/hooks/use-api-query'
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
import type {
  DefenseLimits,
  DefenseOpening,
  DefenseProblem,
  DefenseSession,
} from '../model/defense-types'
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
    /** The caps a defense here is held to, or null until the history has been read. */
    limits: DefenseLimits | null
    /**
     * Whether the conversation asked for on open has had its chance to be resumed: the history has
     * loaded and the resume has either happened or been passed over.
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
 * examiner's reply, persisting the session as it grows, and holding what the student says about it.
 * Also surfaces this problem's session history.
 *
 * A thin React binding over {@link DefenseConversationModel}: the model owns the state machine and its
 * concurrency, this hook wires it to React and to the session-history query. The model is built once per
 * mount and keeps writing under the problem it was built with, which holds because `DefenseConversation`
 * keys itself on that target.
 *
 * @param problem - The problem being defended.
 * @param opening - Which conversation to open on; a named one this problem's history doesn't hold opens
 *   none.
 *
 * @returns The live conversation, its send flow, what the student says about it, and this problem's
 *   session history.
 */
export function useDefenseConversation(
  problem: DefenseProblem,
  opening: DefenseOpening
): UseDefenseConversationResult {
  // The query cache
  const queryClient = useQueryClient()

  // The authenticated API client
  const api = useApi({ requireAuth: true })

  // Whose sessions these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // The ready caller, or null while the client is still loading or the user is signed out. Stable across
  // renders (memoized inside useApi).
  const apiCall = apiCallOf(api)

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

  // This problem's persisted sessions
  const sessionsQuery = useApiQuery({
    queryKey: defenseSessionsQueryKey(problem.target, isUserLoaded ? (userId ?? null) : null),
    fetch: (caller) => listSessions(caller, problem.target),
    // The reader's own conversations, so they are read as them
    requireAuth: true,
    // Only fetch once the key's user is settled, or the list lands under the wrong one
    enabled: isUserLoaded,
    // Sessions are the user's own recent activity
    ...cachePolicy.userData,
  })

  // The conversation's state machine, created once for the mount's life
  const [model] = useState(
    () =>
      new DefenseConversationModel({
        problem,
        // Refresh every list the written session appears in
        onSessionsChanged: () => {
          // The defense surface's own lists, per problem and across all of them
          invalidateDefenseLists(queryClient)

          // A competition problem also sits in the competition area's list, which no defense query reaches
          if (problem.target.kind === 'competition') {
            invalidateCompetitionProblems(queryClient)
          }
        },
      })
  )

  // The model's current state; a fresh model's snapshot is deterministic, so the same read doubles
  // as the server-render snapshot
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)

  // Whether the one-time auto-resume has already run
  const didAutoResume = useRef(false)

  // Whether that resume has settled: the asked-for conversation is open, or known not to be coming
  const [initialResumeSettled, setInitialResumeSettled] = useState(false)

  // Auto-resume a saved defense the first time this problem's history loads: the one the caller named, else the
  // most recently active, so opening a problem you have defended before continues that conversation rather than
  // a blank one.
  // Runs once: afterwards the persisted model keeps wherever the student navigated, whether a fresh chat or a
  // different session.
  useEffect(() => {
    // Nothing to do until the first successful history load, and never more than once
    if (didAutoResume.current || !sessionsQuery.isSuccess) {
      return
    }

    // The saved defense to open on, which a fresh opening deliberately has none of
    const target = resumeTargetOf(opening, sessionsQuery.data.sessions)

    // A named session missing from a list that is still being refreshed may yet arrive with it, so wait for the
    // refreshed list rather than settling on a stale one
    if (opening.kind === 'named' && target === undefined && sessionsQuery.isFetching) {
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
  }, [sessionsQuery.isSuccess, sessionsQuery.isFetching, sessionsQuery.data, model, opening])

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
    sessions: sessionsQuery.data?.sessions ?? [],
    limits: sessionsQuery.data?.limits ?? null,
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

/**
 * Picks the saved conversation an opening asks for.
 *
 * @param opening - Which conversation the chat is opening on.
 * @param sessions - This problem's saved conversations, most recently active first.
 *
 * @returns The one to resume, or undefined when the opening wants none or the named one is not here.
 */
function resumeTargetOf(
  opening: DefenseOpening,
  sessions: readonly DefenseSession[]
): DefenseSession | undefined {
  switch (opening.kind) {
    // Continue where the student left off, which is what reopening a problem usually means
    case 'newest':
      return sessions[0]

    // Continue one in particular
    case 'named':
      return sessions.find((session) => session.id === opening.sessionId)

    // Start over beside whatever is already saved
    case 'fresh':
      return undefined

    // Every opening is handled above
    default:
      return assertNever(opening)
  }
}
