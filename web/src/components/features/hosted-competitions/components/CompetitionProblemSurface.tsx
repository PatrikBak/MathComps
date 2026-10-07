'use client'

import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { ProblemBand } from '@/components/features/defense/components/ProblemBand'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

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
  /** Whether the surface fills the screen's height, for one that is written in rather than only read. */
  isTall: boolean
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
  icon: Icon,
  position,
  statement,
  isOpen,
  onOpen,
  onClose,
  count,
  isTall,
  children,
}: CompetitionProblemSurfaceProps) {
  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // Competitions copy
  const t = useTranslations('competitions')

  return (
    <>
      {/* The row, drawn as a conversation row is, down to the icon and the size */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5',
          FOCUS_RING_CLASS
        )}
      >
        <span className="inline-flex items-center gap-2 text-foreground">
          <Icon size={15} className="text-muted" />
          {label}
          {count !== null && count > 0 && (
            <span className="rounded-full bg-brand/15 px-1.5 text-xs font-semibold tabular-nums text-brand-light">
              {count}
            </span>
          )}
        </span>
      </button>

      {/* Sized to the argument, up to nearly the whole screen: what is read here runs from three lines to
          three pages */}
      {isOpen && (
        <Modal
          isOpen
          onClose={onClose}
          showCloseButton={false}
          padded={false}
          ariaLabel={label}
          className="flex max-h-[100dvh] flex-col sm:max-h-[94vh] sm:max-w-5xl"
          tall={isTall}
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

          {/* And the thing itself, which scrolls in its own right once it outgrows the screen */}
          <div
            className={cn(
              'scrollbar-visible min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5',
              isTall && 'flex-1'
            )}
          >
            {children}
          </div>
        </Modal>
      )}
    </>
  )
}
