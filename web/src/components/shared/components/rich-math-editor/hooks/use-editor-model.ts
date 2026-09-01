import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAttachLastMounted } from '@/hooks/use-attach-last-mounted'

import { ensureVisibleCaret } from '../../../utils/dom-utils'
import { type RichMathEditorInputAreaRef } from '../components/RichMathEditorInputArea'
import { type EditorConfig, EditorState } from '../model/EditorState'
import { HistoryManager } from '../model/HistoryManager'
import { processKeyboardShortcut } from '../utils/keyboard-utils'
import { type EditContext, type EditResult } from '../utils/transforms'

/**
 * Props for the {@link useEditorModel} hook.
 */
type UseEditorModelProps = {
  /** The current text value (controlled component pattern). */
  value: string
  /** Callback invoked when the text content changes. */
  onChange: (value: string) => void
  /** Callback when Enter is pressed (if provided, enables submit on Enter). */
  onSend?: () => void
  /** Whether a send is currently allowed; the editor's own validity gates on top of it. */
  canSend?: boolean
  /** Callback when Escape is pressed (if provided, enables cancel on Escape). */
  onCancel?: () => void
  /** Configuration for editor limits (max characters, images, etc.). */
  config: EditorConfig
}

/**
 * Return type for the {@link useEditorModel} hook.
 *
 * This is the "ViewModel" — a thin React binding over the pure model.
 * Data is accessed through the state object, while this interface
 * provides React-specific refs and event handlers.
 *
 * @see {@link EditorState} for the underlying state object
 * @see {@link HistoryManager} for undo/redo functionality
 */
export type EditorViewModel = {
  /**
   * The current editor state (immutable value object).
   */
  state: EditorState
  /**
   * Reference to the textarea element. Used for reading selection state
   * and ensuring a correct cursor position after programmatic edits.
   */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  /**
   * Reference to the input area component. Used to trigger file
   * picker dialogs for images and attachments.
   */
  inputAreaRef: React.RefObject<RichMathEditorInputAreaRef | null>
  /**
   * Attaches a textarea, as the callback ref each one is rendered with. Several of them can stand at
   * once, and this is what leaves {@link textareaRef} on one that is still on screen.
   */
  attachTextarea: (element: HTMLTextAreaElement) => () => void
  /**
   * Attaches an input area, doing for {@link inputAreaRef} what {@link attachTextarea} does for the
   * textarea.
   */
  attachInputArea: (element: RichMathEditorInputAreaRef) => () => void
  /**
   * Applies a text transformation and updates the editor state.
   *
   * The transformation receives the current {@link EditContext} (selection,
   * full text) and returns an {@link EditResult} with the new text and
   * cursor position. History is automatically updated.
   *
   * @param transformFunction - A pure function that transforms the text.
   *
   * @see {@link EditContext} for available context data
   * @see {@link EditResult} for the expected return format
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
  /**
   * Checks whether an undo operation is available.
   *
   * @returns `true` if there are previous states to undo to.
   */
  canUndo: () => boolean
  /**
   * Checks whether a redo operation is available.
   *
   * @returns `true` if there are undone states to redo.
   */
  canRedo: () => boolean
  /**
   * Opens the image file picker dialog.
   *
   * Selected images will be uploaded and inserted as markdown.
   */
  openImagePicker: () => void
  /**
   * Opens the attachment file picker dialog.
   *
   * Selected files will be uploaded and inserted as attachment links.
   */
  openAttachmentPicker: () => void
  /**
   * Handler for textarea onChange events. Updates the internal state
   * and notifies the parent via onChange.
   */
  handleChange: React.ChangeEventHandler<HTMLTextAreaElement>
  /**
   * Handler for textarea onKeyDown events. Processes keyboard shortcuts
   * and handles special cases like list continuation on Enter.
   */
  handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>
}

/**
 * React hook that creates and manages editor state.
 *
 * This hook is the primary way to use the {@link RichMathEditor} model.
 * Provides:
 * - Reactive state via {@link EditorState} (recreated when text changes)
 * - History management via {@link HistoryManager} (undo/redo)
 * - Event handlers for textarea integration
 * - Text transformation utilities
 */
