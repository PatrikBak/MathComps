/**
 * Waits for a while.
 *
 * @param delayMs - How long to wait, in milliseconds.
 *
 * @returns A promise settling once the wait is over.
 */
export function delay(delayMs: number): Promise<void> {
  // Resolve once the timer fires
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}
