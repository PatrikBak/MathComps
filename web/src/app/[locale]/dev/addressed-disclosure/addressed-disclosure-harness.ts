/**
 * One set of things the page opens one at a time, named on the address under a parameter of its own.
 */
export type HarnessGroup = {
  /** The set's name, which titles its section. */
  title: string
  /** The query parameter naming which of its things is open. */
  param: string
  /** The values its things answer to. */
  values: readonly string[]
}

/** The page's route, without its locale. */
export const HARNESS_ROUTE = '/dev/addressed-disclosure'

/** The sets on the page, which share one address. */
export const HARNESS_GROUPS: readonly HarnessGroup[] = [
  { title: 'Letters', param: 'letter', values: ['a', 'b'] },
  { title: 'Numbers', param: 'number', values: ['1', '2'] },
]

/** The page's own words, which read the same in every locale. */
export const HARNESS_COPY = {
  /**
   * The name of the button opening one thing.
   *
   * @param value - The value the thing answers to.
   *
   * @returns The button's name.
   */
  open: (value: string) => `Open ${value}`,
  /** The name of the button closing whatever is open in a set. */
  close: 'Close',
  /** What a set says while none of its things is open. */
  noneOpen: 'Nothing open',
  /**
   * What a set says while one of its things is open.
   *
   * @param value - The value the open thing answers to.
   *
   * @returns The set's status.
   */
  opened: (value: string) => `${value} is open`,
  /** The name of the page's link to itself, whose address is bare. */
  thisPage: 'This page, with nothing on its address',
}
