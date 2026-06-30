import useEmblaCarousel from 'embla-carousel-react'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Layout effect on the client (the height measurement below needs before-paint timing to avoid a
 * flash), plain effect on the server — where {@link useLayoutEffect} only warns and wouldn't run.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Embla's configuration object, as accepted by {@link useEmblaCarousel}.
 */
type EmblaOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>

/**
 * Props for the {@link Pager} component.
 */
type PagerProps = {
  /** One node per page. */
  slides: React.ReactNode[]
  /** The page index to show. */
  selectedIndex: number
  /** Reports a user-driven page change (the new index). */
  onSelect: (index: number) => void
}

/**
 * Headless horizontal pager built on Embla — touch swipe and (via the parent) keyboard/tab control.
 * Mouse drag is deliberately off so a desktop press selects text rather than swiping the page.
 *
 * The parent owns `selectedIndex`; this component scrolls Embla to match it and reports user-driven
 * page changes back through `onSelect`. An outer wrapper clips to the active slide's height (so short
 * pages leave no trailing whitespace) — kept off the Embla viewport itself, because resizing the
 * viewport would make Embla re-init and snap back. A `reInit` self-heal restores the page after any
 * width/resize-driven re-init.
 */
export function Pager({ slides, selectedIndex, onSelect }: PagerProps) {
  // Stable options, created once; startIndex pins the initial page
  const options = useRef<EmblaOptions>({
    align: 'start',
    loop: false,
    startIndex: selectedIndex,
    // Only let touch start a drag — a mouse press should be a text selection, not a page swipe.
    // Embla gates each press through this; touch arrives as a TouchEvent, a desktop press as a MouseEvent.
    watchDrag: (_emblaApi, event) => !(event instanceof MouseEvent),
  }).current
  // Spin up Embla, exposing its viewport ref and api
  const [emblaRef, emblaApi] = useEmblaCarousel(options)

  // Refs to each slide wrapper
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  // The latest selected index, for event handlers
  const selectedIndexRef = useRef(selectedIndex)
  // Keep it fresh on every render
  selectedIndexRef.current = selectedIndex

  // The outer-wrapper height, pinned to the active slide
  const [height, setHeight] = useState<number | undefined>(undefined)

  // Adopt the active slide's height for the clipping wrapper
  const measure = useCallback((index: number) => {
    // Grab the active slide element
    const element = slideRefs.current[index]
    // Adopt its rendered height when present
    if (element) setHeight(element.offsetHeight)
  }, [])

  // Keep Embla in sync when the parent changes the selected page
  useEffect(() => {
    // Wait for the api to be ready
    if (!emblaApi) return
    // Scroll only when Embla isn't already on this page (avoids fighting a user drag)
    if (emblaApi.selectedScrollSnap() !== selectedIndex) {
      // Jump to the page: a parent-driven change is always a click/key/tab nav (its motion is the
      // scroll-up); a landed swipe leaves Embla already on-index, so it never reaches this effect
      emblaApi.scrollTo(selectedIndex, true)
    }
  }, [emblaApi, selectedIndex])

  // Pin the wrapper height to the active slide before paint, so a short page doesn't flash at the
  // tallest slide's height on first load / deep link
  useIsomorphicLayoutEffect(() => {
    measure(selectedIndex)
  }, [selectedIndex, measure])

  // Keep the parent in sync and self-heal the position after a re-init
  useEffect(() => {
    // Wait for the api to be ready
    if (!emblaApi) return
    // Bridge Embla's selection into the parent callback
    const handleSelect = () => onSelect(emblaApi.selectedScrollSnap())
    // After a re-init, snap back to the controlled page if Embla drifted
    const handleReInit = () => {
      if (emblaApi.selectedScrollSnap() !== selectedIndexRef.current) {
        emblaApi.scrollTo(selectedIndexRef.current, true)
      }
    }
    // Subscribe to selection changes and re-inits
    emblaApi.on('select', handleSelect)
    emblaApi.on('reInit', handleReInit)
    // Clean up the subscriptions
    return () => {
      emblaApi.off('select', handleSelect)
      emblaApi.off('reInit', handleReInit)
    }
  }, [emblaApi, onSelect])

  // Track the active slide's height as its content changes (filtering, font load, viewport)
  useEffect(() => {
    // Grab the active slide element
    const element = slideRefs.current[selectedIndex]
    // Nothing to observe until the slide mounts
    if (!element) return
    // Follow the active slide's height for the clipping wrapper
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight))
    observer.observe(element)
    // Disconnect on slide change/unmount
    return () => {
      observer.disconnect()
    }
  }, [selectedIndex])

  // The clipping wrapper over the Embla viewport
  return (
    <div className="overflow-hidden transition-[height] duration-300 ease-out" style={{ height }}>
      {/* Embla viewport keeps its natural (tallest-slide) height so resizing it never re-inits */}
      <div ref={emblaRef} className="overflow-hidden">
        {/* Flex track; items-start keeps each slide its natural height; pan-y pinch-zoom hands
            horizontal drags to Embla while leaving vertical scroll + pinch-zoom to the browser */}
        <div className="flex items-start touch-pan-y touch-pinch-zoom">
          {/* One wrapper per slide */}
          {slides.map((slide, index) => (
            <div
              key={index}
              ref={(element) => {
                slideRefs.current[index] = element
              }}
              className="min-w-0 flex-[0_0_100%]"
              // Off-screen pages stay mounted (for SSR + height) but leave the tab order and AT tree
              aria-hidden={index !== selectedIndex || undefined}
              inert={index !== selectedIndex}
            >
              {slide}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
