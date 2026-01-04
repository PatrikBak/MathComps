import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type HistoryEntry, HistoryManager } from '../model/HistoryManager'

describe('HistoryManager', () => {
  /** The history manager instance under test. */
  let historyManager: HistoryManager

  /** Creates a simple history entry for testing. */
  const createEntry = (text: string, cursorPosition = 0, scrollTop = 0): HistoryEntry => ({
    text,
    cursorPosition,
    scrollTop,
  })

  beforeEach(() => {
    // Create a fresh history manager with debouncing disabled for predictable tests
    historyManager = new HistoryManager(createEntry('initial'), { debounceMilliseconds: 0 })
  })

  describe('initial state', () => {
    it('should start with the initial entry', () => {
      const currentEntry = historyManager.current()
      expect(currentEntry.text).toBe('initial')
    })

    it('should not allow undo at the beginning', () => {
      expect(historyManager.canUndo()).toBe(false)
      expect(historyManager.undo()).toBeNull()
    })

    it('should not allow redo at the beginning', () => {
      expect(historyManager.canRedo()).toBe(false)
      expect(historyManager.redo()).toBeNull()
    })
  })

  describe('push', () => {
    it('should add a new entry to history', () => {
      historyManager.push(createEntry('second'))

      expect(historyManager.current().text).toBe('second')
      expect(historyManager.canUndo()).toBe(true)
    })

    it('should update cursor and scroll without new entry when text is unchanged', () => {
      historyManager.push(createEntry('initial', 5, 100))

      // Should have updated the existing entry, not added a new one
      expect(historyManager.current().cursorPosition).toBe(5)
      expect(historyManager.current().scrollTop).toBe(100)

      // Should still not be able to undo (no new entry was added)
      expect(historyManager.canUndo()).toBe(false)
    })

    it('should add multiple entries to history', () => {
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))
      historyManager.push(createEntry('fourth'))

      expect(historyManager.current().text).toBe('fourth')
    })
  })

  describe('undo', () => {
    it('should return the previous entry', () => {
      historyManager.push(createEntry('second'))

      const undoneEntry = historyManager.undo()

      expect(undoneEntry?.text).toBe('initial')
      expect(historyManager.current().text).toBe('initial')
    })

    it('should undo multiple steps', () => {
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))
      historyManager.push(createEntry('fourth'))

      historyManager.undo() // -> third
      historyManager.undo() // -> second
      const entry = historyManager.undo() // -> initial

      expect(entry?.text).toBe('initial')
      expect(historyManager.canUndo()).toBe(false)
    })

    it('should return null when at the beginning', () => {
      expect(historyManager.undo()).toBeNull()
    })

    it('should preserve cursor position in undo', () => {
      historyManager.push(createEntry('second', 10, 50))

      const undoneEntry = historyManager.undo()

      expect(undoneEntry?.cursorPosition).toBe(0) // From initial entry
    })
  })

  describe('redo', () => {
    it('should return the next entry after undo', () => {
      historyManager.push(createEntry('second'))
      historyManager.undo()

      const redoneEntry = historyManager.redo()

      expect(redoneEntry?.text).toBe('second')
      expect(historyManager.current().text).toBe('second')
    })

    it('should redo multiple steps', () => {
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))

      historyManager.undo() // -> second
      historyManager.undo() // -> initial

      historyManager.redo() // -> second
      const entry = historyManager.redo() // -> third

      expect(entry?.text).toBe('third')
      expect(historyManager.canRedo()).toBe(false)
    })

    it('should return null when at the end', () => {
      historyManager.push(createEntry('second'))

      expect(historyManager.redo()).toBeNull()
    })
  })

  describe('history truncation after undo + new edit', () => {
    it('should truncate future history when pushing after undo', () => {
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))

      historyManager.undo() // -> second
      historyManager.push(createEntry('new branch'))

      // Redo should not be available (third was truncated)
      expect(historyManager.canRedo()).toBe(false)
      expect(historyManager.current().text).toBe('new branch')
    })

    it('should allow undo to entries before the branch point', () => {
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))

      historyManager.undo() // -> second
      historyManager.push(createEntry('new branch'))

      // Should be able to undo to 'second'
      expect(historyManager.undo()?.text).toBe('second')

      // And then to 'initial'
      expect(historyManager.undo()?.text).toBe('initial')
    })
  })

  describe('debouncing', () => {
    beforeEach(() => {
      // Use fake timers for debounce testing
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should group rapid changes within debounce window', () => {
      // Create manager with 500ms debounce
      const debouncedManager = new HistoryManager(createEntry('initial'), {
        debounceMilliseconds: 500,
      })

      // Push rapidly within debounce window
      debouncedManager.push(createEntry('a'))
      vi.advanceTimersByTime(100)
      debouncedManager.push(createEntry('ab'))
      vi.advanceTimersByTime(100)
      debouncedManager.push(createEntry('abc'))

      // Should only have 2 entries: initial + one debounced entry
      // (the 'abc' replaces the previous entries because of debouncing)
      expect(debouncedManager.current().text).toBe('abc')

      // Should only be able to undo once (to initial)
      expect(debouncedManager.undo()?.text).toBe('initial')
      expect(debouncedManager.canUndo()).toBe(false)
    })

    it('should create new entry after debounce window expires', () => {
      const debouncedManager = new HistoryManager(createEntry('initial'), {
        debounceMilliseconds: 500,
      })

      debouncedManager.push(createEntry('first'))

      // Wait for debounce window to expire
      vi.advanceTimersByTime(600)

      debouncedManager.push(createEntry('second'))

      // Should have 3 entries: initial, first, second
      expect(debouncedManager.undo()?.text).toBe('first')
      expect(debouncedManager.undo()?.text).toBe('initial')
    })
  })

  describe('max history limit', () => {
    it('should remove oldest entries when limit is exceeded', () => {
      const limitedManager = new HistoryManager(createEntry('initial'), {
        maxHistory: 3,
        debounceMilliseconds: 0,
      })

      limitedManager.push(createEntry('second'))
      limitedManager.push(createEntry('third'))
      limitedManager.push(createEntry('fourth'))

      // 'initial' should have been removed
      expect(limitedManager.current().text).toBe('fourth')
      expect(limitedManager.undo()?.text).toBe('third')
      expect(limitedManager.undo()?.text).toBe('second')
      expect(limitedManager.undo()).toBeNull() // 'initial' was removed
    })
  })

  describe('canUndo and canRedo', () => {
    it('canUndo should return true when there are previous entries', () => {
      expect(historyManager.canUndo()).toBe(false)

      historyManager.push(createEntry('second'))

      expect(historyManager.canUndo()).toBe(true)
    })

    it('canRedo should return true after undo', () => {
      historyManager.push(createEntry('second'))

      expect(historyManager.canRedo()).toBe(false)

      historyManager.undo()

      expect(historyManager.canRedo()).toBe(true)
    })

    it('canRedo should return false after new push', () => {
      historyManager.push(createEntry('second'))
      historyManager.undo()

      expect(historyManager.canRedo()).toBe(true)

      historyManager.push(createEntry('third'))

      expect(historyManager.canRedo()).toBe(false)
    })
  })
})
