import { describe, expect, it } from 'vitest'

import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'

import {
  countActiveFilters,
  decodeProblemKey,
  type DefenseReviewSignals,
  encodeProblemKey,
  readSignalSelection,
  serializeFilter,
  toSignalSelection,
  withFilterField,
} from '../defense-review-filters'
import type { DefenseReviewFilter } from '../defense-review-types'

describe('serializeFilter', () => {
  it('keys two filterings that narrow the same conversations alike', () => {
    // The two fields, set one way round
    const first = serializeFilter({ unread: true, userId: 'u1' })

    // And the other
    const second = serializeFilter({ userId: 'u1', unread: true })

    // Both key as one query, so the queue isn't read twice for one narrowing
    expect(first).toBe(second)
  })

  it('tells a filter looking for the absent case from one not asking', () => {
    // Not asking about notes at all
    const unasked = serializeFilter({})

    // Asking for the ones carrying none
    const asked = serializeFilter({ hasNotes: false })

    // Two different queues, and so two keys
    expect(unasked).not.toBe(asked)
  })

  it('reduces a filter narrowing nothing to an empty string', () => {
    // Nothing set, so there is nothing to key on
    expect(serializeFilter({})).toBe('')
  })
})

describe('withFilterField', () => {
  it('keeps a field asking for the absent case, which narrows as much as any other', () => {
    // "Carries no notes" is a narrowing, and false is how it is spelled
    const next = withFilterField({ unread: true }, 'hasNotes', false)

    // The field stands, rather than being read as nothing to narrow by and dropped
    expect(next.hasNotes).toBe(false)
    expect(Object.keys(next)).toContain('hasNotes')
  })

  it('drops a field that stops narrowing anything', () => {
    // The reader clearing the reported signal, which is what undefined stands for
    const next = withFilterField(
      { unread: true, studentReported: true },
      'studentReported',
      undefined
    )

    // Gone rather than held as undefined, so a filter's fields are the ones actually narrowing something
    expect(Object.keys(next)).toEqual(['unread'])
  })

  it('leaves the filter it was handed standing', () => {
    // The filter as the queue currently holds it
    const filter: DefenseReviewFilter = { unread: true }

    // Narrowed further
    withFilterField(filter, 'userId', 'u1')

    // The one handed over is untouched, since the queue keys its reads off the filter it is holding
    expect(filter).toEqual({ unread: true })
  })
})

describe('countActiveFilters', () => {
  it('counts a field looking for the absent case, since it still narrows', () => {
    // Asking for the conversations carrying no notes is as much a filter as any other, which the obvious
    // rewrite of the count into a truthiness test silently stops being true
    expect(countActiveFilters({ hasNotes: false })).toBe(1)
  })
})

describe('encodeProblemKey/decodeProblemKey', () => {
  it('round-trips a problem through its id', () => {
    // A problem, named the way the content ids really look
    const target: HandoutEnvironmentTarget = {
      handoutContentId: 'Kp2vR8mLqX3nYwTfJc6Db',
      environmentId: 'K8Jhyizt5YvLRX463Ka_e',
    }

    // Both halves survive the trip through the option's id
    expect(decodeProblemKey(encodeProblemKey(target))).toEqual(target)
  })

  it('refuses an id that names only one half', () => {
    // A problem without its handout names nothing
    expect(decodeProblemKey('handout-only')).toBeNull()
  })

  it('refuses an id whose halves are empty', () => {
    // The separator alone is not an id either
    expect(decodeProblemKey(':')).toBeNull()
  })
})

describe('readSignalSelection', () => {
  it('unseats the standing half of the notes pair rather than losing to it', () => {
    // Carrying notes is what the filter currently stands for, and carrying none was just picked
    const signals = readSignalSelection(['hasNotes', 'noNotes'], { hasNotes: true })

    // The half just picked takes the field, rather than losing to the one already standing
    expect(signals.hasNotes).toBe(false)
  })

  it('keeps the standing half when the selection adds neither', () => {
    // The pair is untouched, so the reported signal is the only thing that changed
    const signals = readSignalSelection(['noNotes', 'reported'], { hasNotes: false })

    // The notes field stands where it was, and the new signal joins it
    expect(signals.hasNotes).toBe(false)
    expect(signals.studentReported).toBe(true)
  })

  it('leaves the field narrowing nothing once neither half is picked', () => {
    // Clearing the pair clears the field, rather than leaving whichever half was standing
    expect(readSignalSelection([], { hasNotes: true }).hasNotes).toBeUndefined()
  })

  it('clears a signal standing on its own once it is unpicked', () => {
    // Both signals are standing, and the selection now holds neither
    const signals = readSignalSelection([], { studentReported: true, studentFeedback: true })

    // Neither is carried over from the filter as it stood, which is what makes them clearable at all
    expect(signals.studentReported).toBeUndefined()
    expect(signals.studentFeedback).toBeUndefined()
  })

  it('round-trips a filter through the options standing for it', () => {
    // Every signal the facet can hold at once
    const filter: DefenseReviewSignals = {
      hasNotes: false,
      studentReported: true,
      studentFeedback: true,
    }

    // Read out as options and back again, it narrows the same conversations
    expect(readSignalSelection(toSignalSelection(filter), filter)).toEqual(filter)
  })
})
