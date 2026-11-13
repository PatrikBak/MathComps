'use client'

import { useAuth } from '@clerk/nextjs'
import { useState } from 'react'

import { SECOND_MS } from '@/components/shared/utils/time-units'
import { useApiQuery } from '@/hooks/use-api-query'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'
import { cachePolicy } from '@/lib/query-config'

import type { DefenseTarget } from '../model/defense-target'
import type { DefensePhotoHandoffPage } from '../model/defense-types'
import { takePhotoHandoffPages } from '../services/photo-service'
import { photoHandoffPagesQueryKey } from './defense-cache'

/**
 * How often the pages are asked for while the student's code works.
 */
const TAKE_INTERVAL_MS = 3 * SECOND_MS

/**
 * No pages handed over yet.
 */
const NO_ARRIVAL: readonly number[] = []

/**
 * Options for {@link useDefensePhotoHandoffPages}.
 */
type UseDefensePhotoHandoffPagesOptions = {
  /** What the student is defending. */
  target: DefenseTarget
  /** Takes pages the student's phone sent, handing back their ids in page order. */
  onArrive: (pages: readonly DefensePhotoHandoffPage[]) => readonly number[]
}

/**
 * What the composer took from the student's phone last.
 */
export type UseDefensePhotoHandoffPagesResult = {
  /** The ids of the pages the latest take handed over, in page order, or none before a take brought any. */
  latestArrival: readonly number[]
}

/**
 * Takes the pages the student's phone sent to what they are defending: once as the composer opens, and every few
 * seconds while the student has a code that works. Each take hands its pages over as it lands, so they keep coming
 * whatever the composer shows. A composer in a background tab asks for nothing.
 *
 * Only a computer takes them, the phone being the computer's camera.
 *
 * @param options - What the student is defending, and where the pages go.
 *
 * @returns The ids of the pages that came last.
 */
export function useDefensePhotoHandoffPages({
  target,
  onArrive,
}: UseDefensePhotoHandoffPagesOptions): UseDefensePhotoHandoffPagesResult {
  // Whose pages these are, once Clerk knows
  const { userId, isLoaded: isUserLoaded } = useAuth()

  // Whether this is a computer, which the phone hands its photos to
  const { hasFinePointer } = useDeviceCapabilities()

  // The ids of the pages the latest take handed over
  const [latestArrival, setLatestArrival] = useState(NO_ARRIVAL)

  // The take, asked again while the code works
  useApiQuery({
    queryKey: photoHandoffPagesQueryKey(target, isUserLoaded ? (userId ?? null) : null),
    fetch: async (apiCall) => {
      // The waiting pages, which the API gives away as it answers
      const result = await takePhotoHandoffPages(apiCall, target)

      // Handed over the moment they land, once: the cached answer is read again whenever a composer opens on it,
      // and its pages would come twice
      if (result.success && result.data.pages.length > 0) {
        setLatestArrival(onArrive(result.data.pages))
      }

      // The answer, whose word on the code says whether to ask again
      return result
    },
    // The student's own pages, so they are taken as them
    requireAuth: true,
    // Only once the key's user is settled, and only where the phone hands its photos over
    enabled: isUserLoaded && hasFinePointer,
    // Taken only when asked or on the timer below, the pages being the student's own
    cachePolicy: cachePolicy.onDemand,
    // Taken afresh every time the composer opens, since pages sent meanwhile are waiting
    staleTime: 0,
    // Asked again while the code works; once it stops, nothing more can come
    refetchInterval: (query) => (query.state.data?.hasLiveCode ? TAKE_INTERVAL_MS : false),
  })

  // The ids of the pages that came last
  return { latestArrival }
}
