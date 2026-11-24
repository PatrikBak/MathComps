'use client'

import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProblemBand } from '@/components/domain/problem/ProblemBand'
import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * How much of the screen a surface takes. Every size hangs from the same top edge, so folding the statement away never
 * moves a surface's header.
 */
export type SurfaceSize =
  /** The screen's height, however little is on the surface. */
  | 'screen'
  /**
   * One column of text at a reading width, as tall as the text up to the height a screen-high surface has. On a phone
   * it takes the whole screen.
   */
  | 'text'

/**
 * How the modal is set up for one size of surface.
 */
type SurfaceLayout = {
  /** Whether the modal fills the screen's height. */
  tall: boolean
  /** The panel's height and width. */
  panelClass: string
}

/**
 * How the modal is set up for each size of surface.
 */
const SURFACE_LAYOUTS: Record<SurfaceSize, SurfaceLayout> = {
  screen: { tall: true, panelClass: 'sm:max-w-5xl' },
  // Below the small breakpoint it takes the whole screen. Above it, it is 51rem wide: a 48rem column of text, with
  // the padding and the scrollbar's gutter beside it
  text: {
    tall: false,
    panelClass: 'h-[100dvh] max-w-none sm:h-auto sm:max-w-[51rem]',
  },
}

/**
 * Props for the {@link ProblemSurfaceModal} component.
 */
export type ProblemSurfaceModalProps = {
  /** What the surface is called. */
  label: string
  /** Which problem the surface is about, as the reader knows it. */
  heading: string
  /** The statement as markdown/math source. */
  statement: string
  /** Closes the surface. */
  onClose: () => void
  /** How much of the screen the surface takes. */
  size: SurfaceSize
  /**
   * Whether what is read on the surface lays itself out in parts that each scroll on their own; otherwise it is one
   * padded column that scrolls as a whole.
   */
  scrollsInParts?: boolean
  /** What is read on the surface. */
  children: React.ReactNode
}

/**
 * A modal holding something read about one problem: its statement at the top, which folds away, and the text
 * underneath. It takes up to nearly the whole screen, since that text runs from three lines to three pages.
 */
export function ProblemSurfaceModal({
  label,
  heading,
  statement,
  onClose,
  size,
  scrollsInParts = false,
  children,
}: ProblemSurfaceModalProps) {
  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // How the modal is set up for the surface's size
  const layout = SURFACE_LAYOUTS[size]

  return (
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton={false}
      padded={false}
      ariaLabel={label}
      className={cn('flex flex-col', layout.panelClass)}
      tall={layout.tall}
      align="tallTop"
    >
      {/* Header: the surface's name, the problem it is about, and the way out of it */}
      <div className="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-4 py-2 sm:px-5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-base font-bold text-foreground sm:text-lg">{label}</span>
          <span className="truncate text-xs text-muted">{heading}</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={tModal('close')}
          className="ml-auto shrink-0"
        >
          <X size={20} />
        </Button>
      </div>

      {/* The problem, re-readable above what is said about it, at its own height */}
      <ProblemBand statement={statement} height="own" />

      {/* What is read on the surface: one column that scrolls once it outgrows the screen, or parts that scroll on
          their own */}
      <div
        className={
          scrollsInParts
            ? 'flex min-h-0 flex-1 flex-col'
            : 'scrollbar-visible min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5'
        }
      >
        {children}
      </div>
    </Modal>
  )
}
