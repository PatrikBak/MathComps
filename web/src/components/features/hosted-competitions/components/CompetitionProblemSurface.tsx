'use client'

import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProblemBand } from '@/components/features/defense/components/ProblemBand'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * How much of the screen a surface takes. Every size hangs from the same top edge, so folding the statement away never
 * moves a surface's header.
 */
export type SurfaceSize =
  /** The screen's height, for a surface written in or read in parts that scroll on their own. */
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

/** How a row under a problem is drawn, whatever it opens. */
export const PROBLEM_ROW_CLASS = cn(
  'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5',
  FOCUS_RING_CLASS
)

/**
 * Props for the {@link ProblemRowLabel} component.
 */
type ProblemRowLabelProps = {
  /** What the row is called. */
  label: string
  /** The mark on the row, saying what kind of row it is. */
  icon: LucideIcon
  /** How many things the row leads to, said once there are any; null where the row counts nothing. */
  count: number | null
  /** Whether some of what the row counts is new to the reader. */
  hasNews?: boolean
}

/**
 * What a row under a problem says: its mark, its name, and how many things it leads to. While some of them are new to
 * the reader, the count is filled in and says so to a screen reader.
 */
export function ProblemRowLabel({
  label,
  icon: Icon,
  count,
  hasNews = false,
}: ProblemRowLabelProps) {
  // Content copy
  const tContent = useTranslations('ui.content')

  return (
    <span className="inline-flex items-center gap-2 text-foreground">
      <Icon size={15} className="text-muted" />
      {label}
      {/* A space between the name and the count, so the row's accessible name reads them apart */}{' '}
      {count !== null && count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 text-xs font-semibold tabular-nums',
            hasNews ? 'bg-brand text-brand-foreground' : 'bg-brand/15 text-brand-light'
          )}
        >
          {count}
          {hasNews && <span className="sr-only">{tContent('includingNew')}</span>}
        </span>
      )}
    </span>
  )
}

/**
 * Props for the {@link CompetitionProblemSurface} component.
 */
type CompetitionProblemSurfaceProps = {
  /** What the row and the surface it opens are both called. */
  label: string
  /** The mark on the row, which is what tells one surface from another at a glance. */
  icon: LucideIcon
  /** The number the problem goes by. */
  position: number
  /** The statement as markdown/math source. */
  statement: string
  /** Whether this problem is the one whose surface is being read. */
  isOpen: boolean
  /** Opens the surface. */
  onOpen: () => void
  /** Closes the surface. */
  onClose: () => void
  /** How many things are on the surface, said on the row; null where the row counts nothing. */
  count: number | null
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
 * Something read about one problem away from the problem itself: a line among the rows under it, and the
 * thing itself on a surface of its own.
 *
 * The surface is laid out the way a conversation about a problem is: the statement above, folded
 * away by the same control, and what is said about it underneath.
 */
export function CompetitionProblemSurface({
  label,
  icon,
  position,
  statement,
  isOpen,
  onOpen,
  onClose,
  count,
  size,
  scrollsInParts = false,
  children,
}: CompetitionProblemSurfaceProps) {
  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // Competitions copy
  const t = useTranslations('competitions')

  // How the modal is set up for the surface's size
  const layout = SURFACE_LAYOUTS[size]

  return (
    <>
      {/* The row */}
      <button type="button" onClick={onOpen} className={PROBLEM_ROW_CLASS}>
        <ProblemRowLabel label={label} icon={icon} count={count} />
      </button>

      {/* The surface, up to nearly the whole screen: what is read here runs from three lines to three pages */}
      {isOpen && (
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
          {/* Which of the surfaces this is, the problem it is about, and the way out of it */}
          <div className="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-4 py-2 sm:px-5">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-base font-bold text-foreground sm:text-lg">
                {label}
              </span>
              <span className="truncate text-xs text-muted">
                {t('problemHeading', { position })}
              </span>
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

          {/* The problem, re-readable above what is said about it. Nothing under it is being written, so
              it stands at its own height */}
          <ProblemBand statement={statement} height="own" />

          {/* And the thing itself, which scrolls in its own right once it outgrows the screen, or in parts it
              lays out itself */}
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
      )}
    </>
  )
}
