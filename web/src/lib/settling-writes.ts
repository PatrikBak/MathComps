/**
 * Works out what a record goes back to when one of several quick optimistic writes to it is refused.
 *
 * Setting a value to 3 and then to 4 sends two writes and shows each at once. If both are refused, the record has
 * to go back to the value before either write. Rolling each write back to the state it replaced would leave it at
 * 3, which the server never took.
 *
 * So each record keeps the last state the server is known to hold: the one before the first write, moved on by
 * every write that lands. A refused write puts that state back, unless a later write is still settling, since
 * that one decides what the record ends up saying.
 */

/**
 * A state a record is known to hold, wrapped so that a record holding nothing at all can be told apart from
 * a record whose state is itself empty.
 */
type HeldState<TState> = {
  /** The state. */
  state: TState
}

/**
 * The writes still settling on one record, as the state they fall back to and how many are still out.
 */
type SettlingRecord<TState> = {
  /**
   * The last state the server is known to hold: what the record said before the first write, then whatever each
   * write that lands leaves behind. Null until a state is held.
   */
  confirmed: HeldState<TState> | null
  /** How many writes on the record have yet to settle. */
  outstanding: number
}

/**
 * Tracks the optimistic writes still settling on each record. Records are keyed by whatever identifies them.
 */
export type SettlingWrites<TState> = {
  /** Counts one more write on a record, telling whether it opens the set rather than joining one. */
  begin: (key: string) => boolean
  /** Holds what a record says before any write in its set touched it; a record already holding one keeps it. */
  holdBefore: (key: string, state: TState) => void
  /** Moves a record on to what a landed write left, telling whether it holds a state and no write is behind it. */
  land: (key: string, state: TState) => boolean
  /** What a refused write puts back; null where a write behind it decides, or nothing was held. */
  refuse: (key: string) => HeldState<TState> | null
  /** Counts a write as settled, forgetting the record once none is left. */
  settle: (key: string) => void
}

/**
 * Starts tracking the writes settling on a set of records.
 *
 * Writes on one record are assumed to reach the server in the order they were made, which is what makes the
 * last one to settle the one that decides what the record ends up saying.
 *
 * @returns The tracker, holding nothing yet.
 */
export function createSettlingWrites<TState>(): SettlingWrites<TState> {
  // Every record with a write still settling on it
  const records = new Map<string, SettlingRecord<TState>>()

  // A function which counts one more write on a record
  const begin = (key: string) => {
    // Whatever is already settling on it
    const existing = records.get(key)

    // One more to settle, on the set it joins or on a new one
    records.set(key, {
      confirmed: existing?.confirmed ?? null,
      outstanding: (existing?.outstanding ?? 0) + 1,
    })

    // Only the write that opened the set sees the record as the server last left it
    return existing === undefined
  }

  // A function which holds what a record said before its set of writes
  const holdBefore = (key: string, state: TState) => {
    // The writes settling on the record
    const record = records.get(key)

    // Only the first state held counts, since a later write reads what an earlier one optimistically wrote
    if (record !== undefined && record.confirmed === null) record.confirmed = { state }
  }

  // A function which moves a record on to what a landed write left
  const land = (key: string, state: TState) => {
    // The writes settling on the record
    const record = records.get(key)

    // A record with nothing held has nothing to move on
    if (record?.confirmed == null) return false

    // This write is on the server now, so it and not the state before the set is what a write failing behind
    // it has to put back: rolling past a committed write leaves the record saying something the server does not hold
    record.confirmed = { state }

    // Whether nothing behind it is left to decide what the record says
    return record.outstanding === 1
  }

  // A function which says what a refused write puts back
  const refuse = (key: string) => {
    // The writes settling on the record
    const record = records.get(key)

    // Nothing to put back on a record nobody wrote to, or where a write behind this one settles later and decides
    if (record === undefined || record.outstanding > 1) return null

    // Otherwise the last state the server is known to hold, where there is one
    return record.confirmed
  }

  // A function which counts a write as settled
  const settle = (key: string) => {
    // The writes settling on the record
    const record = records.get(key)

    // Nothing to settle on a record nobody wrote to
    if (record === undefined) return

    // One fewer outstanding
    record.outstanding -= 1

    // The record goes with the last of them, since there is no longer anything to put back
    if (record.outstanding === 0) records.delete(key)
  }

  // The tracker
  return { begin, holdBefore, land, refuse, settle }
}
