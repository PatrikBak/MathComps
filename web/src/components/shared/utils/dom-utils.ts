import type { MouseEvent } from 'react'

import { focusForReader } from './focus-utils'

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

  // The textarea's view as it stands
  const view = { scrollTop: textarea.scrollTop, viewHeight: textarea.clientHeight }

  // Scrolled to show the caret's line, flush with the view's edge where the line was out of view
  textarea.scrollTop = scrollTopShowing(view, { top: caretTop, bottom: caretBottom }, 0)
}

/**
 * The view of a scrolling box.
 */
export type ScrollView = {
  /** How far the box is scrolled down, in px. */
  scrollTop: number
  /** How tall the part of the content the box shows is, in px. */
  viewHeight: number
}

/**
 * How far down a scrolling box's content a stretch of it starts and ends, in px.
 */
export type DepthSpan = {
  /** The depth of the stretch's top. */
  top: number
  /** The depth of the stretch's bottom. */
  bottom: number
}

/**
 * Where an element stands in a scrolling box's content, however far the box is scrolled.
 *
 * @param element - The element, inside the box.
 * @param box - The scrolling box.
 * @returns How far down the box's content the element's top and bottom stand.
 */
export function depthSpanOf(element: Element, box: Element): DepthSpan {
  // Where the box's content starts on screen, under its top border
  const contentTop = box.getBoundingClientRect().top + box.clientTop - box.scrollTop

  // The element on screen
  const elementBox = element.getBoundingClientRect()

  // The element's edges down the box's content
  return { top: elementBox.top - contentTop, bottom: elementBox.bottom - contentTop }
}

/**
 * Where a box scrolls to show a stretch of its content. The box moves only for a stretch reaching into the room by
 * an edge of its view, or past that edge, and then just far enough to give the stretch that room back.
 *
 * @param view - The box's view as it stands.
 * @param stretch - The stretch to show.
 * @param room - How much room is wanted between the stretch and the view's edge, in px.
 * @returns The scroll position showing the stretch.
 */
export function scrollTopShowing(view: ScrollView, stretch: DepthSpan, room: number): number {
  // The most of the view the room takes at either edge, so a short view still has a middle to keep the stretch in
  const MAX_ROOM_SHARE = 1 / 3

  // The room, cut to the most of the view it may take
  const margin = Math.min(room, view.viewHeight * MAX_ROOM_SHARE)

  // A stretch reaching into the room under the top edge, or above it, comes down out of the room
  if (stretch.top < view.scrollTop + margin) return Math.max(0, stretch.top - margin)

  // A stretch reaching into the room over the bottom edge, or under it, comes up out of the room
  if (stretch.bottom > view.scrollTop + view.viewHeight - margin) {
    return stretch.bottom - view.viewHeight + margin
  }

  // A stretch clear of the room at both edges leaves the view where it is
  return view.scrollTop
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
  /** The attribute's name. */
  name: TName
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
 * @returns Its name and the ways to stamp it and to find by it, as described by {@link DataAttribute}.
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

  // The attribute's name, and the ways to stamp it and to find by it
  return { name, stamp, selectorFor, anySelector }
}

/**
 * The first element matching a selector that the page lays out, passing over any inside a hidden part of the page,
 * which can take neither focus nor a place on screen.
 *
 * @param selector - The selector.
 * @returns The element, or null when the page shows none.
 */
export function shownElement<TElement extends Element>(selector: string): TElement | null {
  // The matches in document order, the first one given a box on screen
  return (
    [...document.querySelectorAll<TElement>(selector)].find(
      (element) => element.getClientRects().length > 0
    ) ?? null
  )
}

/**
 * Puts focus for the reader on the first element matching a selector that the page lays out, leaving the page where
 * it stands.
 *
 * @param selector - The selector.
 * @returns Whether the page showed one.
 */
export function focusShown(selector: string): boolean {
  // The element, where the page shows one
  const target = shownElement<HTMLElement>(selector)

  // Focused there, the page staying where it was
  focusForReader(target, { preventScroll: true })

  // Whether there was one
  return target !== null
}

/** The ARIA roles of the widgets whose own items the arrow keys move between. */
const ARROW_KEY_WIDGET_ROLES = [
  'combobox',
  'grid',
  'listbox',
  'menu',
  'menubar',
  'radiogroup',
  'slider',
  'tablist',
  'toolbar',
  'tree',
  'treegrid',
]

/** The selector matching any widget the arrow keys move within. */
const ARROW_KEY_WIDGET_SELECTOR = ARROW_KEY_WIDGET_ROLES.map((role) => `[role="${role}"]`).join()

/**
 * How many dialogs currently stand over the page, counted off the document itself.
 *
 * @returns The number of dialogs on screen.
 */
export function countOpenDialogs(): number {
  // Every dialog on screen, which is what each one announces itself as
  return document.querySelectorAll('[role="dialog"]').length
}

/**
 * Whether a target sits in a widget that moves between its own items by the arrow keys, such as a tab list, a
 * radio group or an open menu.
 *
 * @param target - Where an event landed.
 *
 * @returns Whether the target sits in such a widget.
 */
export function isInArrowKeyWidget(target: EventTarget | null): boolean {
  // An element inside one of the widgets, or the widget itself
  return target instanceof Element && target.closest(ARROW_KEY_WIDGET_SELECTOR) !== null
}

/**
 * An element and each element holding it, nearest first, up to the first that stands directly in the body or in an
 * open modal dialog.
 *
 * @param element - Where the climb starts.
 *
 * @returns The element and its holders, outermost last.
 */
function holdersUpToModalOrBody(element: Element): Element[] {
  // What holds the element
  const parent = element.parentElement

  // The climb stops in the body, in a modal dialog, or at an element nothing holds
  if (!parent || parent === document.body || parent.getAttribute('aria-modal') === 'true') {
    return [element]
  }

  // The element, then what holds it and so on up
  return [element, ...holdersUpToModalOrBody(parent)]
}

/**
 * Shuts what surrounds an element to the keyboard and to screen readers, the way a surface laid over everything else
 * must: whatever sits beside it at each level up to the body. Inside a modal dialog it stops at the dialog, which has
 * shut everything outside itself already. Anything already shut is left to whatever shut it.
 *
 * @param element - What stays open.
 *
 * @returns A function opening again what this shut.
 */
export function shutAllAround(element: Element): () => void {
  // Whatever sits beside the element or any of its holders, leaving out what is shut already
  const shut = holdersUpToModalOrBody(element).flatMap((holder) =>
    [...(holder.parentElement?.children ?? [])].filter(
      (sibling) => sibling !== holder && !sibling.hasAttribute('inert')
    )
  )

  // What surrounds the element shut
  shut.forEach((sibling) => sibling.setAttribute('inert', ''))

  // A function opening again what this shut
  return () => shut.forEach((sibling) => sibling.removeAttribute('inert'))
}
