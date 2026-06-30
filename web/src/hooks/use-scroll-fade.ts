import {
  type CSSProperties,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

/**
 * Whether a horizontally-scrollable element still hides content past each edge.
 */
type ScrollFadeEdges = {
  /** More content sits past the left edge (the element is scrolled right). */
  left: boolean
  /** More content sits past the right edge (there is still room to scroll). */
  right: boolean
}

/** Both edges flush — the server snapshot and the resting default before measurement. */
const NO_FADE: ScrollFadeEdges = { left: false, right: false }

/** How far the fade gradient reaches in from an overflowing edge, in px. */
const FADE_SIZE_PX = 64

/** Result returned by {@link useScrollFade}. */
export type UseScrollFadeResult<T extends HTMLElement> = {
  /** Callback ref to attach to the scroll container being tracked. */
  ref: (element: T | null) => void
  /** A mask style fading whichever edge still hides content, or undefined when both are flush. */
  maskStyle: CSSProperties | undefined
}

/**
 * Tracks a scroll container's horizontal overflow at each edge so a caller can fade whichever edge
 * still hides content. Subscribes to scroll + resize through {@link useSyncExternalStore} (so it stays
 * correct under concurrent rendering and renders flush on the server). Attach the returned callback
 * ref to the scroller.
 */
export function useScrollFade<T extends HTMLElement>(): UseScrollFadeResult<T> {
  // The scroller, captured via a callback ref so the subscription re-binds when it mounts
  const [element, setElement] = useState<T | null>(null)
  // The last published edges, reused while unchanged to keep the snapshot referentially stable
  const edgesRef = useRef<ScrollFadeEdges>(NO_FADE)

  // Re-read whenever something that can move the edges happens: scrolling or resizing
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // Nothing to watch until the scroller mounts
      if (!element) return () => {}
      // Re-read on scroll (passive — the listener never blocks it)
      element.addEventListener('scroll', onStoreChange, { passive: true })
      // Re-read on size/content changes that shift the overflow
      const observer = new ResizeObserver(onStoreChange)
      observer.observe(element)
      // Drop both subscriptions on teardown
      return () => {
        element.removeEventListener('scroll', onStoreChange)
        observer.disconnect()
      }
    },
    [element]
  )

  // Compute the live edges, returning the cached object when nothing changed
  const getSnapshot = useCallback((): ScrollFadeEdges => {
    // No element yet — nothing overflows
    if (!element) return NO_FADE
    // Hidden to the left once scrolled off the start
    const left = element.scrollLeft > 1
    // Hidden to the right while the end isn't yet in view
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
    // Grab the last published edges
    const previous = edgesRef.current
    // Reuse them while unchanged so the snapshot stays referentially stable
    if (previous.left === left && previous.right === right) return previous
    // Publish the new edges
    edgesRef.current = { left, right }
    return edgesRef.current
  }, [element])

  // Subscribe; on the server there is no element, so the edges read flush
  const edges = useSyncExternalStore(subscribe, getSnapshot, () => NO_FADE)

  // The edge-fade mask: a horizontal gradient transparent at whichever edge still hides content,
  // opaque across the middle, and undefined when nothing overflows (so no mask is painted)
  const maskStyle = useMemo<CSSProperties | undefined>(() => {
    // Nothing hidden either side → no mask
    if (!edges.left && !edges.right) return undefined
    // Fade width on the left, full size when that edge overflows, zero when it's flush
    const left = edges.left ? `${FADE_SIZE_PX}px` : '0px'
    // Same on the right
    const right = edges.right ? `${FADE_SIZE_PX}px` : '0px'
    // Transparent at each end, opaque from the fade width inward across the middle
    const gradient = `linear-gradient(to right, transparent, #000 ${left}, #000 calc(100% - ${right}), transparent)`
    // Both the standard and the -webkit- property, for Safari
    return { maskImage: gradient, WebkitMaskImage: gradient }
  }, [edges])

  // Hand back the callback ref and the ready fade mask
  return { ref: setElement, maskStyle }
}
