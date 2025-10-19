'use client'

import { useClipboard } from '@mantine/hooks'
import { Link as LinkIcon } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import * as React from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/constants/routes'

import type { SearchFiltersState } from '../types/problem-library-types'
import { serializeFilters } from '../utils/search-url-serialization'

/**
 * Props for the ShareButton component.
 */
type ShareButtonProps = {
  /** Current search filters to include in the shared URL */
  filters: SearchFiltersState
  /**
   * If true, the button will render its child and pass the click handler to it.
   * Useful for nesting inside other components like DropdownMenu.Item.
   */
  asChild?: boolean
  children?: React.ReactNode
  /** Optional class name to pass to the underlying button */
  className?: string
}

/**
 * A button component that allows users to share the current search state via URL.
 *
 * When clicked, it generates a URL containing the current search filters and copies it
 * to the clipboard. The button shows a temporary "Copied!" state after successful copy.
 *
 * @param filters - Current search filters to include in the shared URL
 * @param asChild - If true, render children and pass props.
 * @param children - The content to render when asChild is true.
 * @returns JSX element representing the share button
 */
export const ShareButton = ({
  filters,
  asChild = false,
  children,
  className,
}: ShareButtonProps) => {
  const clipboard = useClipboard()

  // Memoize the serialized filters to prevent unnecessary re-computations
  const serializedFilters = useMemo(() => serializeFilters(filters), [filters])

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      // When used as a child (e.g., in dropdown menu), don't prevent default behavior
      // to allow the menu to close properly
      if (!asChild) {
        e.preventDefault()
        e.stopPropagation()
      }

      // URL based on whether there are additional filters
      const shareUrls = {
        withFilters: `${window.location.origin}${ROUTES.PROBLEMS}?${serializedFilters}`,
        withoutFilters: `${window.location.origin}${ROUTES.PROBLEMS}`,
      }
      const shareUrl = serializedFilters ? shareUrls.withFilters : shareUrls.withoutFilters

      // Clipload copy
      clipboard.copy(shareUrl)

      // Toast for happiness
      toast.success('Odkaz bol skopírovaný do schránky')
    },
    [serializedFilters, clipboard, asChild]
  )

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleShare,
    } as React.HTMLAttributes<HTMLElement>)
  }

  return (
    <button onClick={handleShare} className={className}>
      <LinkIcon className="mr-2 h-4 w-4" />
      Zdieľať
    </button>
  )
}
