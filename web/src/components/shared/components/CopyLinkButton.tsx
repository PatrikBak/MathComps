'use client'

import { useClipboard } from '@mantine/hooks'
import { Link } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link CopyLinkButton} component.
 */
type CopyLinkButtonProps = {
  /** Section slug/ID for the anchor link (already slugified) */
  slug: string
  /** Icon size in pixels */
  iconSize?: number
  /** Additional CSS classes */
  className?: string
}

/**
 * Reusable button component that copies a section anchor link to clipboard.
 */
export function CopyLinkButton({ slug, iconSize = 20, className }: CopyLinkButtonProps) {
  // Get translations
  const tActions = useTranslations('ui.actions')
  const tEditor = useTranslations('ui.editor')

  // Get clipboard handler
  const clipboard = useClipboard({ timeout: 2000 })

  return (
    <button
      onClick={() => {
        // Copy the URL to clipboard
        clipboard.copy(`${window.location.origin}${window.location.pathname}#${slug}`)

        // Inform the user
        toast.success(tEditor('sectionLinkCopied'))
      }}
      className={cn(
        'transition-all duration-200',
        'p-1.5 ml-2 rounded-lg',
        'text-gray-400 hover:text-gray-200 hover:bg-white/10',
        'cursor-pointer',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        className
      )}
      aria-label={tActions('copyLink')}
      title={tActions('copyLink')}
    >
      <Link size={iconSize} />
    </button>
  )
}
