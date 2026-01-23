'use client'

import { useClipboard } from '@mantine/hooks'
import { Link as LinkIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useMemo } from 'react'
import * as React from 'react'
import { toast } from 'sonner'

import { ROUTES } from '@/i18n/i18n'

import type { SearchFiltersState } from '../types/problem-library-types'
import { serializeFilters } from '../utils/search-url-serialization'

/**
 * Props for the ShareButton component.
 */
type ShareButtonProps = {
  /** Current search filters to include in the shared URL */
  filters: SearchFiltersState
  /**
   * If a valid React element is passed, it will receive the click handler (asChild pattern).
   * Useful for nesting inside other components like DropdownMenu.Item.
   */
  children?: React.ReactNode
  /** Optional class name to pass to the underlying button (only used when no children) */
  className?: string
}

/**
 * A button component that allows users to share the current search state or a problem via URL.
 */
export const ShareButton = ({ filters, children, className }: ShareButtonProps) => {
  // Get translations
  const t = useTranslations('ui.actions')

  // Gain clipboard access
  const clipboard = useClipboard()

  // Memoize the serialized filters
  const serializedFilters = useMemo(() => serializeFilters(filters), [filters])

  // Check if we're using the "asChild" pattern
  const isAsChild = React.isValidElement(children)

  /** Handles the share action. */
  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      // When used as a child (e.g., in dropdown menu), don't prevent default behavior
      // to allow the menu to close properly
      if (!isAsChild) {
        e.preventDefault()
        e.stopPropagation()
      }

      // URL based on whether there are additional filters
      const shareUrl = serializedFilters
        ? `${window.location.origin}${ROUTES.PROBLEMS}?${serializedFilters}`
        : `${window.location.origin}${ROUTES.PROBLEMS}`

      // Clipboard copy
      clipboard.copy(shareUrl)

      // Toast for happiness
      toast.success(t('linkCopied'))
    },
    [serializedFilters, clipboard, isAsChild, t]
  )

  // "asChild" pattern: clone the child element and inject onClick, so we can
  // delegate behavior without wrapping in an extra <button> (avoids nested interactives).
  if (isAsChild) {
    return React.cloneElement(children, {
      onClick: handleShare,
    } as React.HTMLAttributes<HTMLElement>)
  }

  // Default button when no children provided
  return (
    <button onClick={handleShare} className={className}>
      <LinkIcon className="mr-2 h-4 w-4" />
      {t('share')}
    </button>
  )
}
