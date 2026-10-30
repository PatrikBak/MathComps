'use client'
import React from 'react'
import { useCallback, useState } from 'react'

import { cn } from '../utils/css-utils'
import { Tooltip } from './Tooltip'

/**
 * How far past its box the text can measure and still count as fitting. Under page zoom the text's width and its
 * box's come off different layout paths, and for text that fits they part by up to a few hundred-thousandths of a
 * pixel.
 */
const MEASUREMENT_NOISE_PX = 0.001

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
      // The text's laid-out width, which the ellipsis leaves whole
      const textRange = document.createRange()
      textRange.selectNodeContents(node)
      const textWidth = textRange.getBoundingClientRect().width

      // Truncated once the text runs past its box by more than the noise in measuring them, compared in
      // fractional px: under page zoom WebKit rounds the integer scrollWidth and clientWidth apart, so a label
      // that fits reads 1px over
      const currentlyTruncated =
        textWidth - node.getBoundingClientRect().width > MEASUREMENT_NOISE_PX

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

  // The actual text span to be displayed, which will be measured. A new text gets a new span and is measured
  // afresh, since a box its container holds at one width never resizes when its text changes.
  const textElement = (
    <span key={children} ref={measureRef} className={cn('truncate block', className)}>
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