export function useEditorModel({
  value,
  onChange,
  onSend,
  canSend = true,
  onCancel,
  config,
}: UseEditorModelProps): EditorViewModel {
  // Primary text state
  const [text, setTextInternal] = useState(value)

  // Create EditorState from current text — recreated when text changes
  const state = useMemo(() => new EditorState(text, config), [text, config])

  // History manager — stored in a ref since it's not tied to React's render cycle.
  // We only read from it when performing undo/redo, then update React state.
  const historyManagerRef = useRef<HistoryManager>(
    new HistoryManager({
      text: value,
      cursorPosition: 0,
      scrollTop: 0,
    })
  )

  // Textarea DOM reference — for reading selection and setting cursor
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // The callback ref each textarea is rendered with
  const attachTextarea = useAttachLastMounted(textareaRef)

  // Input area component reference — for triggering file pickers
  const inputAreaRef = useRef<RichMathEditorInputAreaRef>(null)

  // The callback ref each input area is rendered with
  const attachInputArea = useAttachLastMounted(inputAreaRef)

  // Sync internal state when controlled value changes from parent
  // This handles cases where the parent resets or programmatically changes the value
  useEffect(() => {
    if (value !== text) {
      setTextInternal(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only sync when value changes from parent
  }, [value])

  /**
   * Updates the text state, pushes to history, and notifies the parent.
   *
   * This is the primary way to update text — all other operations use this.
   *
   * @param newText - The new text content.
   * @param cursorPosition - Where to place the cursor after the update.
   * @param scrollTop - The scroll position to restore.
   */
  const updateText = useCallback(
    (newText: string, cursorPosition: number, scrollTop: number) => {
      // Update React state (triggers re-render and EditorState recreation)
      setTextInternal(newText)

      // Push to history for undo/redo
      historyManagerRef.current.push({
        text: newText,
        cursorPosition,
        scrollTop,
      })

      // Notify parent of the change
      onChange(newText)
    },
    [onChange]
  )

  /**
   * Creates an edit context from the current textarea selection.
   *
   * @returns An {@link EditContext} with selection info and full text.
   */
  const createEditContext = useCallback((): EditContext | null => {
    // Ensure we have a textarea element
    const textarea = textareaRef.current
    if (!textarea) return null

    // Extract its properties
    const selectionStart = textarea.selectionStart
    const selectionEnd = textarea.selectionEnd
    const selectedText = text.substring(selectionStart, selectionEnd)
    const fullText = text

    // Return the edit context
    return {
      start: selectionStart,
      end: selectionEnd,
      selectedText,
      fullText,
    }
  }, [text])

  /**
   * Restores cursor position and focus after a programmatic edit.
   *
   * @param cursorPosition - The position to place the cursor.
   * @param selectionEnd - Optional end position for text selection.
   * @param scrollTop - Optional scroll position to restore.
   */
  const restoreCursorPosition = useCallback(
    (cursorPosition: number, selectionEnd?: number, scrollTop?: number) => {
      // Use setTimeout to wait for React's re-render to complete
      setTimeout(() => {
        // Ensure we have a textarea element
        const textarea = textareaRef.current
        if (!textarea) return

        // Set cursor/selection position
        textarea.setSelectionRange(cursorPosition, selectionEnd ?? cursorPosition)

        // Ensure the caret is visible
        ensureVisibleCaret(textarea)

        // Restore scroll position if provided
        if (scrollTop !== undefined) {
          textarea.scrollTop = scrollTop
        }
      }, 0)
    },
    []
  )

  /**
   * Applies a text transformation function.
   *
   * @param transformFunction - Pure function that transforms the text.
   */
  const applyTransform = useCallback(
    (transformFunction: (context: EditContext) => EditResult) => {
      // Ensure we have a textarea element
      const textarea = textareaRef.current
      if (!textarea) return

      // Create context from current state
      const context = createEditContext()
      if (!context) return

      // Apply the transformation
      const result = transformFunction(context)

      // Update the text and history
      updateText(result.newText, result.cursorPosition, textarea.scrollTop)

      // Restore cursor position after React re-render
      restoreCursorPosition(result.cursorPosition, result.selectionEnd)
    },
    [createEditContext, updateText, restoreCursorPosition]
  )

  /**
   * Inserts text at the current cursor position.
   *
   * @param textToInsert - The text to insert.
   */
  const insertAtCursor = useCallback(
    (textToInsert: string) => {
      // Ensure we have a textarea element
      const textarea = textareaRef.current
      if (!textarea) return

      // Calculate the new text and cursor position
      const selectionStart = textarea.selectionStart
      const selectionEnd = textarea.selectionEnd
      const newText =
        text.substring(0, selectionStart) + textToInsert + text.substring(selectionEnd)
      const newCursorPosition = selectionStart + textToInsert.length

      // Update the text and history
      updateText(newText, newCursorPosition, textarea.scrollTop)

      // Restore cursor position after React re-render
      restoreCursorPosition(newCursorPosition)
    },
    [text, updateText, restoreCursorPosition]
  )

  /**
   * Undoes the last edit.
   */
  const undo = useCallback(() => {
    // Perform undo in the history manager
    const historyEntry = historyManagerRef.current?.undo()

    // If no history entry, do nothing
    if (!historyEntry) return

    // Update React state with the restored text
    setTextInternal(historyEntry.text)
    onChange(historyEntry.text)

    // Restore cursor and scroll position
    restoreCursorPosition(historyEntry.cursorPosition, undefined, historyEntry.scrollTop)
  }, [onChange, restoreCursorPosition])

  /**
   * Redoes a previously undone edit.
   */
  const redo = useCallback(() => {
    // Perform redo in the history manager
    const historyEntry = historyManagerRef.current?.redo()

    // If no history entry, do nothing
    if (!historyEntry) return

    // Update React state with the restored text
    setTextInternal(historyEntry.text)
    onChange(historyEntry.text)

    // Restore cursor and scroll position
    restoreCursorPosition(historyEntry.cursorPosition, undefined, historyEntry.scrollTop)
  }, [onChange, restoreCursorPosition])

  /**
   * Checks if undo is available.
   *
   * @returns `true` if there are previous states.
   */
  const canUndo = useCallback(() => {
    return historyManagerRef.current?.canUndo() ?? false
  }, [])

  /**
   * Checks if redo is available.
   *
   * @returns `true` if there are undone states.
   */
  const canRedo = useCallback(() => {
    return historyManagerRef.current?.canRedo() ?? false
  }, [])

  /**
   * Opens the image file picker.
   */
  const openImagePicker = useCallback(() => {
    inputAreaRef.current?.openImagePicker()
  }, [])

  /**
   * Opens the attachment file picker.
   */
  const openAttachmentPicker = useCallback(() => {
    inputAreaRef.current?.openAttachmentPicker()
  }, [])

  /**
   * Handles textarea onChange events.
   *
   * @param event - The React change event from the textarea.
   */
  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      // Get the new text and cursor position from the event
      const newText = event.target.value
      const cursorPosition = event.target.selectionStart
      const scrollTop = event.target.scrollTop

      // Update text with history tracking
      updateText(newText, cursorPosition, scrollTop)
    },
    [updateText]
  )

  /**
   * Handles textarea onKeyDown events. The magic happens in
   * the keyboard-util file
   *
   * @param event - The React keyboard event from the textarea.
   */
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      // Ensure we have a textarea element
      const textarea = textareaRef.current
      if (!textarea) return

      // Create context for the keyboard shortcut processor
      const context = createEditContext()
      if (!context) return

      // Process the keyboard shortcut
      const action = processKeyboardShortcut(event, context)

      // Handle the action based on its type
      switch (action.type) {
        // Transformation (bold, italic, etc.)
        case 'handled':
          event.preventDefault()
          applyTransform(() => action.result)
          return

        // Undo (Ctrl+Z)
        case 'undo': {
          event.preventDefault()
          undo()
          return
        }

        // Redo (Ctrl+Y or Ctrl+Shift+Z)
        case 'redo': {
          event.preventDefault()
          redo()
          return
        }

        // Let the event bubble up naturally (no action needed)
        case 'passthrough':
          break
      }

      // Handle Enter (submit) - only if not already handled and onSend is provided
      // Use Ctrl+Enter (or Cmd+Enter) for submission to allow Enter for new lines
      if (
        !event.defaultPrevented &&
        event.key === 'Enter' &&
        (event.ctrlKey || event.metaKey) &&
        onSend
      ) {
        // Submit only when the content is valid and a send is allowed
        if (state.isValid && canSend) {
          event.preventDefault()
          onSend()
        }
        return
      }

      // Handle Escape (cancel) - only if onCancel is provided
      if (!event.defaultPrevented && event.key === 'Escape' && onCancel) {
        event.preventDefault()
        onCancel()
        return
      }
    },
    [state.isValid, canSend, applyTransform, undo, redo, createEditContext, onSend, onCancel]
  )

  return {
    // State (immutable, derived from text)
    state,

    // DOM Refs
    textareaRef,
    inputAreaRef,
    attachTextarea,
    attachInputArea,

    // Text Operations
    applyTransform,
    insertAtCursor,

    // History Operations
    undo,
    redo,
    canUndo,
    canRedo,

    // File Pickers
    openImagePicker,
    openAttachmentPicker,

    // Event Handlers
    handleChange,
    handleKeyDown,
  }
}
