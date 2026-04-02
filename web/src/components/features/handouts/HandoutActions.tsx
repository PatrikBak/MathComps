'use client'

import { useClipboard } from '@mantine/hooks'
import { Download, FileDown, MoreVertical, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { getHandoutPdfUrl } from '@/components/features/problems/services/problem-api-urls'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'

/**
 * Props for the {@link HandoutActions} component.
 */
type HandoutActionsProps = {
  /** PDF filename stem, e.g. "fun-algebra.sk" (without extension) */
  pdfFilenameStem: string
}

/**
 * Three-dot overflow menu with share and PDF download actions for a handout.
 */
export function HandoutActions({ pdfFilenameStem }: HandoutActionsProps) {
  // Translation hooks for shared and handout-specific labels
  const tActions = useTranslations('ui.actions')
  const tHandouts = useTranslations('handouts.labels')

  // Clipboard access for share functionality
  const clipboard = useClipboard()

  // Construct PDF URLs from the filename stem
  const fullPdfUrl = getHandoutPdfUrl(`${pdfFilenameStem}.pdf`)
  const skeletonPdfUrl = getHandoutPdfUrl(`${pdfFilenameStem}-skeleton.pdf`)

  /** Copies the current page URL to clipboard and shows a toast. */
  const handleShare = () => {
    // Copy the full URL to clipboard
    clipboard.copy(window.location.href)

    // Show confirmation toast
    toast.success(tActions('linkCopied'))
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex h-9 w-9 items-center justify-center rounded-full
               bg-foreground/5 border border-foreground/10
               text-muted-foreground hover:bg-foreground/5 hover:text-foreground/85
               focus:outline-none focus-visible:ring-1 focus-visible:ring-focus/50
               transition-colors duration-150"
          aria-label={tHandouts('moreActions')}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-surface/40 backdrop-blur-xl border-foreground/10"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {/* Share — copies the current URL to clipboard */}
        <DropdownMenuItem onSelect={handleShare}>
          <div className="flex items-center">
            <span className="mr-2 flex w-5 items-center justify-center">
              <Share2 className="h-4 w-4" />
            </span>
            <span>{tActions('share')}</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Download full PDF */}
        <DropdownMenuItem asChild>
          <a href={fullPdfUrl} target="_blank" rel="noopener noreferrer">
            <div className="flex items-center">
              <span className="mr-2 flex w-5 items-center justify-center">
                <Download className="h-4 w-4" />
              </span>
              <span>{tHandouts('downloadPdf')}</span>
            </div>
          </a>
        </DropdownMenuItem>

        {/* Download skeleton (problems only) PDF */}
        <DropdownMenuItem asChild>
          <a href={skeletonPdfUrl} target="_blank" rel="noopener noreferrer">
            <div className="flex items-center">
              <span className="mr-2 flex w-5 items-center justify-center">
                <FileDown className="h-4 w-4" />
              </span>
              <span>{tHandouts('downloadSkeleton')}</span>
            </div>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
