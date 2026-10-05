'use client'

import { useEffect } from 'react'

/**
 * Brings the element the URL hash names into view once the page's content is on screen.
 *
 * React streams the page into a hidden placeholder and moves it into place a few hundred milliseconds after
 * first paint. The browser's own attempt at the hash often comes before that, finds nothing on screen, and leaves
 * the page at the top. React hydrates a streamed boundary only after moving it into place, so this effect runs once
 * the anchors are showing, provided it is rendered inside the same Suspense boundary as them.
 */
export function ScrollToHashTarget() {
  // Land on the target, once the content around it is revealed
  useEffect(() => {
    // How the document was reached
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]

    // A reload or a return through history puts the reader back where they were, the top included
    if (navigation?.type === 'reload' || navigation?.type === 'back_forward') return

    // Something moved the page already: the browser's own landing, the reader, or the router's scroll on a
    // client-side navigation
    if (window.scrollY !== 0) return

    // Instant, against the smooth scrolling the stylesheet sets. The target's scroll-margin-top clears the sticky
    // header
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
  }, [])

  // Nothing to draw
  return null
}
