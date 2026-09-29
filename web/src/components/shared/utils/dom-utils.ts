/**
 * Forces the browser to scroll the textarea so the caret is visible.
 *
 * This works by blurring and immediately re-focusing the element,
 * which triggers the browser's native scroll-to-caret behavior.
 *
 * Use this after programmatically changing the cursor position
 * (e.g., after inserting text or restoring from history) to ensure
 * the user can see where they're typing.
 *
 * @param textarea - The textarea element to affect.
 */
export function ensureVisibleCaret(textarea: HTMLTextAreaElement): void {
  textarea.blur()
  textarea.focus()
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

  // The ways to stamp it and to find by it
  return { stamp, selectorFor, anySelector }
}
