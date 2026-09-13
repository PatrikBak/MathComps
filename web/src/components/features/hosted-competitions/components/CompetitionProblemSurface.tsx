'use client'

import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { ProblemBand } from '@/components/features/defense/components/ProblemBand'
import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * Props for the {@link CompetitionProblemSurface} component.
 */
type CompetitionProblemSurfaceProps = {
  /** What the row and the surface it opens are both called. */
  label: string
  /** The mark on the row, which is what tells one surface from another at a glance. */
  icon: LucideIcon
  /** Which of the set this is about, counting from one. */
  position: number
  /** The statement as markdown/math source, in every language the site is read in. */
  statement: LocalizedString
  /** Whether this problem is the one whose surface is being read. */
  isOpen: boolean
  /** Opens the surface. */
  onOpen: () => void
  /** Closes the surface. */
  onClose: () => void
  /** What is read on the surface. */
  children: React.ReactNode
}

/**
 * What the competition area reads about one problem away from the problem itself: a line among the rows
 * under it, and the thing itself on a surface of its own.
 *
 * The surface is laid out the way the conversation about the same problem is: the statement above, folded
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
  children,
}: CompetitionProblemSurfaceProps) {
  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // Competitions copy
  const t = useTranslations('competitions')

  // The active locale, which decides which language the statement is read in
  const locale = useLocale() as Locale

  return (
    <>
      {/* Drawn as the conversation rows beside it are, down to the icon and the size */}
      <button
        type="button"
        onClick={onOpen}
        className="focus flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5"
      >
        <span className="inline-flex items-center gap-2 text-foreground">
          <Icon size={15} className="text-muted" />
          {label}
        </span>
      </button>

      {/* Sized to the argument: what is read here runs from three lines to three pages */}
      {isOpen && (
        <Modal
          isOpen
          onClose={onClose}
          showCloseButton={false}
          padded={false}
          ariaLabel={label}
          className="sm:max-w-4xl"
        >
          {/* Which of the surfaces this is, which of the set it belongs to, and the way out of it. Whose
              work it is has to be said, everything else under a problem being the student's own */}
          <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2 sm:px-5">
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

          {/* The problem, re-readable above what is said about it, exactly as it is above a conversation */}
          <ProblemBand statement={statement[locale]} />

          {/* And the thing itself, which scrolls in its own right once it outgrows the screen */}
          <div className="scrollbar-visible max-h-[60dvh] overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            {children}
          </div>
        </Modal>
      )}
    </>
  )
}
