import { useCallback, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { useAttachLastMounted } from '@/hooks/use-attach-last-mounted'

import { ensureVisibleCaret } from '../../../utils/dom-utils'
import { type EditorConfig, EditorState } from '../model/EditorState'
import { HistoryManager } from '../model/HistoryManager'
import { type EditContext, type EditResult } from '../utils/transforms'

/**
 * Options for the {@link useEditorText} hook.
 */
type UseEditorTextOptions = {
  /** The text, which the parent owns. */
  value: string
  /** Callback invoked when the text content changes. */
  onChange: (value: string) => void
  /** Whether the parent allows a send now. */
  canSend: boolean
  /** The limits the text is held to. */
  config: EditorConfig
}

/**
 * Return type for the {@link useEditorText} hook.
 */
export type UseEditorTextResult = {
  /** What the text measures up to against its limits. */
  state: EditorState
  /**
   * Whether the draft can be sent now: {@link EditorState.isValid} holds, and the parent allows a
   * send.
   */
  isSendable: boolean
  /** The textarea on screen, null while none is. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /**
   * Attaches a textarea, as the callback ref each one is rendered with. Several of them can stand at
   * once, and this is what leaves {@link UseEditorTextResult.textareaRef} on one that is still on screen.
   * A textarea mounting with text in it has its cursor at the end of that text as the reader first
   * enters it.
   */
  attachTextarea: (element: HTMLTextAreaElement) => () => void
  /**
   * Creates an edit context from the current textarea selection.
   *
   * @returns An {@link EditContext} with selection info and full text, or null while no textarea is on
   * screen.
   */
  createEditContext: () => EditContext | null
  /**
   * Puts an edit made in code into the text: recorded for undo, handed to the parent, and on screen with
   * its selection placed.
   *
   * @param edit - The new text and the selection it leaves.
   */
  applyEdit: (edit: EditResult) => void
  /**
   * Applies a text transformation where the selection stands, recorded for undo like any edit, and
   * leaves the cursor in the text.
   *
   * @param transformFunction - A pure function that transforms the text.
   */
  applyTransform: (transformFunction: (context: EditContext) => EditResult) => void
  /**
   * Inserts text at the current cursor position.
   *
   * If there's a selection, it will be replaced by the inserted text.
   * The cursor is positioned at the end of the inserted text.
   *
   * @param textToInsert - The text to insert at the cursor.
   */
  insertAtCursor: (textToInsert: string) => void
  /**
   * Undoes the last edit, restoring the previous state.
   *
   * Does nothing if at the beginning of the history.
   * Cursor position and scroll are restored along with the text.
   */
  undo: () => void
  /**
   * Redoes a previously undone edit.
   *
   * Does nothing if at the end of the history (no undone edits).
   * Cursor position and scroll are restored along with the text.
   */
  redo: () => void
  /** Handles the reader's typing: records the edit and hands the new text to the parent. */
  handleChange: React.ChangeEventHandler<HTMLTextAreaElement>
}

/**
 * An editor's text: what it measures up to against its limits, the edits it takes, and their undo
 * history. The parent owns the text itself, so every edit reaches it through its onChange.
 *
 * @param options - The text, where its edits go, the limits it is held to, and whether the parent
 *   allows a send.
 *
 * @returns The text's state and the ways of editing it.
 */
export function useEditorText({
  value,
  onChange,
  canSend,
  config,
}: UseEditorTextOptions): UseEditorTextResult {
  // What the text measures up to
  const state = useMemo(() => new EditorState(value, config), [value, config])

  // Whether a send may go now
  const isSendable = state.isValid && canSend

  // The undo history, starting from the text the parent hands over
  const [history, setHistory] = useState(
    () => new HistoryManager({ text: value, cursorPosition: value.length, scrollTop: 0 })
  )

  // Text the parent sets itself starts a fresh history, which undo does not step back past
  if (history.current().text !== value) {
    setHistory(new HistoryManager({ text: value, cursorPosition: value.length, scrollTop: 0 }))
  }

  // The textarea on screen
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // A function which attaches a textarea, keeping the ref on whichever one is still on screen
  const attachLastMounted = useAttachLastMounted(textareaRef)

  /**
   * Attaches a textarea as it mounts.
   *
   * @param element - The textarea that mounted.
   *
   * @returns What React runs once the attached textarea goes.
   */
  const attachTextarea = useCallback(
    (element: HTMLTextAreaElement) => {
      // A function which moves a caret still at the very start, where an untouched textarea has it, to
      // the end of the text
      const startAtEnd = () => {
        // A caret some edit or the reader already placed stays where it is
        if (element.selectionStart !== 0 || element.selectionEnd !== 0) return

        // The end of the text
        element.setSelectionRange(element.value.length, element.value.length)
      }

      // Placing a selection hands a textarea the cursor in Safari, so one that mounts without the cursor
      // waits for the reader to enter it
      if (document.activeElement === element) {
        startAtEnd()
      } else {
        element.addEventListener('focus', startAtEnd, { once: true })
      }

      // The textarea the edits reach from here
      const detach = attachLastMounted(element)

      // What React runs once the attached textarea goes
      return () => {
        // A textarea never entered is no longer waiting to be
        element.removeEventListener('focus', startAtEnd)

        // And the edits reach whichever textarea is left
        detach()
      }
    },
    [attachLastMounted]
  )

  /**
   * Puts a text on screen with its selection placed and its view set. The parent's round trip is
   * committed at once, since a selection can only be placed in text that is already there.
   *
   * @param newText - The text to show.
   * @param selectionStart - Where the selection starts.
   * @param selectionEnd - Where the selection ends, the same place for a bare cursor.
   * @param scrollTop - How far down the view stands.
   */
  const showText = useCallback(
    (newText: string, selectionStart: number, selectionEnd: number, scrollTop: number) => {
      // The textarea on screen, where there is one
      const textarea = textareaRef.current
      if (!textarea) return

      // The parent takes the text and hands it straight back
      flushSync(() => onChange(newText))

      // The selection goes where the edit left it
      textarea.setSelectionRange(selectionStart, selectionEnd)

      // And the view where it stood
      textarea.scrollTop = scrollTop

      // Moved only as far as showing the caret takes
      ensureVisibleCaret(textarea)
    },
    [onChange]
  )

  /**
   * Creates an edit context from the current textarea selection.
   *
   * @returns An {@link EditContext} with selection info and full text, or null while no textarea is on
   * screen.
   */
  const createEditContext = useCallback((): EditContext | null => {
    // The textarea on screen, where there is one
    const textarea = textareaRef.current
    if (!textarea) return null

    // The selection and the text it sits in, both as the textarea holds them now
    const { selectionStart, selectionEnd, value: fullText } = textarea

    // Return the edit context
    return {
      start: selectionStart,
      end: selectionEnd,
      selectedText: fullText.substring(selectionStart, selectionEnd),
      fullText,
    }
  }, [])

  /**
   * Puts an edit made in code into the text.
   *
   * @param edit - The new text and the selection it leaves.
   */
  const applyEdit = useCallback(
    (edit: EditResult) => {
      // The textarea on screen, where there is one
      const textarea = textareaRef.current
      if (!textarea) return

      // How far down the view stands before the edit
      const scrollTop = textarea.scrollTop

      // The edit, recorded for undo
      history.push({ text: edit.newText, cursorPosition: edit.cursorPosition, scrollTop })

      // The new text, with the selection the edit leaves
      showText(
        edit.newText,
        edit.cursorPosition,
        edit.selectionEnd ?? edit.cursorPosition,
        scrollTop
      )
    },
    [history, showText]
  )

  /**
   * Applies a text transformation function.
   *
   * @param transformFunction - Pure function that transforms the text.
   */
  const applyTransform = useCallback(
    (transformFunction: (context: EditContext) => EditResult) => {
      // The selection and the text it sits in, where a textarea is on screen to hold them
      const context = createEditContext()
      if (!context) return

      // The edit the transformation makes
      const edit = transformFunction(context)

      // The edit lands in the text
      applyEdit(edit)

      // And the cursor comes back into the textarea
      textareaRef.current?.focus()
    },
    [createEditContext, applyEdit]
  )

  /**
   * Inserts text at the current cursor position.
   *
   * @param textToInsert - The text to insert.
   */
  const insertAtCursor = useCallback(
    (textToInsert: string) => {
      // The text in place of the selection, with the cursor after it
      applyTransform(({ start, end, fullText }) => ({
        newText: fullText.substring(0, start) + textToInsert + fullText.substring(end),
        cursorPosition: start + textToInsert.length,
      }))
    },
    [applyTransform]
  )

  /**
   * Undoes the last edit.
   */
  const undo = useCallback(() => {
    // One edit back in the history
    const historyEntry = history.undo()

    // Nothing further back to restore
    if (!historyEntry) return

    // The restored text, with the cursor and the view it was left with
    showText(
      historyEntry.text,
      historyEntry.cursorPosition,
      historyEntry.cursorPosition,
      historyEntry.scrollTop
    )
  }, [history, showText])

  /**
   * Redoes a previously undone edit.
   */
  const redo = useCallback(() => {
    // One edit forward in the history
    const historyEntry = history.redo()

    // Nothing further forward to restore
    if (!historyEntry) return

    // The restored text, with the cursor and the view it was left with
    showText(
      historyEntry.text,
      historyEntry.cursorPosition,
      historyEntry.cursorPosition,
      historyEntry.scrollTop
    )
  }, [history, showText])

  /**
   * Handles the reader's typing.
   *
   * @param event - The change the typing made to the textarea.
   */
  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      // What the reader typed, with the cursor and the view it left, recorded for undo
      history.push({
        text: event.target.value,
        cursorPosition: event.target.selectionStart,
        scrollTop: event.target.scrollTop,
      })

      // And the new text goes to the parent
      onChange(event.target.value)
    },
    [history, onChange]
  )

  // The text's state and the ways of editing it
  return {
    state,
    isSendable,
    textareaRef,
    attachTextarea,
    createEditContext,
    applyEdit,
    applyTransform,
    insertAtCursor,
    undo,
    redo,
    handleChange,
  }
}
