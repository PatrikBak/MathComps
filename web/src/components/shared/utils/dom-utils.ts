import type { MouseEvent } from 'react'

/**
 * Scrolls a textarea just far enough for its caret to be in its view, and not at all where it already is.
 *
 * A textarea says nothing about where its caret sits, so the depth is read off a copy of it holding the
 * text up to the caret: with no height of its own, the copy stands as tall as the caret is deep plus the
 * padding under the text.
 *
 * Use this after placing the cursor from code, which a browser does not always follow with its view.
 *
 * @param textarea - The textarea whose caret should show.
 */
export function ensureVisibleCaret(textarea: HTMLTextAreaElement): void {
  // Where the word under the caret ends, since a word cut short could wrap onto another line than the
  // whole one does
  const { value, selectionEnd } = textarea
  const wordEnd = selectionEnd + value.slice(selectionEnd).search(/\s|$/)

  // A copy of the textarea, holding its text up to the end of the caret's word
  const copy = textarea.cloneNode() as HTMLTextAreaElement
  copy.value = value.slice(0, wordEnd)

  // The copy goes by no id, the page already having an element of that one
  copy.removeAttribute('id')

  // The copy stands out of sight with no height of its own, exactly as wide as the original's text is
  // given
  Object.assign(copy.style, {
    position: 'absolute',
    visibility: 'hidden',
    boxSizing: 'border-box',
    border: '0',
    overflow: 'hidden',
    width: `${textarea.clientWidth}px`,
    height: '0',
    minHeight: '0',
  })

  // The copy laid out beside the textarea
  textarea.after(copy)

  // How deep the caret's line reaches, the padding under the text included
  const caretBottom = copy.scrollHeight

  // The copy gone again, once measured
  copy.remove()

  // The caret's line starts one line above where it ends, the padding around the text set aside
  const { lineHeight, paddingTop, paddingBottom } = getComputedStyle(textarea)
  const caretTop =
    caretBottom - parseFloat(lineHeight) - parseFloat(paddingTop) - parseFloat(paddingBottom)

  // A caret under the view comes up to its bottom edge
  if (caretBottom > textarea.scrollTop + textarea.clientHeight) {
    textarea.scrollTop = caretBottom - textarea.clientHeight
  }
  // A caret over the view comes down to its top edge
  else if (caretTop < textarea.scrollTop) {
    textarea.scrollTop = caretTop
  }
}

/**
 * Keeps the cursor where it is as a control is pressed. Goes on the control's `onMouseDown`.
 *
 * @param event - The press.
 */
export function preventFocusLoss(event: MouseEvent) {
  // The press moves no focus
  event.preventDefault()
}

/**
 * A data attribute one component stamps on an element and another finds the element by.
 */
export type DataAttribute<TName extends `data-${string}`> = {
  /** Stamps an element as standing for an id, spread onto it; stamps nothing for no id. */
  stamp: (id: string | null) => Partial<Record<TName, string>>
  /** Builds the selector matching the element standing for an id. */
  selectorFor: (id: string) => string
  /** The selector matching every element carrying the attribute, whatever it stands for. */
  anySelector: string
}

/**
 * Names a data attribute once, for the component stamping it and the one finding elements by it alike, so a
 * rename on either side can't leave the lookup matching nothing.
 *
 * @param name - The attribute's name.
 * @returns The ways to stamp it and to find by it, as described by {@link DataAttribute}.
 */
export function dataAttribute<TName extends `data-${string}`>(name: TName): DataAttribute<TName> {
  // A function which stamps the attribute carrying the id, or nothing for no id
  const stamp = (id: string | null) =>
    (id === null ? {} : { [name]: id }) as Partial<Record<TName, string>>

  // A function which builds the selector for the element carrying one id, escaped since an id is data
  // rather than selector syntax
  const selectorFor = (id: string) => `[${name}="${CSS.escape(id)}"]`

  // The selector matching every element carrying the attribute
  const anySelector = `[${name}]`

  // The ways to stamp the attribute and to find by it
  return { stamp, selectorFor, anySelector }
}
