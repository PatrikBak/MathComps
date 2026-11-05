'use client'

import { useCallback, useState } from 'react'

/**
 * The element a callback ref was last handed, as state, so what draws into it renders once it is on the page.
 *
 * The null React hands the ref as the element goes is ignored. A hidden Activity detaches every ref under it while
 * its elements stay in the document, so the element is still handed back while it hides.
 *
 * @template T - The kind of element the ref is put on.
 * @returns The element, null until the first one arrives, and the callback ref to put on it.
 */
export function useLastElement<T extends Element>(): [T | null, (element: T | null) => void] {
  // The element last handed to the ref
  const [element, setElement] = useState<T | null>(null)

  // The callback ref, which keeps the element it is handed
  const keepElement = useCallback((arrived: T | null) => {
    // Only an arriving element is kept
    if (arrived !== null) setElement(arrived)
  }, [])

  // The element and the way to hand it over
  return [element, keepElement]
}
