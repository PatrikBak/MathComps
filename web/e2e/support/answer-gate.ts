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
