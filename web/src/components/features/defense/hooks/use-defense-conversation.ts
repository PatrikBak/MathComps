'use client'

import { useAuth } from '@clerk/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { invalidateCompetitionProblems } from '@/components/features/hosted-competitions/hooks/hosted-competition-cache'
import { invalidateSelection } from '@/components/features/problem-selection/hooks/selection-cache'
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
import {
  type DefenseHistoryRead,
  type DefenseOpeningStatus,
  type OpeningDecided,
  resolveOpening,
} from '../model/defense-opening'
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
 * How the read of a problem's saved conversations is going, as the query behind it reports it.
 */
type HistoryQueryState = {
  /** The conversations the last read that got through came back with, undefined while none has. */
  sessions: readonly DefenseSession[] | undefined
  /** Whether the latest read gave up. */
  isFailed: boolean
  /** Whether a read is on its way. */
  isFetching: boolean
  /** Whether what is in hand is known to miss a write made since it was read. */
  isOutdated: boolean
}

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
    /** This problem's persisted sessions, most recently active first. */
    sessions: DefenseSession[]
    /** The caps a defense here is held to, or null until the history has been read. */
    limits: DefenseLimits | null
    /** What is known of this problem's saved conversations. */
    history: DefenseHistoryRead
    /** Where the conversation the chat opens on stands, held from the moment it is decided. */
    openingStatus: DefenseOpeningStatus
    /** Reads this problem's session history again after a failed read. */
    retrySessions: () => void
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
 * @param opening - Which conversation to open on; a named one this problem's history never turns up opens
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

  // Where this problem's persisted sessions are cached, under whoever is reading them
  const sessionsQueryKey = defenseSessionsQueryKey(
    problem.target,
    isUserLoaded ? (userId ?? null) : null
  )

  // This problem's persisted sessions
  const {
    data: sessionsData,
    uiState: sessionsState,
    isFetching: isFetchingSessions,
    retry: retrySessions,
  } = useApiQuery({
    queryKey: sessionsQueryKey,
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

          // Refresh whatever else lists the problem's conversations, which no defense query reaches
          switch (problem.target.kind) {
            // A competition's problem sits in the competition area's list, which carries its conversations
            case 'competition':
              invalidateCompetitionProblems(queryClient)
              break

            // A proposed problem sits in the selection, which carries every reviewer's conversations
            case 'proposal':
              invalidateSelection(queryClient)
              break

            // A handout's conversations live in the defense lists alone
            case 'handout':
              break

            // Every target is handled above
            default:
              assertNever(problem.target)
          }
        },
      })
  )

  // The model's current state; a fresh model's snapshot is deterministic, so the same read doubles
  // as the server-render snapshot
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)

  // What is known of this problem's saved conversations
  const history = historyReadOf({
    sessions: sessionsData?.sessions,
    isFailed: sessionsState.kind === 'failed',
    isFetching: isFetchingSessions,
    isOutdated: queryClient.getQueryState(sessionsQueryKey)?.isInvalidated === true,
  })

  // The opening once decided, held from then on so no later read of the history moves it
  const [decidedOpening, setDecidedOpening] = useState<OpeningDecided | null>(null)

  // Where the opening stands: as decided, or as what is known of the history decides it now
  const openingStatus = decidedOpening ?? resolveOpening(opening, history)

  // Carry on the decided conversation the moment there is one, so opening a problem you have defended before
  // continues that conversation. Once only: afterwards the model keeps wherever the student navigated
  useEffect(() => {
    // Nothing to carry on until the opening is decided, and nothing more once it has been
    if (decidedOpening !== null || openingStatus.kind !== 'decided') {
      return
    }

    // Held, so the decision stands
    setDecidedOpening(openingStatus)

    // The live conversation state
    const { currentSessionId, isThinking } = model.getSnapshot()

    // Resume the decided conversation only over an untouched fresh one: an open session or an in-flight
    // turn means the student is mid-interaction and must not be pulled away
    if (currentSessionId === null && !isThinking && openingStatus.conversation !== null) {
      model.resume(openingStatus.conversation)
    }
  }, [decidedOpening, openingStatus, model])

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
    sessions: sessionsData?.sessions ?? [],
    limits: sessionsData?.limits ?? null,
    history,
    openingStatus,
    retrySessions,
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
 * Gathers how the read of a problem's saved conversations is going into what is known of them.
 *
 * @param query - How the read is going, as the query behind it reports it.
 *
 * @returns What is known of the conversations.
 */
function historyReadOf(query: HistoryQueryState): DefenseHistoryRead {
  // Nothing in hand, so either a read is still to come or it gave up
  if (query.sessions === undefined) {
    return query.isFailed ? { kind: 'unreadable' } : { kind: 'awaited' }
  }

  // A list in hand, whose newer read gave up
  if (query.isFailed) {
    return {
      kind: 'inHand',
      sessions: query.sessions,
      isOutdated: query.isOutdated,
      refresh: 'failed',
    }
  }

  // A list in hand, with a newer read on its way or none asked for
  return {
    kind: 'inHand',
    sessions: query.sessions,
    isOutdated: query.isOutdated,
    refresh: query.isFetching ? 'coming' : 'none',
  }
}
