'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useSyncExternalStore } from 'react'

import { cachePolicy } from '@/lib/query-config'

import {
  DefenseConversationModel,
  type DefenseConversationState,
} from '../model/defense-conversation-model'
import type { DefenseProblem, DefenseSession } from '../model/defense-types'
import { deleteSession, listSessions, submitTurn } from '../services/session-service'

/**
 * Builds the query key for the sessions held about a problem.
 *
 * @param problemKey - The anchor slug of the problem whose sessions the query holds.
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
  Pick<DefenseConversationModel, 'send' | 'stop' | 'startNew' | 'resume' | 'deleteSession'> & {
    /** This problem's persisted sessions, oldest first. */
    sessions: DefenseSession[]
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

  // This problem's persisted sessions, oldest first
  const sessionsQuery = useQuery({
    queryKey: sessionsQueryKey(problem.key),
    queryFn: () => listSessions(problem.key),
    // Sessions are the user's own recent activity
    ...cachePolicy.userData,
  })

  // The conversation's state machine, created once for the mount's life
  const [model] = useState(
    () =>
      new DefenseConversationModel({
        problem,
        opener,
        services: { submitTurn, deleteSession },
        onSessionsChanged: () =>
          queryClient.invalidateQueries({ queryKey: sessionsQueryKey(problem.key) }),
      })
  )

  // Track the model's state; a fresh model's snapshot is deterministic, so the same read doubles as
  // the server-render snapshot
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot)

  // The conversation state, this problem's history, and the controls that drive it
  return {
    ...state,
    sessions: sessionsQuery.data ?? [],
    send: model.send,
    stop: model.stop,
    startNew: model.startNew,
    resume: model.resume,
    deleteSession: model.deleteSession,
  }
}
