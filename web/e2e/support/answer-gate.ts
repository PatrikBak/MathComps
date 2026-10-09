import type { Page } from '@playwright/test'

/**
 * A gate a fake backend's answers wait at. It stands open until a test holds it, which lets the test catch the
 * page with a request still in flight.
 */
export type AnswerGate = {
  /** Resolves once the gate is open. */
  passed: () => Promise<void>
  /** Shuts the gate for every answer from here on, handing back the way to open it again. */
  hold: () => () => void
}

/**
 * Builds a gate, open to begin with.
 * @returns The gate.
 */
export function createAnswerGate(): AnswerGate {
  // What an answer waits on, which lets everything through until a test holds it
  let gate: Promise<void> = Promise.resolve()

  // A function which waits for the gate to open
  const passed = () => gate

  // A function which shuts the gate, handing back the way to open it
  const hold = () => {
    // The release, filled in by the promise it settles
    let release = () => {}

    // Every answer from here on waits on that promise
    gate = new Promise((resolve) => {
      release = resolve
    })

    // The way to let the held answers through
    return release
  }

  // The gate
  return { passed, hold }
}

/**
 * Puts a gate in front of every read of one address, so a test can keep a read in flight across whatever it does
 * next. Each read waits at the gate, then goes on to whatever answers the address.
 *
 * Installed after the fake answering the address, since the route registered last is the one Playwright tries
 * first.
 *
 * @param page - The page to intercept requests on.
 * @param address - The address the reads go to, as Playwright matches a route.
 *
 * @returns The gate, open until the test holds it.
 */
export async function gateReads(page: Page, address: string): Promise<AnswerGate> {
  // What every read waits at
  const gate = createAnswerGate()

  // Each read, held for as long as the gate is
  await page.route(address, async (route) => {
    // Waiting until the gate is open
    await gate.passed()

    // Then answered by the fake behind this
    await route.fallback()
  })

  // The gate, for the test to hold and release
  return gate
}
