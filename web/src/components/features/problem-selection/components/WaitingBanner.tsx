'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { RefObject } from 'react'

import { Button } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { focusForReader } from '@/components/shared/utils/focus-utils'

import { SlotNumber } from './CategoryMarks'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link WaitingBanner} component.
 */
type WaitingBannerProps = {
  /** The line under the banner saying how many problems show, which takes the focus when the banner goes. */
  countRef: RefObject<HTMLParagraphElement | null>
}

/**
 * Says which slot is waiting for a problem, and lets it go.
 */
export function WaitingBanner({ countRef }: WaitingBannerProps) {
  // Picking copy
  const t = useTranslations('problemSelection.picking')

  // The selection, the slot waiting for a problem, and the way to let it go
  const { selection, waitingSlot, stopWaiting } = useSelectionWorkspace()

  // The board on screen, once the selection has arrived
  const activeBoard = selection?.activeBoard ?? null

  // The waiting slot's paper, undefined while no slot is waiting
  const paper =
    waitingSlot === null
      ? undefined
      : activeBoard?.papers.find((candidate) => candidate.id === waitingSlot.paperId)

  // Nothing is waiting on the board on screen
  if (waitingSlot === null || paper === undefined || activeBoard === null) return null

  // A function which lets the slot go, the focus moving on before the banner leaves with the button
  const letGo = () => {
    // The focus on the line below, the page staying where it was
    focusForReader(countRef.current, { preventScroll: true })

    // The slot let go, which takes the banner away
    stopWaiting()
  }

  return (
    <div
      className={cn(
        'sticky-below-header top-[calc(var(--header-height)+8px)] mt-4',
        'flex items-center gap-3 px-3 py-2 text-sm',
        'rounded-lg border border-brand/40 bg-background/95 shadow-lg backdrop-blur'
      )}
    >
      {/* The slot's short label */}
      <SlotNumber paper={paper} index={waitingSlot.index} state="highlighted" />

      {/* Where the next pick goes */}
      <span className="min-w-0 flex-1 text-muted-foreground">
        {t('target', {
          board: activeBoard.name,
          paper: paper.name,
          position: waitingSlot.index + 1,
        })}
      </span>

      {/* The way to let the slot go */}
      <Button size="icon" variant="ghost" aria-label={t('stop')} onClick={letGo}>
        <X size={16} />
      </Button>
    </div>
  )
}
