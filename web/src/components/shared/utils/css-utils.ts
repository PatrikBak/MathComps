import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * CSS and styling utilities for consistent UI behavior.
 */

/**
 * Escapes a string for safe use in a CSS selector.
 * Works in both server-side rendering and the browser.
 * @param value - Raw string that may contain characters invalid in CSS selectors
 * @returns The escaped string safe to interpolate into a selector
 */
export function escapeCss(value: string): string {
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~\s])/g, '\\$1')
}

/**
 * Utility function for merging Tailwind CSS classes with clsx and twMerge.
 * Handles conditional classes and removes duplicates.
 * @param inputs - Class values to merge
 * @returns Merged and deduplicated class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
