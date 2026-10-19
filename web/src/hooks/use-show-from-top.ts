'use client'

import { type RefObject, useRef } from 'react'

import { focusForReader } from '@/components/shared/utils/focus-utils'

import { useScrollOffset } from './use-scroll-offset'

/**
 * Options for {@link useShowFromTop}.
 */
type UseShowFromTopOptions = {
  /** Shows what was asked for, which may lay the list out afresh. */
  show: () => void
  /** What takes the focus as the control asking to show leaves. */
  focusTarget: RefObject<HTMLElement | null>
}

/**
 * What {@link useShowFromTop} hands back.
 */
type UseShowFromTopResult = {
  /** The list, whose top comes back into view. */
  listRef: RefObject<HTMLDivElement | null>
  /** Shows what was asked for, from the top of the list. */
  showFromTop: () => void
}

/**
 * Shows something that lays a list out afresh, from the list's top. The focus moves on first, since the control
 * asking for it leaves, and the list's top comes back into view where the page is scrolled past it. The scroll lands
 * at once, before the list changes, so nothing the change puts above it can carry it elsewhere.
 *
 * @param options - {@link UseShowFromTopOptions}.
 *
 * @returns The list's handle, and the way to show from its top.
 */
export function useShowFromTop({ show, focusTarget }: UseShowFromTopOptions): UseShowFromTopResult {
  // The list
  const listRef = useRef<HTMLDivElement>(null)

  // How far below the top of the window a scrolled-to element comes to rest, clear of the header
  const scrollOffset = useScrollOffset()

  // A function which shows what was asked for, from the top of the list
  const showFromTop = () => {
    // The focus moved on before the control leaves, the page staying where it is
    focusForReader(focusTarget.current, { preventScroll: true })

    // How far below the top of the window the list's top stands, while the list is on the page
    const listTop = listRef.current?.getBoundingClientRect().top

    // The list's top brought back at once to rest clear of the header, where the page is scrolled past it
    if (listTop !== undefined && listTop < scrollOffset) {
      window.scrollBy({ top: listTop - scrollOffset, behavior: 'instant' })
    }

    // What was asked for, shown
    show()
  }

  // The list's handle, and the way to show from its top
  return { listRef, showFromTop }
}
