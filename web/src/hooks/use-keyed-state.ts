'use client'

import { type Dispatch, type SetStateAction, useState } from 'react'

/**
 * State that belongs to one thing, and starts over the moment it belongs to another.
 *
 * The start-over lands during the render that swapped the key rather than in an effect after it, so the
 * outgoing thing's value is never drawn against the incoming one.
 *
 * @template TValue - What the state holds.
 * @param key - What the state belongs to, compared by identity.
 * @param initialValue - What it starts at, and goes back to whenever the key changes.
 * @returns The value and its setter, the way {@link useState} hands them back.
 */
export function useKeyedState<TValue>(
  key: unknown,
  initialValue: TValue
): [TValue, Dispatch<SetStateAction<TValue>>] {
  // The value itself
  const [value, setValue] = useState(initialValue)

  // What the value above belongs to
  const [keyOfValue, setKeyOfValue] = useState(key)

  // Another key means the value standing there was the last one's
  if (keyOfValue !== key) {
    // What it belongs to now
    setKeyOfValue(key)

    // And it, back at the start
    setValue(initialValue)
  }

  // The value and the way to change it
  return [value, setValue]
}
