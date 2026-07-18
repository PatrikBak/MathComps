import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFENSE_SESSIONS_STORAGE_KEY } from '@/constants/local-storage-constants'

import type { DefenseSession } from '../model/defense-types'
import { listSessions } from './session-service'

/**
 * A minimal in-memory stand-in for the browser's local storage.
 *
 * @returns The fake storage.
 */
function fakeLocalStorage() {
  // The stored payloads by key
  const entries = new Map<string, string>()

  // Just the getItem/setItem surface
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
  }
}

/**
 * Builds a stored session for a problem, with one throwaway turn.
 *
 * @param id - The session's id.
 * @param problemKey - The problem the session is about.
 *
 * @returns The stored session.
 */
function storedSession(id: string, problemKey: string): DefenseSession {
  // A minimal session, enough to be listed
  return {
    id,
    problemKey,
    turns: [{ role: 'student', content: 'x', createdAt: 'ts' }],
  }
}

describe('session-service', () => {
  beforeEach(() => {
    // The service resolves its datastore off the browser window, absent under the node test runner
    vi.stubGlobal('window', { localStorage: fakeLocalStorage() })
  })

  afterEach(() => {
    // Drop the stubbed window so other suites see the plain node environment
    vi.unstubAllGlobals()
  })

  it('lists only the sessions of the given problem', async () => {
    // Two sessions across two problems in the store
    window.localStorage.setItem(
      DEFENSE_SESSIONS_STORAGE_KEY,
      JSON.stringify([storedSession('a', 'p1'), storedSession('b', 'p2')])
    )

    // List one problem's sessions
    const sessions = await listSessions('p1')

    // Only that problem's session comes back
    expect(sessions.map((session) => session.id)).toEqual(['a'])
  })

  it('treats a corrupted payload as an empty store', async () => {
    // A payload that isn't JSON at all
    window.localStorage.setItem(DEFENSE_SESSIONS_STORAGE_KEY, 'not json')

    // List against the corrupted store
    const sessions = await listSessions('p1')

    // The corruption reads as empty instead of crashing
    expect(sessions).toEqual([])
  })

  it('treats a non-array JSON payload as an empty store, not a spread of its characters', async () => {
    // A JSON-valid string payload, whose characters must not be spread back in as sessions
    window.localStorage.setItem(DEFENSE_SESSIONS_STORAGE_KEY, '"clobbered"')

    // List against the malformed store
    const sessions = await listSessions('p1')

    // The wrong shape reads as empty
    expect(sessions).toEqual([])
  })
})
