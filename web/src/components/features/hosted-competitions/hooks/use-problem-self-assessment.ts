'use client'

import { useDisclosure } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import {
  clearProblemSelfAssessment,
  setProblemSelfAssessment,
} from '../services/hosted-competition-service'
import type { HostedCompetitionsReaderKey } from './hosted-competition-cache'
import { writeCachedSelfAssessment } from './hosted-competition-cache'

/**
 * Return type for {@link useProblemSelfAssessment}.
 */
type UseProblemSelfAssessmentResult = {
  /** Whether the note is open for writing. */
  isOpen: boolean
  /** Opens it on whatever already stands. */
  open: () => void
  /** Closes it, leaving whatever stands where it is. */
  close: () => void
  /** What is currently typed. */
  draft: string
  /** Takes what the student types. */
  setDraft: (draft: string) => void
  /** Whether the draft says something the record doesn't already say. */
  canSave: boolean
  /** Puts the draft on the record and closes on it. */
  save: () => void
  /** Takes what stands off the record and closes on that; null when nothing stands. */
  remove: (() => void) | null
  /** Whether a write is still out. */
  isSaving: boolean
}

/**
 * The note a student leaves about their own solution to one problem: whether it is open, what is typed in it,
 * and the two writes that put it on the record or take it off.
 *
 * Both writes land in the cached set before the server answers, and the note closes on the press. The two
 * share a queue, so a note and a withdrawal cannot land out of the order they were pressed in, and a refused
 * one is put back before the next one starts.
 *
 * @param readerKey - Who the cached set belongs to.
 * @param competitionSlug - Which competition the problem belongs to.
 * @param problemId - Which problem the note is about.
 * @param assessment - What already stands, which is what the note opens on.
 *
 * @returns The note and its writes.
 */
export function useProblemSelfAssessment(
  readerKey: HostedCompetitionsReaderKey,
  competitionSlug: string,
  problemId: string,
  assessment: string | null
): UseProblemSelfAssessmentResult {
  // Competitions copy
  const t = useTranslations('competitions')

  // The React Query cache
  const queryClient = useQueryClient()

  // Whether the note is open for writing
  const [isOpen, { open: openNote, close }] = useDisclosure(false)

  // What is typed in it
  const [draft, setDraft] = useState(assessment ?? '')

  // Shows the row saying one thing, whatever the server later makes of it, handing back what it said before
  const show = (words: string | null) =>
    writeCachedSelfAssessment(queryClient, readerKey, competitionSlug, problemId, words)

  // What both writes say when they are refused, what they ask a signed-out reader for, and the queue they
  // share, the two of them writing the same row
  const sharedHandling = {
    authReason: t('entryAuthReason'),
    errorMessage: t('selfAssessmentError'),
    scope: { id: `problem-self-assessment-${problemId}` },
    // Put back whatever the row said before the write, which {@link writeCachedSelfAssessment} handed over
    onError: (_error: unknown, _variables: unknown, previous: string | null | undefined) =>
      show(previous ?? null),
  }

  // Recording the note
  const recording = useOptimisticMutation<void, string, string | null>({
    apiFn: (apiCall, words) => setProblemSelfAssessment(apiCall, competitionSlug, problemId, words),
    // The row carries the words from the moment they are sent
    onMutate: (words) => show(words),
    ...sharedHandling,
  })

  // Taking it back
  const withdrawal = useOptimisticMutation<void, void, string | null>({
    apiFn: (apiCall) => clearProblemSelfAssessment(apiCall, competitionSlug, problemId),
    // And the row goes back to asking
    onMutate: () => show(null),
    ...sharedHandling,
  })

  // Opens the note on what already stands, so coming back to it reads what was left rather than a blank field
  const open = () => {
    setDraft(assessment ?? '')
    openNote()
  }

  // What the draft carries, whitespace alone counting as nothing
  const written = draft.trim()

  // There is something to send once the words say something the record doesn't already say
  const canSave = written !== '' && written !== assessment

  // Sends them, closing the note on the press
  const save = () => {
    recording.mutate(written)
    close()
  }

  // Drops what stands, closing the note on that
  const withdraw = () => {
    withdrawal.mutate()
    close()
  }

  // Offered only where there is something to take back
  const remove = assessment === null ? null : withdraw

  // Whether either write is still out
  const isSaving = recording.isPending || withdrawal.isPending

  // The note, what is in it, and the two writes that settle it
  return { isOpen, open, close, draft, setDraft, canSave, save, remove, isSaving }
}
