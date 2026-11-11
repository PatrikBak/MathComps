// The take of the pages a student's phone sent: which refreshes reach it, and what a refresh does to a take out.

import type { QueryFunctionContext } from '@tanstack/react-query'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { DefenseTarget } from '../../model/defense-target'
import type { DefensePhotoHandoffPages } from '../../model/defense-types'
import {
  defenseSessionsQueryKey,
  invalidateDefenseLists,
  photoHandoffPagesQueryKey,
  refreshPhotoHandoffPages,
} from '../defense-cache'

/** The problem every take here is for. */
const TARGET: DefenseTarget = { kind: 'proposal', problemId: 'problem-1' }

/** A take finding nothing, the student's code still working. */
const NOTHING_WAITING: DefensePhotoHandoffPages = { pages: [], hasLiveCode: true }

describe('the phone pages take', () => {
  it('is left alone when every defense list is refreshed', () => {
    // A take and a conversation list, both answered
    const queryClient = new QueryClient()
    const takeKey = photoHandoffPagesQueryKey(TARGET, 'student')
    const listKey = defenseSessionsQueryKey(TARGET, 'student')
    queryClient.setQueryData(takeKey, NOTHING_WAITING)
    queryClient.setQueryData(listKey, [])

    // Every defense list refreshed, as a write to a conversation does
    invalidateDefenseLists(queryClient)

    // The list is read again, and the take is not, since cancelling one out would drop its pages
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(takeKey)?.isInvalidated).toBe(false)
  })

  it('lets a take already out land before taking again', async () => {
    // The abort signal of each take made, in order, and the answer the first one waits for
    const queryClient = new QueryClient()
    const signals: AbortSignal[] = []
    const firstAnswer = Promise.withResolvers<DefensePhotoHandoffPages>()

    // A composer that has taken once already, its answer in the cache
    const queryKey = photoHandoffPagesQueryKey(TARGET, 'student')
    queryClient.setQueryData(queryKey, NOTHING_WAITING)

    // Open again with a take out, the first held until the spec answers it
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: ({ signal }: QueryFunctionContext) => {
        // The take, recorded with its signal
        signals.push(signal)

        // The first held, every later one answered at once
        return signals.length === 1 ? firstAnswer.promise : Promise.resolve(NOTHING_WAITING)
      },
    })
    const stop = observer.subscribe(() => {})

    // The code pointed while that take is out
    const refreshed = refreshPhotoHandoffPages(queryClient, TARGET)

    // The take out answers, its pages handed over
    firstAnswer.resolve(NOTHING_WAITING)
    await refreshed

    // It was never cancelled, and one more take followed it
    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(false)

    // The composer shut
    stop()
  })
})
