import {
  type CSSProperties,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

/**
 * The direction a container scrolls in: across, or down.
 */
type ScrollAxis = 'x' | 'y'

/**
 * Whether a scroll container still hides content past each of its edges along the axis it scrolls in.
 */
type ScrollFadeEdges = {
  /** More content sits before the first edge, left or top, so the container is scrolled off its start. */
  start: boolean
  /** More content sits past the far edge, right or bottom, so there is still room to scroll. */
  end: boolean
}

/**
 * Where a scroll container stands along the axis it scrolls in.
 */
type ScrollPosition = {
  /** How far the container is scrolled from its start. */
  offset: number
  /** How much of the container's content shows at once. */
  visible: number
  /** How long the container's content is. */
  total: number
}

/**
 * Both edges flush: the server's reading, and the one before anything was measured.
 */
const NO_FADE: ScrollFadeEdges = { start: false, end: false }

/**
 * How far the fade reaches in from an edge hiding content, in pixels, for each axis.
 */
const FADE_SIZES_PX: Record<ScrollAxis, number> = { x: 64, y: 32 }

/**
 * The way a fade's gradient runs, from the start edge to the far one, for each axis.
 */
const GRADIENT_DIRECTIONS: Record<ScrollAxis, string> = { x: 'to right', y: 'to bottom' }

/**
 * How to read where a scroll container stands, for each axis.
 */
const POSITION_READERS: Record<ScrollAxis, (element: HTMLElement) => ScrollPosition> = {
  x: (element) => ({
    offset: element.scrollLeft,
    visible: element.clientWidth,
    total: element.scrollWidth,
  }),
  y: (element) => ({
    offset: element.scrollTop,
    visible: element.clientHeight,
    total: element.scrollHeight,
  }),
}

/**
 * Result returned by {@link useScrollFade}.
 */
export type UseScrollFadeResult<T extends HTMLElement> = {
  /** Callback ref to attach to the scroll container being tracked. */
  ref: (element: T | null) => void
  /** A mask style fading whichever edge still hides content, or undefined when both are flush. */
  maskStyle: CSSProperties | undefined
}

/**
 * Tracks whether a scroll container hides content past each edge along the axis it scrolls in, so that a caller can
 * fade whichever edge does. Subscribes to scrolling, resizing and changes in what the scroller holds through
 * {@link useSyncExternalStore}, so it stays correct under concurrent rendering and renders flush on the server.
 * Attach the returned callback ref to the scroller.
 *
 * @param axis - The direction the container scrolls in.
 * @returns The scroller's callback ref, and the mask fading its hidden edges.
 */
export function useScrollFade<T extends HTMLElement>(axis: ScrollAxis): UseScrollFadeResult<T> {
  // The scroller, captured via a callback ref so the subscription re-binds when it mounts
  const [element, setElement] = useState<T | null>(null)

  // The last published edges, reused while unchanged to keep the snapshot referentially stable
  const edgesRef = useRef<ScrollFadeEdges>(NO_FADE)

  // Re-read whenever something can move the edges: scrolling, resizing, or a change in what the scroller holds
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Nothing to watch until the scroller mounts
      if (!element) return () => {}

      // Re-read on scroll, through a passive listener, which never holds the scrolling up
      element.addEventListener('scroll', onStoreChange, { passive: true })

      // Re-read on size changes that shift the overflow
      const resizeObserver = new ResizeObserver(onStoreChange)
      resizeObserver.observe(element)

      // Re-read when what the scroller holds grows or shrinks inside a box that keeps its size
      const mutationObserver = new MutationObserver(onStoreChange)
      mutationObserver.observe(element, { childList: true, subtree: true, characterData: true })

      // Drop every subscription on teardown
      return () => {
        // Stop listening for scrolling
        element.removeEventListener('scroll', onStoreChange)

        // Stop watching the scroller's size
        resizeObserver.disconnect()

        // Stop watching what the scroller holds
        mutationObserver.disconnect()
      }
    },
    [element]
  )

  // Compute the live edges, returning the cached object when nothing changed
  const getSnapshot = useCallback((): ScrollFadeEdges => {
    // No element yet, so nothing overflows
    if (!element) return NO_FADE

    // Where the scroller stands
    const { offset, visible, total } = POSITION_READERS[axis](element)

    // Content hidden before the start, once the scroller is scrolled off it
    const start = offset > 1

    // Content hidden past the far edge, while the end isn't in view yet
    const end = offset + visible < total - 1

    // The last published edges
    const previous = edgesRef.current

    // While the edges are unchanged, the same object again, so the snapshot stays stable
    if (previous.start === start && previous.end === end) return previous

    // Publish the new edges
    edgesRef.current = { start, end }

    // And hand them back
    return edgesRef.current
  }, [element, axis])

  // Subscribe; on the server there is no element, so the edges read flush
  const edges = useSyncExternalStore(subscribe, getSnapshot, () => NO_FADE)

  // The edge-fade mask: a gradient transparent at whichever edge still hides content, opaque across the middle, and
  // undefined when nothing is hidden, so that no mask is painted
  const maskStyle = useMemo<CSSProperties | undefined>(() => {
    // Nothing hidden at either edge, so no mask
    if (!edges.start && !edges.end) return undefined

    // How far the fade reaches in on this axis
    const fadeSize = `${FADE_SIZES_PX[axis]}px`

    // How far it reaches in at each edge: all the way where the edge hides content, not at all where it's flush
    const start = edges.start ? fadeSize : '0px'
    const end = edges.end ? fadeSize : '0px'

    // The way the gradient runs on this axis
    const direction = GRADIENT_DIRECTIONS[axis]

    // Transparent at each end, opaque from the fade's reach inward across the middle
    const gradient = `linear-gradient(${direction}, transparent, #000 ${start}, #000 calc(100% - ${end}), transparent)`

    // Both the standard and the -webkit- property, for Safari
    return { maskImage: gradient, WebkitMaskImage: gradient }
  }, [edges, axis])

  // Hand back the callback ref and the ready fade mask
  return { ref: setElement, maskStyle }
}
