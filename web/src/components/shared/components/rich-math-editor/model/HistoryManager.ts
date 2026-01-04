/**
 * A single entry in the undo/redo history stack.
 *
 * Each entry captures the complete state needed to restore the editor
 * to a previous point in time.
 */
export type HistoryEntry = {
  /** The complete text content at this point in history. */
  text: string
  /** The cursor position (selection start) in the text. */
  cursorPosition: number
  /** The vertical scroll position of the editor textarea. */
  scrollTop: number
}

/** Default maximum number of history entries. */
const DEFAULT_MAX_HISTORY = 100

/** Default debounce time in milliseconds for grouping rapid changes. */
const DEFAULT_DEBOUNCE_MILLISECONDS = 500

/**
 * Configuration options for the {@link HistoryManager}.
 */
type HistoryManagerConfig = {
  /**
   * Maximum number of history entries to keep. When this limit is exceeded,
   * the oldest entries are removed. By default {@link DEFAULT_MAX_HISTORY}
   */
  maxHistory?: number
  /**
   * Debounce time in milliseconds for grouping rapid changes. If multiple
   * changes occur within this time window, only the last one creates a new
   * history entry. This prevents flooding the history with every keystroke.
   * By default {@link DEFAULT_DEBOUNCE_MILLISECONDS}
   */
  debounceMilliseconds?: number
}

/**
 * Manages undo/redo history for an editor.
 *
 * This class maintains a stack of {@link HistoryEntry} objects and provides
 * methods to navigate through them. It implements debouncing to avoid
 * creating excessive history entries during rapid typing.
 *
 * This class should be instantiated via `useRef` since it maintains internal
 * state that doesn't need to trigger React re-renders. The consuming hook
 * is responsible for updating React state when undo/redo is performed.
 *
 * @see {@link HistoryEntry} for the structure of each history entry
 * @see {@link HistoryManagerConfig} for configuration options
 */
export class HistoryManager {
  /** The stack of history entries, ordered from oldest to newest. */
  private historyStack: HistoryEntry[]

  /** The current position in the history stack (0-indexed). */
  private currentIndex: number

  /** Timestamp of the last push operation, used for debouncing. */
  private lastPushTimestamp: number

  /** Maximum number of entries to keep in the history stack. */
  private readonly maximumHistorySize: number

  /** Debounce window in milliseconds for grouping rapid changes. */
  private readonly debounceMilliseconds: number

  /**
   * Creates a new HistoryManager with an initial entry.
   *
   * @param initialEntry - The initial state to start the history with.
   *                       This is typically the initial text content.
   * @param configuration - Optional configuration for history limits and debouncing.
   */
  constructor(initialEntry: HistoryEntry, configuration: HistoryManagerConfig = {}) {
    // Initialize the history stack with the initial entry
    this.historyStack = [initialEntry]

    // Start at the first (and only) entry
    this.currentIndex = 0

    // No pushes have happened yet
    this.lastPushTimestamp = 0

    // Apply configuration with defaults
    this.maximumHistorySize = configuration.maxHistory ?? DEFAULT_MAX_HISTORY
    this.debounceMilliseconds = configuration.debounceMilliseconds ?? DEFAULT_DEBOUNCE_MILLISECONDS
  }

  /**
   * Pushes a new entry onto the history stack.
   *
   * This method implements several optimizations:
   * 1. **No-op for identical text**: If the text hasn't changed, only cursor/scroll
   *    positions are updated on the current entry.
   * 2. **Debouncing**: Rapid changes within {@link debounceMilliseconds} update
   *    the current entry instead of creating new ones.
   * 3. **Truncation**: If we're not at the end of the stack (after undo),
   *    future entries are discarded before adding the new one.
   * 4. **Size limiting**: If the stack exceeds {@link maximumHistorySize},
   *    the oldest entry is removed.
   *
   * @param entry - The new history entry to add.
   */
  push(entry: HistoryEntry): void {
    // Get current time to check for debouncing delay
    const currentTimestamp = Date.now()

    // Get the current entry for comparison
    const currentEntry = this.historyStack[this.currentIndex]

    // (1) Identical text handling: If text hasn't changed, just update cursor and scroll
    if (currentEntry?.text === entry.text) {
      currentEntry.cursorPosition = entry.cursorPosition
      currentEntry.scrollTop = entry.scrollTop
      return
    }

    // Calculate time since last push for debouncing
    const timeSinceLastPush = currentTimestamp - this.lastPushTimestamp
    const isWithinDebounceWindow = timeSinceLastPush < this.debounceMilliseconds
    const isAtEndOfHistory = this.currentIndex === this.historyStack.length - 1

    // (2) Debouncing: Within debounce window, update current entry
    if (isWithinDebounceWindow && isAtEndOfHistory) {
      this.historyStack[this.currentIndex] = entry
      this.lastPushTimestamp = currentTimestamp
      return
    }

    // (3) Truncation: Remove any "future" entries if we're not at the end
    // (This happens after using undo and then making a new edit)
    this.historyStack = this.historyStack.slice(0, this.currentIndex + 1)

    // Add the new entry to the end of the stack
    this.historyStack.push(entry)

    // (4) Size limiting: Remove oldest entry if we exceed the maximum
    if (this.historyStack.length > this.maximumHistorySize) {
      // Just shift, don't increment currentIndex since we removed from the front
      this.historyStack.shift()
    }
    // If there's no size limit exceeded...
    else {
      // Move the current index to the new entry
      this.currentIndex = this.historyStack.length - 1
    }

    // Update timestamp for debouncing
    this.lastPushTimestamp = currentTimestamp
  }

  /**
   * Moves back one step in the history.
   *
   * @returns The previous {@link HistoryEntry} if available, or `null` if
   *          already at the beginning of the history.
   */
  undo(): HistoryEntry | null {
    // Check if we can go back
    if (!this.canUndo()) {
      return null
    }

    // Move back one step
    this.currentIndex -= 1

    // Return the entry at the new position
    return this.historyStack[this.currentIndex]
  }

  /**
   * Moves forward one step in the history.
   *
   * @returns The next {@link HistoryEntry} if available, or `null` if
   *          already at the end of the history.
   */
  redo(): HistoryEntry | null {
    // Check if we can go forward
    if (!this.canRedo()) {
      return null
    }

    // Move forward one step
    this.currentIndex += 1

    // Return the entry at the new position
    return this.historyStack[this.currentIndex]
  }

  /**
   * Checks whether an undo operation is possible.
   *
   * @returns `true` if there are previous entries to go back to,
   *          `false` if at the beginning of the history.
   */
  canUndo(): boolean {
    return this.currentIndex > 0
  }

  /**
   * Checks whether a redo operation is possible.
   *
   * @returns `true` if there are future entries to go forward to,
   *          `false` if at the end of the history.
   */
  canRedo(): boolean {
    return this.currentIndex < this.historyStack.length - 1
  }

  /**
   * Returns the current history entry without modifying the stack.
   *
   * @returns The {@link HistoryEntry} at the current position.
   */
  current(): HistoryEntry {
    return this.historyStack[this.currentIndex]
  }
}
