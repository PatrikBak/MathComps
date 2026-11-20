import { afterEach, describe, expect, it, vi } from 'vitest'

import { recordChunkLoadReload, shouldReloadFor } from '../chunk-load-reload'

/** Ten minutes, in milliseconds. */
const TEN_MINUTES_MS = 10 * 60 * 1000

/** The moment the tab records its reload. */
const RELOADED_AT = Date.UTC(2026, 10, 19, 16, 27)

/**
 * A chunk that failed to load, named the way the bundler's runtime names it.
 *
 * @returns The fault.
 */
function chunkLoadError(): Error {
  // The runtime's fault for a chunk the server no longer has
  const error = new Error('Failed to load chunk /_next/static/chunks/a.js from module 1')

  // Its name, which is what tells it apart
  error.name = 'ChunkLoadError'

  // The fault
  return error
}

/**
 * Serves the page from a deployment.
 *
 * @param deployment - The deployment's id.
 */
function servedBy(deployment: string) {
  // The id Next.js hands the page
  vi.stubEnv('NEXT_DEPLOYMENT_ID', deployment)
}

/**
 * Gives the tab an empty storage that keeps what it is handed.
 */
function standInWorkingStorage() {
  // The entries the tab holds
  const entries = new Map<string, string>()

  // The storage, over those entries
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  })
}

/**
 * Gives the tab a storage the browser blocks, which throws on every use.
 */
function standInBlockedStorage() {
  // The browser's refusal
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  }

  // The storage, refusing both reads and writes
  vi.stubGlobal('sessionStorage', { getItem: refuse, setItem: refuse })
}

afterEach(() => {
  // No storage, no deployment and the real clock again, so no test inherits the last one's
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('shouldReloadFor', () => {
  it('reloads over a chunk that failed to load in a tab that never reloaded', () => {
    // A page of one deployment
    servedBy('dpl_a')

    // In a tab with nothing recorded
    standInWorkingStorage()

    // Due
    expect(shouldReloadFor(chunkLoadError())).toBe(true)
  })

  it('never reloads over any other fault', () => {
    // A page of one deployment
    servedBy('dpl_a')

    // In a tab with nothing recorded
    standInWorkingStorage()

    // Not due, since a fresh page cures nothing else
    expect(shouldReloadFor(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it.each([
    [
      'holds off a second reload of the same deployment just inside ten minutes',
      'dpl_a',
      TEN_MINUTES_MS - 1,
      false,
    ],
    ['reloads the same deployment again ten minutes on', 'dpl_a', TEN_MINUTES_MS, true],
    ['reloads a page of a later deployment at once', 'dpl_b', 0, true],
  ])('%s', (_description, failingDeployment, sinceReload, isDue) => {
    // A tab with nothing recorded
    standInWorkingStorage()

    // The clock at the moment of the reload
    vi.useFakeTimers({ now: RELOADED_AT })

    // A page of one deployment
    servedBy('dpl_a')

    // Its reload, recorded
    recordChunkLoadReload()

    // That long after
    vi.setSystemTime(RELOADED_AT + sinceReload)

    // A page of the given deployment
    servedBy(failingDeployment)

    // The same fault on that page
    const result = shouldReloadFor(chunkLoadError())

    // Due unless that same deployment reloaded within the window
    expect(result).toBe(isDue)
  })

  it('never reloads in a tab that cannot read its storage', () => {
    // A page of one deployment
    servedBy('dpl_a')

    // In a tab whose storage the browser blocks
    standInBlockedStorage()

    // Not due, since nothing could stop the reloaded page from reloading again
    expect(shouldReloadFor(chunkLoadError())).toBe(false)
  })
})

describe('recordChunkLoadReload', () => {
  it('reports a reload it could not record', () => {
    // A page of one deployment
    servedBy('dpl_a')

    // In a tab whose storage the browser blocks
    standInBlockedStorage()

    // Not kept, which tells the page not to reload
    expect(recordChunkLoadReload()).toBe(false)
  })
})
