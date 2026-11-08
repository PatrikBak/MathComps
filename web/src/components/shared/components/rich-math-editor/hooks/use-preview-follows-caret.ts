import { useDidUpdate, useEventListener, useMergedRef } from '@mantine/hooks'
import { type RefCallback, type RefObject, useCallback, useRef } from 'react'

import { depthSpanOf, scrollTopShowing } from '@/components/shared/utils/dom-utils'

import { SOURCE_END_ATTRIBUTE, SOURCE_START_ATTRIBUTE } from '../plugins/rehype-source-ranges'
import { type PlacedElement, previewSpotDepth } from '../utils/preview-spot'

/**
 * Options for a listener that never cancels the input it hears, so a scroll that input starts never waits on it. One
 * object kept for good, since a listener handed new options on a render is taken off and not put back.
 */
const PASSIVE_LISTENER: AddEventListenerOptions = { passive: true }

/**
 * Options for the {@link usePreviewFollowsCaret} hook.
 */
type UsePreviewFollowsCaretOptions = {
  /** The textarea whose caret the preview follows, or null for a preview that follows none. */
  followedTextarea: RefObject<HTMLTextAreaElement | null> | null
  /** The text the preview renders. */
  content: string
}

/**
 * Return type for the {@link usePreviewFollowsCaret} hook.
 */
type UsePreviewFollowsCaretResult = {
  /** Attaches the preview's scrolling box, which holds the rendered text, as its callback ref. */
  attachPreview: RefCallback<HTMLDivElement | null>
}

/**
 * Reads one element of the preview stamped with where it stands in the text.
 *
 * @param element - The stamped element.
 * @param preview - The preview's scrolling box.
 * @returns Where the element stands in the text and in the preview's scroll, with its lines.
 */
function readPlacedElement(element: HTMLElement, preview: HTMLElement): PlacedElement {
  // Whether the element holds no other stamped element, so every line break in it ends one of its own lines
  const holdsNoOtherPlaced = element.querySelector(SOURCE_START_ATTRIBUTE.anySelector) === null

  // The element's range in the text, its box, and its lines where they are its own
  return {
    start: Number(element.getAttribute(SOURCE_START_ATTRIBUTE.name)),
    end: Number(element.getAttribute(SOURCE_END_ATTRIBUTE.name)),
    ...depthSpanOf(element, preview),
    lineBreaks: holdsNoOtherPlaced
      ? Array.from(element.querySelectorAll('br'), (lineBreak) => depthSpanOf(lineBreak, preview))
      : [],
  }
}

/**
 * Keeps the spot being written in the preview's view. After each edit, a preview that has the caret's spot out of
 * view, or too near its edge, scrolls just far enough to give the spot room again; one showing it clear of the edges
 * stays still. An image finishing loading brings the spot back the same way, since an image above the spot pushes it
 * down, unless since the last edit the reader has scrolled or pressed the preview, or moved the caret. A scroll the
 * reader made stays until the next edit.
 *
 * @param options - The textarea the preview follows, and the text it renders.
 * @returns The way to attach the preview.
 */
export function usePreviewFollowsCaret({
  followedTextarea,
  content,
}: UsePreviewFollowsCaretOptions): UsePreviewFollowsCaretResult {
  // The preview's scrolling box
  const previewRef = useRef<HTMLDivElement>(null)

  // Where the caret stood when the preview last followed it, none before the first edit and none once the reader
  // has taken the preview over
  const followedCaretRef = useRef<number | null>(null)

  // A function which scrolls the preview to the caret's spot, where the spot is out of its view or too near its edge
  const follow = useCallback(() => {
    // How many of the preview's lines are kept between the spot being written and the edge of its view
    const ROOM_LINES = 2

    // The preview, and the textarea it follows
    const preview = previewRef.current
    const textarea = followedTextarea?.current

    // A preview following no textarea, or gone since, stays where it is
    if (!preview || !textarea) return

    // Every element placed in the text, among those the preview lays out
    const elements = Array.from(
      preview.querySelectorAll<HTMLElement>(SOURCE_START_ATTRIBUTE.anySelector)
    )
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => readPlacedElement(element, preview))

    // Where the caret's spot renders
    const spot = previewSpotDepth(textarea.value, elements, textarea.selectionEnd)

    // An empty preview has nowhere to scroll to
    if (spot === null) return

    // The room kept past the spot, in the preview's own lines
    const room = ROOM_LINES * parseFloat(getComputedStyle(preview).lineHeight)

    // The view as it stands
    const view = { scrollTop: preview.scrollTop, viewHeight: preview.clientHeight }

    // Scrolled to show the spot, with that room past it
    preview.scrollTop = scrollTopShowing(view, { top: spot, bottom: spot }, room)

    // The caret the preview now follows
    followedCaretRef.current = textarea.selectionEnd
  }, [followedTextarea])

  // After each edit of the text, never as the preview first shows it
  useDidUpdate(() => {
    // Followed once the edit has run its course, since an edit made in code places its caret only after the new
    // text is on screen
    queueMicrotask(follow)
  }, [content])

  // A function which follows the caret again as an image in the preview finishes loading, where the preview is still
  // following the caret it last followed
  const followPastLoadedImage = useCallback(() => {
    // A preview whose caret moved since, that the reader took over, or that never followed, stays where it is
    if (followedTextarea?.current?.selectionEnd !== followedCaretRef.current) return

    // The caret's spot, after whatever the image pushed down
    follow()
  }, [followedTextarea, follow])

  // A function which leaves the preview to the reader until the next edit
  const stopFollowing = useCallback(() => {
    // No caret followed any more
    followedCaretRef.current = null
  }, [])

  // Every image loading in the preview, heard on the way down to it, since a load does not bubble
  const hearImageLoads = useEventListener('load', followPastLoadedImage, true)

  // The reader scrolling the preview with a wheel or a trackpad. Told by the reader's input, since the browser also
  // moves the scroll itself, keeping the view steady as an image above it grows
  const hearWheel = useEventListener('wheel', stopFollowing, PASSIVE_LISTENER)

  // The reader pressing the preview, which a scrollbar drag and a touch scroll both start with
  const hearPress = useEventListener('pointerdown', stopFollowing, PASSIVE_LISTENER)

  // The preview, kept and heard
  const attachPreview = useMergedRef(previewRef, hearImageLoads, hearWheel, hearPress)

  // The way to attach the preview
  return { attachPreview }
}
