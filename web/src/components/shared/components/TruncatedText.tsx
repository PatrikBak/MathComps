'use client'
import { useCallback, useState } from 'react'
import React from 'react'

import { cn } from '../utils/css-utils'
import { Tooltip } from './Tooltip'

/**
 * Component that conditionally adds a tooltip if the text content is visually
 * truncated. The tooltip is *only* triggered by hovering over the far-right
 * part of the text (where the ellipsis would be).
 *
 * @component
 * @param {string} props.children - The text content to display.
 * @param {string} [props.className] - Additional classes for styling.
 * @param {string} [props.tooltipContent] - Optional override for the tooltip text.
 * @returns {JSX.Element} The rendered component.
 */
export function TruncatedText({
  children,
  className = '',
  tooltipContent,
}: {
  children: string
  className?: string
  tooltipContent?: string
}) {
  // We'll keep track of whether the text is too long and needs to be truncated
  const [isTruncated, setIsTruncated] = useState(false)

  // Callback ref to measure the text element
  const measureRef = useCallback((node: HTMLElement | null) => {
    if (!node) return

    // This function checks for truncation
    const checkTruncation = () => {
      // Find the current value
      const currentlyTruncated = node.scrollWidth > node.clientWidth
      // Set the value only if it changed
      setIsTruncated((previouslyTruncated) => {
        if (previouslyTruncated === currentlyTruncated) {
          return previouslyTruncated
        }
        return currentlyTruncated
      })
    }

    // Initial check
    checkTruncation()

    // Watch for resize changes
    const resizeObserver = new ResizeObserver(checkTruncation)
    resizeObserver.observe(node)

    // Cleanup
    return () => resizeObserver.disconnect()
  }, [])

  // The actual text span to be displayed, which will be measured
  const textElement = (
    <span ref={measureRef} className={cn('truncate block', className)}>
      {children}
    </span>
  )

  return (
    <div className="relative w-full">
      <div className={isTruncated ? 'pointer-events-none' : ''}>{textElement}</div>
      {/* Conditionally render the Tooltip and its trigger (the overlay). */}
      {isTruncated && (
        <Tooltip content={tooltipContent || children} placement="right">
          {/* This is the invisible hover zone. */}
          <div className="absolute right-0 top-0 bottom-0 w-8 cursor-default" aria-hidden="true" />
        </Tooltip>
      )}
    </div>
  )
}
