'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'
import { errorCodeOf } from '@/lib/api/api-error'

import type { DefenseTarget } from '../model/defense-target'
import type { DefensePhotoHandoffCode } from '../model/defense-types'
import type { DefensePhotoHandoff } from '../model/photo-handoff-code'
import { pointPhotoHandoff } from '../services/photo-service'
import { refreshPhotoHandoffPages } from './defense-cache'

/**
 * Options for {@link useDefensePhotoHandoff}.
 */
type UseDefensePhotoHandoffOptions = {
  /** What the student is defending. */
  target: DefenseTarget
}

/**
 * The student's phone photo handoff, and the way to point it at the target.
 */
export type UseDefensePhotoHandoffResult = {
  /** The state of the last request for the code. */
  handoff: DefensePhotoHandoff
  /** Points the student's code at the target, making them one when they have none that still works. */
  point: () => void
}

/**
 * Points the student's phone photo handoff at what they are defending, so the photos their phone sends go there.
 * Each point is asked for again, since the code may have been pointed at another target meanwhile.
 *
 * @param options - What the student is defending.
 *
 * @returns Where the code stands, and the way to point it.
 */
export function useDefensePhotoHandoff({
  target,
}: UseDefensePhotoHandoffOptions): UseDefensePhotoHandoffResult {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // The cache the composer's take of the phone's pages lives in
  const queryClient = useQueryClient()

  // Pointing the code
  const mutation = useOptimisticMutation<DefensePhotoHandoffCode, DefenseTarget>({
    // Call the handoff endpoint
    apiFn: pointPhotoHandoff,

    // What a signed-out student is asked to sign in for
    authReason: t('phoneAuthReason'),

    // No toast, since the failure is said in place
    errorMessage: null,

    // The pages taken straight away, which finds the code working, so the composer goes on asking for them
    onSuccess: (_data, pointedTarget) => void refreshPhotoHandoffPages(queryClient, pointedTarget),
  })

  // Where the last point stands: refused or never answered, or else the code once it has come, each point starting
  // with none
  const handoff: DefensePhotoHandoff = mutation.isError
    ? { kind: 'failed', errorCode: errorCodeOf(mutation.error) }
    : mutation.data === undefined
      ? { kind: 'pointing' }
      : { kind: 'pointed', code: mutation.data.code }

  // Points the code at the target
  const point = () => mutation.mutate(target)

  // Where the code stands, and the way to point it
  return { handoff, point }
}
