import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type HistoryEntry, HistoryManager } from '../model/HistoryManager'

describe('HistoryManager', () => {
  // The history each case runs against
  let historyManager: HistoryManager

  // A function which builds an entry, its cursor at the start and its scroll at the top unless given
  const createEntry = (text: string, cursorPosition = 0, scrollTop = 0): HistoryEntry => ({
    text,
    cursorPosition,
    scrollTop,
  })

  beforeEach(() => {
    // A history holding only the initial entry, every edit landing as its own step
    historyManager = new HistoryManager(createEntry('initial'), { debounceMilliseconds: 0 })
  })

  describe('initial state', () => {
    it('should start with the initial entry', () => {
      // The entry the history sits on
      const currentEntry = historyManager.current()

      // Which is the one the history was created with
      expect(currentEntry.text).toBe('initial')
    })

    it('should not allow undo at the beginning', () => {
      // Nothing behind the initial entry
      expect(historyManager.canUndo()).toBe(false)

      // So an undo hands back nothing
      expect(historyManager.undo()).toBeNull()
    })

    it('should not allow redo at the beginning', () => {
      // Nothing ahead of the initial entry
      expect(historyManager.canRedo()).toBe(false)

      // So a redo hands back nothing
      expect(historyManager.redo()).toBeNull()
    })
  })

  describe('push', () => {
    it('should add a new entry to history', () => {
      // An edit that changes the text
      historyManager.push(createEntry('second'))

      // The history sits on the edit
      expect(historyManager.current().text).toBe('second')

      // With the initial entry now there to undo to
      expect(historyManager.canUndo()).toBe(true)
    })

    it('should update cursor and scroll without new entry when text is unchanged', () => {
      // The same text, with the cursor and scroll moved
      historyManager.push(createEntry('initial', 5, 100))

      // The current entry takes the new cursor and scroll
      expect(historyManager.current().cursorPosition).toBe(5)
      expect(historyManager.current().scrollTop).toBe(100)

      // And no step was added to undo
      expect(historyManager.canUndo()).toBe(false)
    })

    it('should end on the last of several entries', () => {
      // Three edits, one after another
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))
      historyManager.push(createEntry('fourth'))

      // The history sits on the last of them
      expect(historyManager.current().text).toBe('fourth')
    })
  })

  describe('undo', () => {
    it('should return the previous entry', () => {
      // One edit on top of the initial entry
      historyManager.push(createEntry('second'))

      // Undo the edit
      const undoneEntry = historyManager.undo()

      // The undo hands back the initial entry
      expect(undoneEntry?.text).toBe('initial')

      // And the history sits on the initial entry again
      expect(historyManager.current().text).toBe('initial')
    })

    it('should undo multiple steps', () => {
      // Three edits on top of the initial entry
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))
      historyManager.push(createEntry('fourth'))

      // Back to the third edit
      historyManager.undo()

      // Back to the second
      historyManager.undo()

      // And back to the initial entry
      const entry = historyManager.undo()

      // The last undo lands on the initial entry
      expect(entry?.text).toBe('initial')

      // With nothing behind the initial entry
      expect(historyManager.canUndo()).toBe(false)
    })

    it('should restore the cursor position the earlier entry held', () => {
      // An edit that leaves the cursor and scroll further down
      historyManager.push(createEntry('second', 10, 50))

      // Undo the edit
      const undoneEntry = historyManager.undo()

      // The cursor where the initial entry left it
      expect(undoneEntry?.cursorPosition).toBe(0)
    })
  })

  describe('redo', () => {
    it('should return the next entry after undo', () => {
      // One edit on top of the initial entry
      historyManager.push(createEntry('second'))

      // Undone straight away
      historyManager.undo()

      // Redo the edit
      const redoneEntry = historyManager.redo()

      // The redo hands back the edit
      expect(redoneEntry?.text).toBe('second')

      // And the history sits on the edit again
      expect(historyManager.current().text).toBe('second')
    })

    it('should redo multiple steps', () => {
      // Two edits on top of the initial entry
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))

      // Back to the second
      historyManager.undo()

      // Back to the initial entry
      historyManager.undo()

      // Forward to the second again
      historyManager.redo()

      // And forward to the third
      const entry = historyManager.redo()

      // The last redo lands on the latest edit
      expect(entry?.text).toBe('third')

      // With nothing ahead of the latest edit
      expect(historyManager.canRedo()).toBe(false)
    })

    it('should return null when at the end', () => {
      // One edit, nothing undone
      historyManager.push(createEntry('second'))

      // Nothing ahead of the edit to redo
      expect(historyManager.redo()).toBeNull()
    })
  })

  describe('history truncation after undo + new edit', () => {
    it('should truncate future history when pushing after undo', () => {
      // Two edits on top of the initial entry
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))

      // Back to the second
      historyManager.undo()

      // A new edit made from the second
      historyManager.push(createEntry('new branch'))

      // The third edit is gone, leaving nothing to redo
      expect(historyManager.canRedo()).toBe(false)

      // And the history sits on the new edit
      expect(historyManager.current().text).toBe('new branch')
    })

    it('should allow undo to entries before the branch point', () => {
      // Two edits on top of the initial entry
      historyManager.push(createEntry('second'))
      historyManager.push(createEntry('third'))

      // Back to the second
      historyManager.undo()

      // A new edit made from the second
      historyManager.push(createEntry('new branch'))

      // An undo lands on the second
      expect(historyManager.undo()?.text).toBe('second')

      // And then on the initial entry
      expect(historyManager.undo()?.text).toBe('initial')
    })
  })

  describe('debouncing', () => {
    beforeEach(() => {
      // A clock each case moves by hand
      vi.useFakeTimers()
    })

    afterEach(() => {
      // The real clock back for the cases outside this group
      vi.useRealTimers()
    })

    it('should group rapid changes within debounce window', () => {
      // A history that folds edits made within half a second of each other
      const debouncedManager = new HistoryManager(createEntry('initial'), {
        debounceMilliseconds: 500,
      })

      // The first edit
      debouncedManager.push(createEntry('a'))

      // A tenth of a second passes
      vi.advanceTimersByTime(100)

      // The second edit
      debouncedManager.push(createEntry('ab'))

      // Another tenth of a second
      vi.advanceTimersByTime(100)

      // And the third
      debouncedManager.push(createEntry('abc'))

      // The history sits on the last edit, which took the place of the two before it
      expect(debouncedManager.current().text).toBe('abc')

      // A single undo reaches the initial entry, with nothing behind it
      expect(debouncedManager.undo()?.text).toBe('initial')
      expect(debouncedManager.canUndo()).toBe(false)
    })

    it('should create new entry after debounce window expires', () => {
      // A history that folds edits made within half a second of each other
      const debouncedManager = new HistoryManager(createEntry('initial'), {
        debounceMilliseconds: 500,
      })

      // The first edit
      debouncedManager.push(createEntry('first'))

      // A pause longer than the window
      vi.advanceTimersByTime(600)

      // The second edit, after the pause
      debouncedManager.push(createEntry('second'))

      // Each edit is a step of its own to undo
      expect(debouncedManager.undo()?.text).toBe('first')
      expect(debouncedManager.undo()?.text).toBe('initial')
    })
  })

  describe('max history limit', () => {
    it('should remove oldest entries when limit is exceeded', () => {
      // A history that keeps three entries at most
      const limitedManager = new HistoryManager(createEntry('initial'), {
        maxHistory: 3,
        debounceMilliseconds: 0,
      })

      // Three edits on top of the initial entry, one more than the history keeps
      limitedManager.push(createEntry('second'))
      limitedManager.push(createEntry('third'))
      limitedManager.push(createEntry('fourth'))

      // The history sits on the latest edit
      expect(limitedManager.current().text).toBe('fourth')

      // Undoing walks back through the edits the history kept
      expect(limitedManager.undo()?.text).toBe('third')
      expect(limitedManager.undo()?.text).toBe('second')

      // And stops at the second, the initial entry dropped by the limit
      expect(limitedManager.undo()).toBeNull()
    })
  })
})
