import { useKeyedState } from './use-keyed-state'

/**
 * The options of {@link useKeyedToggle}.
 */
type UseKeyedToggleOptions = {
  /** What the reader's choice belongs to, compared by identity. */
  key: unknown
  /** The value while the reader has chosen nothing. */
  defaultValue: boolean
}

/**
 * A flag the reader flips, and the way to flip it.
 */
type UseKeyedToggleResult = {
  /** The reader's choice, or the default while they have made none. */
  value: boolean
  /** Flips the value from however it stands, which makes it the reader's choice. */
  toggle: () => void
}

/**
 * A flag the reader can flip over a default. Their choice holds until the key it belongs to changes, and the default
 * decides again from then until they choose anew.
 *
 * @param options - What the choice belongs to, and the value while there is none.
 * @returns The value, and the way to flip it.
 */
export function useKeyedToggle({ key, defaultValue }: UseKeyedToggleOptions): UseKeyedToggleResult {
  // What the reader chose, or null while they have chosen nothing, forgotten once the key changes
  const [choice, setChoice] = useKeyedState<boolean | null>(key, null)

  // The reader's say over the default
  const value = choice ?? defaultValue

  // A function which flips the value from however it stands
  const toggle = () => setChoice(!value)

  // The value, and the way to flip it
  return { value, toggle }
}
