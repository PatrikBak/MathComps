import { describe, expect, it } from 'vitest'

import { ApiRequestError } from '@/lib/api/api-error'

import type { NamedDefenseTarget, PhotoHandoffCheck } from '../defense-types'
import { HANDOFF_POLL_MS, handoffCheckInterval, photoHandoffStateOf } from '../photo-handoff-check'

/** The problem the code points at. */
const TARGET: NamedDefenseTarget = {
  kind: 'proposal',
  problemId: 'p-1',
  organizationSlug: 'olympiad',
  slug: 'p-1',
  number: 7,
  title: 'Two circles',
}

/** A check that landed, naming {@link TARGET}. */
const CHECK: PhotoHandoffCheck = {
  handoff: { target: TARGET, expiresAt: '2099-01-01T00:00:00Z' },
  photoLongEdge: 2000,
}

/** The API's word for a code that never worked or has run out. */
const DEAD = new ApiRequestError({ errorCode: 'DefensePhotoHandoffNotFound', statusCode: 404 })

/** A refusal saying nothing about the code. */
const TOO_OFTEN = new ApiRequestError({ errorCode: 'RateLimited', statusCode: 429 })

/** A function which checks again, never pressed here. */
const retry = () => {}

describe('photoHandoffStateOf', () => {
  it('calls a code dead once the API says so, whether or not a check landed before', () => {
    // The API's word on the code
    const failed = { kind: 'failed', error: DEAD, isPermanent: true } as const

    // Where the code stands after a check that landed
    const afterCheck = photoHandoffStateOf(failed, CHECK, retry)

    // Where the code stands with none landed
    const firstCheck = photoHandoffStateOf(failed, undefined, retry)

    // Dead either way
    expect(afterCheck).toEqual({ kind: 'dead' })
    expect(firstCheck).toEqual({ kind: 'dead' })
  })

  it('names the problem the latest check landed on while a later one fails for another reason', () => {
    // A later check refused, a check having landed before it
    const state = photoHandoffStateOf(
      { kind: 'failed', error: TOO_OFTEN, isPermanent: true },
      CHECK,
      retry
    )

    // Still the problem that check named
    expect(state).toEqual({ kind: 'live', target: TARGET })
  })

  it('says why a first check gave up for a reason other than the code', () => {
    // A first check refused
    const state = photoHandoffStateOf(
      { kind: 'failed', error: TOO_OFTEN, isPermanent: true },
      undefined,
      retry
    )

    // Its failure, with the way to check again
    expect(state).toEqual({ kind: 'checkFailed', errorCode: 'RateLimited', retry })
  })
})

describe('handoffCheckInterval', () => {
  it('never asks about a dead code again, even with an earlier check held', () => {
    // A check held, the latest one having called the code dead
    const interval = handoffCheckInterval({ state: { data: CHECK, error: DEAD, status: 'error' } })

    // No next check
    expect(interval).toBe(false)
  })

  it('waits for another go after a first check gave up', () => {
    // No check held, the first one refused
    const interval = handoffCheckInterval({
      state: { data: undefined, error: TOO_OFTEN, status: 'error' },
    })

    // No next check until somebody asks
    expect(interval).toBe(false)
  })

  it('keeps the beat after a later check fails for another reason', () => {
    // A check held, the latest one refused
    const interval = handoffCheckInterval({
      state: { data: CHECK, error: TOO_OFTEN, status: 'error' },
    })

    // Asked again on the beat
    expect(interval).toBe(HANDOFF_POLL_MS)
  })
})
