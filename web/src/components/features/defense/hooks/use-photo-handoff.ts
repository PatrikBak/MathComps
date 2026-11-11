'use client'

import { useLocale } from 'next-intl'

import { apiCallOf, useApi } from '@/hooks/use-api'
import { useApiQuery } from '@/hooks/use-api-query'
import { cachePolicy } from '@/lib/query-config'

import type { HandoffPhotoReading } from '../model/defense-types'
import type { HandoffPhoto } from '../model/photo-handoff'
import type { PhotoHandoffState } from '../model/photo-handoff-check'
import {
  checksHandoffOnReturn,
  HANDOFF_POLL_MS,
  handoffCheckInterval,
  photoHandoffStateOf,
} from '../model/photo-handoff-check'
import type { PhotoReader } from '../model/photo-reading'
import { checkPhotoHandoff, sendHandoffPhoto } from '../services/photo-service'
import { photoHandoffQueryKey } from './defense-cache'
import type { UseDefensePhotosResult } from './use-defense-photos'
import { useDefensePhotos } from './use-defense-photos'
import { useHeldDefensePhotos } from './use-held-defense-photos'

/**
 * A phone's handoff: where its code stands, and the photos it sends through it.
 */
type UsePhotoHandoffResult = {
  /** Where the code stands. */
  state: PhotoHandoffState
  /** The photos sent through the code, and what can be done with them. */
  photos: UseDefensePhotosResult<HandoffPhotoReading>
}

/**
 * The phone's side of a photo handoff. The code is checked every few seconds while the page shows, and again
 * whenever it shows once more (the camera closing, the screen waking), so the problem it names follows the
 * computer's. Each photo is read through the code, as the code's student.
 *
 * @param code - The handoff code.
 *
 * @returns Where the code stands, and the photos.
 */
export function usePhotoHandoff(code: string): UsePhotoHandoffResult {
  // The reader's language, which the problem comes back named in
  const locale = useLocale()

  // Where the code sends photos now, how its latest check stands, and a way to check again
  const {
    data: check,
    uiState,
    retry,
  } = useApiQuery({
    queryKey: photoHandoffQueryKey(code, locale),
    fetch: (apiCall) => checkPhotoHandoff(apiCall, code),
    // The phone holds the code and no account
    requireAuth: false,
    // The computer moves the code to another problem while the phone looks on
    cachePolicy: cachePolicy.live,
    // Stale by the next tick, so coming back to the page checks at once
    staleTime: HANDOFF_POLL_MS,
    // On the handoff's own beat, by rules of its own
    refetchInterval: handoffCheckInterval,
    // And on coming back to the page or to the network, by rules of its own too
    refetchOnWindowFocus: checksHandoffOnReturn,
    refetchOnReconnect: checksHandoffOnReturn,
  })

  // The caller the photos go through, signed in or not
  const apiCall = apiCallOf(useApi({ requireAuth: false }))

  // Where a photo goes to be read through the code, once there is a caller
  const reader: PhotoReader<HandoffPhotoReading> | null =
    apiCall === null ? null : (request) => sendHandoffPhoto(apiCall, code, request)

  // The photos held, only while the page is open
  const held = useHeldDefensePhotos<HandoffPhoto>(null)

  // The photos as they are picked and sent, shrunk to the size the code's check gives before they go
  const photos = useDefensePhotos<HandoffPhotoReading>({
    held,
    reader,
    photoLongEdge: check?.photoLongEdge ?? null,
  })

  // Where the code stands
  const state = photoHandoffStateOf(uiState, check, retry)

  // Where the code stands, and the photos
  return { state, photos }
}
