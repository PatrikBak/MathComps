'use client'

import { useClipboard } from '@mantine/hooks'
import { Link } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

import { cn } from '@/components/shared/utils/css-utils'

interface CopyLinkButtonProps {
  /** Section slug/ID for the anchor link (already slugified) */
  sectionSlug: string
  /** Icon size in pixels */
  iconSize?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Reusable button component that copies a section anchor link to clipboard.
 */
export function CopyLinkButton({ sectionSlug, iconSize = 20, className }: CopyLinkButtonProps) {
  const clipboard = useClipboard({ timeout: 2000 })

  const handleCopyLink = () => {
    // Create URL with the section slug
    const url = `${window.location.origin}${window.location.pathname}#${sectionSlug}`
    clipboard.copy(url)
    toast.success('Odkaz na sekciu bol skopírovaný do schránky')
  }

  return (
    <button
      onClick={handleCopyLink}
      className={cn(
        'transition-all duration-200',
        'p-1.5 ml-2 rounded-lg',
        'text-gray-400 hover:text-gray-200 hover:bg-white/10',
        'cursor-pointer',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        className
      )}
      aria-label="Kopírovať odkaz na sekciu"
      title="Kopírovať odkaz na sekciu"
    >
      <Link size={iconSize} />
    </button>
  )
}
