'use client'

/**
 * Where the mocked backends keep what a reader has done to them.
 *
 * They hold their facts in module memory, which a reload rebuilds from the scenario's starting state: an
 * entry taken a moment ago is gone, and the area it was taken for turns the reader away as somebody who
 * never entered. That reads as a broken guard rather than as a backend with no tables behind it.
 *
 * Session storage rather than local storage, so a fresh tab still starts from the scenario's own facts and
 * nothing a developer did last week is still on the screen. It goes when the mocked services do.
 */

/** What every key here is prefixed with, so one line clears the lot from the console. */
const MOCK_STORAGE_PREFIX = 'mathcomps.mock.'

/**
 * Reads back whatever a mocked backend last wrote under one name.
 *
 * @param key - What the mocked backend calls its state.
 *
 * @returns The state, or null when there is none to read or it cannot be read.
 */
export function readMockState<T>(key: string): T | null {
  // Nothing to read from on the server, and a browser can refuse storage outright
  try {
    // What was written, if anything ever was
    const written = window.sessionStorage.getItem(MOCK_STORAGE_PREFIX + key)

    // What it holds, if anything
    return written === null ? null : (JSON.parse(written) as T)
  } catch {
    // Nothing to read, or nowhere to read it from
    return null
  }
}

/**
 * Holds a mocked backend's state across a reload.
 *
 * @param key - What the mocked backend calls its state.
 * @param state - The state to hold.
 */
export function writeMockState(key: string, state: unknown): void {
  // A browser can refuse storage outright, and a mock is not worth failing a page over
  try {
    window.sessionStorage.setItem(MOCK_STORAGE_PREFIX + key, JSON.stringify(state))
  } catch {
    // Nothing to do about it: the mock keeps working, it just forgets on the next reload
  }
}
