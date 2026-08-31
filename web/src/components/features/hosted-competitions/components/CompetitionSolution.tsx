'use client'

import { BookOpen, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { ProblemBand } from '@/components/features/defense/components/ProblemBand'
import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { ProblemMarkdown } from '@/components/shared/components/rich-math-editor/components/ProblemMarkdown'
import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * Props for the {@link CompetitionSolution} component.
 */
type CompetitionSolutionProps = {
  /** Which of the set it solves, counting from one. */
  position: number
  /** The statement as markdown/math source, in every language the site is read in. */
  statement: LocalizedString
  /** The official solution, in every language the site is read in. */
  solution: LocalizedString
  /** Whether this problem is the one whose solution is being read. */
  isOpen: boolean
  /** Opens the solution. */
  onOpen: () => void
  /** Closes the solution. */
  onClose: () => void
}

/**
 * The official solution to one of a competition's problems: a line on the problem, and the solution itself
 * on a surface of its own.
 *
 * Only ever drawn once the student is no longer competing here, which is when a solution reaches the page
 * at all.
 *
 * The surface is laid out the way the conversation about the same problem is: the statement above, folded
 * away by the same control, and what is said about it underneath.
 */
export function CompetitionSolution({
  position,
  statement,
  solution,
  isOpen,
  onOpen,
  onClose,
}: CompetitionSolutionProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Shared modal chrome copy
  const tModal = useTranslations('ui.modal')

  // The active locale, which decides which language both texts are read in
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
          <BookOpen size={15} className="text-muted" />
          {t('officialSolution')}
        </span>
      </button>

      {/* Sized to the argument: solutions run from three lines to three pages */}
      {isOpen && (
        <Modal
          isOpen
          onClose={onClose}
          showCloseButton={false}
          padded={false}
          ariaLabel={t('officialSolution')}
          className="sm:max-w-4xl"
        >
          {/* Which of the two surfaces this is, which of the set it belongs to, and the way out of it.
              Whose solution it is has to be said, everything else under a problem being the student's own */}
          <div className="flex items-center gap-3 border-b border-foreground/10 px-4 py-2 sm:px-5">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-base font-bold text-foreground sm:text-lg">
                {t('officialSolution')}
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

          {/* The problem, re-readable above the argument about it, exactly as it is above a conversation */}
          <ProblemBand statement={statement[locale]} />

          {/* And the solution itself, which scrolls in its own right once it outgrows the screen */}
          <div className="scrollbar-visible max-h-[60dvh] overflow-y-auto overscroll-contain px-4 py-3 sm:px-5">
            <div className="math-typography math-reference">
              <ProblemMarkdown content={solution[locale]} />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
