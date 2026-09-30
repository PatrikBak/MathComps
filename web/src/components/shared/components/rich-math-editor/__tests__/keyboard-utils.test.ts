import { describe, expect, it } from 'vitest'

import { processKeyboardShortcut } from '../utils/keyboard-utils'
import { type EditContext } from '../utils/transforms'

/** The modifier keys a shortcut can be held with. */
type Modifiers = {
  /** Whether Ctrl is held, which is the modifier on Windows and Linux */
  ctrlKey?: boolean
  /** Whether Cmd is held, which is the modifier on a Mac */
  metaKey?: boolean
  /** Whether Shift is held */
  shiftKey?: boolean
  /** Whether Alt is held */
  altKey?: boolean
}

/**
 * Builds the keyboard event a shortcut is read off.
 *
 * @param key - The key pressed, as the browser names it.
 * @param modifiers - The modifiers held with the key, each released unless set.
 *
 * @returns The event.
 */
function press(key: string, modifiers: Modifiers = {}) {
  // The event, with every modifier released unless the caller says otherwise
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  } as React.KeyboardEvent<HTMLTextAreaElement>
}

/**
 * Builds the editor context a shortcut is applied to.
 *
 * @param fullText - Everything in the editor.
 * @param start - Where the selection starts.
 * @param end - Where the selection ends.
 *
 * @returns The context.
 */
function createContext(fullText: string, start: number, end: number = start): EditContext {
  // The context, with the selection read off the text
  return {
    fullText,
    start,
    end,
    selectedText: fullText.substring(start, end),
  }
}

/** The word `bound` selected, for a formatting shortcut to wrap. */
const context = createContext('a bound', 2, 7)

describe('processKeyboardShortcut', () => {
  describe('undo and redo', () => {
    it('reads Cmd+Z as undo and Cmd+Shift+Z as redo', () => {
      // Cmd+Z steps back
      expect(processKeyboardShortcut(press('z', { metaKey: true }), context).type).toBe('undo')

      // Shift on the same key steps forward
      expect(
        processKeyboardShortcut(press('z', { metaKey: true, shiftKey: true }), context).type
      ).toBe('redo')
    })

    it('reads Cmd+Y as redo', () => {
      // Cmd+Y steps forward
      expect(processKeyboardShortcut(press('y', { metaKey: true }), context).type).toBe('redo')
    })

    it('reads Ctrl the same as Cmd, in whichever case the key is named', () => {
      // Ctrl+Z steps back
      expect(processKeyboardShortcut(press('z', { ctrlKey: true }), context).type).toBe('undo')

      // And Ctrl+Shift+Z steps forward, the Shift naming the key in upper case
      expect(
        processKeyboardShortcut(press('Z', { ctrlKey: true, shiftKey: true }), context).type
      ).toBe('redo')
    })
  })

  describe('formatting', () => {
    it('wraps the selection on Cmd+B', () => {
      // The shortcut, read off the press
      const action = processKeyboardShortcut(press('b', { metaKey: true }), context)

      // Which wraps what was selected
      expect(action).toEqual({
        type: 'handled',
        result: expect.objectContaining({ newText: 'a **bound**' }),
      })
    })

    it('wraps the selection in code on Cmd+Shift+C, its key arriving in upper case', () => {
      // The uppercase key a shifted press reports
      const action = processKeyboardShortcut(press('C', { metaKey: true, shiftKey: true }), context)

      // Which is still the code shortcut
      expect(action).toEqual({
        type: 'handled',
        result: expect.objectContaining({ newText: 'a `bound`' }),
      })
    })

    it('leaves Cmd+C to the browser, since only Cmd+Shift+C belongs to the editor', () => {
      // Copy stays the browser's
      expect(processKeyboardShortcut(press('c', { metaKey: true }), context).type).toBe(
        'passthrough'
      )
    })

    it('leaves a formatting shortcut alone once Alt joins it', () => {
      // Cmd+Alt+B goes to the browser
      expect(
        processKeyboardShortcut(press('b', { metaKey: true, altKey: true }), context).type
      ).toBe('passthrough')
    })

    it('leaves a bare letter alone', () => {
      // A plain B is just typing
      expect(processKeyboardShortcut(press('b'), context).type).toBe('passthrough')
    })
  })

  describe('Enter', () => {
    it('carries the list marker to the next line', () => {
      // The cursor at the end of a list item
      const list = createContext('- first', 7)

      // Where Enter is pressed
      const action = processKeyboardShortcut(press('Enter'), list)

      // And the marker comes with it
      expect(action).toEqual({
        type: 'handled',
        result: expect.objectContaining({ newText: '- first\n- ' }),
      })
    })

    it('leaves Enter to the browser outside a list', () => {
      // Enter over a word that sits in no list
      expect(processKeyboardShortcut(press('Enter'), context).type).toBe('passthrough')
    })

    it('leaves Shift+Enter inside a list to the browser', () => {
      // The cursor at the end of a list item
      const list = createContext('- first', 7)

      // Where a shifted Enter breaks the line instead
      expect(processKeyboardShortcut(press('Enter', { shiftKey: true }), list).type).toBe(
        'passthrough'
      )
    })

    it('leaves Cmd+Enter inside a list to the send', () => {
      // The cursor at the end of a list item
      const list = createContext('- first', 7)

      // Where Cmd+Enter is left for the send
      expect(processKeyboardShortcut(press('Enter', { metaKey: true }), list).type).toBe(
        'passthrough'
      )
    })
  })
})
