'use client'

import { BookOpen } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useState } from 'react'

import { CompetitionProblemSurface } from '@/components/features/hosted-competitions/components/CompetitionProblemSurface'
import { LabelledSection } from '@/components/shared/components/LabelledSection'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { ScrollRegion } from '@/components/shared/components/ScrollRegion'
import { Tabs } from '@/components/shared/components/Tabs'
import { cn } from '@/components/shared/utils/css-utils'
import { useMinWidth } from '@/hooks/use-breakpoint'
import type { Locale } from '@/i18n/i18n'

import { hasSolution, resolveText } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * Which of the texts a problem is judged against: its solution, its grading note, or its hints.
 */
type ReferencePartId = 'solution' | 'gradingNote' | 'hints'

/**
 * One text a problem is judged against.
 */
type ReferencePart = {
  /** Which text it is. */
  id: ReferencePartId
  /** The text itself. */
  body: ReactNode
}

/**
 * Props for the {@link ReadingPane} component.
 */
type ReadingPaneProps = {
  /** What the pane holds, as it is named to the reader. */
  label: string
  /** Classes placing the pane among its neighbours. */
  className?: string
  /** What is read in the pane. */
  children: ReactNode
}

/**
 * One of the surface's panes: a {@link ScrollRegion} padded like the surface, its text held to a reading measure.
 */
function ReadingPane({ label, className, children }: ReadingPaneProps) {
  return (
    <ScrollRegion
      label={label}
      className={cn('scrollbar-visible flex-1 px-4 py-3 sm:px-5', className)}
    >
      <div className="max-w-3xl space-y-6">{children}</div>
    </ScrollRegion>
  )
}

/**
 * Props for the {@link ReferenceParts} component.
 */
type ReferencePartsProps = {
  /** The texts the problem has, the solution first. */
  parts: readonly ReferencePart[]
  /** Whether there is room for two panes side by side. */
  isWide: boolean
}

/**
 * The texts a problem is judged against, laid out by the room the screen gives. Where there is room, the solution
 * stands in a pane of its own with the rest in a narrower pane beside it, each scrolling on its own, so whatever is
 * being checked against the solution stays in view however long the solution runs. Where there is not, each text is
 * a tab.
 */
function ReferenceParts({ parts, isWide }: ReferencePartsProps) {
  // Copy for the problem's texts
  const t = useTranslations('problemSelection.text')

  // Competitions copy
  const tCompetitions = useTranslations('competitions')

  // Formats the names of several texts as one
  const format = useFormatter()

  // The text showing where each is a tab
  const [tab, setTab] = useState<ReferencePartId>(parts[0].id)

  // What each text is called
  const labels: Record<ReferencePartId, string> = {
    solution: tCompetitions('officialSolution'),
    gradingNote: t('gradingNote'),
    hints: tCompetitions('hints'),
  }

  // The solution
  const solution = parts.find((part) => part.id === 'solution')

  // Everything read against it
  const others = parts.filter((part) => part.id !== 'solution')

  // A function which sets each of the texts under its name
  const sections = (shown: readonly ReferencePart[]) =>
    shown.map((part) => (
      <LabelledSection key={part.id} label={labels[part.id]}>
        {part.body}
      </LabelledSection>
    ))

  // The solution beside everything read against it, where there is room for both
  if (isWide && solution !== undefined && others.length > 0) {
    return (
      <div className="flex min-h-0 flex-1">
        {/* The solution */}
        <ReadingPane label={labels.solution}>{sections([solution])}</ReadingPane>

        {/* Everything read against it */}
        <ReadingPane
          label={format.list(others.map((part) => labels[part.id]))}
          className="w-[24rem] flex-none border-l border-foreground/10"
        >
          {sections(others)}
        </ReadingPane>
      </div>
    )
  }

  // A single text, or room for two panes but no solution to fill one, so every text in one pane
  if (parts.length === 1 || (isWide && solution === undefined)) {
    return <ReadingPane label={t('reference')}>{sections(parts)}</ReadingPane>
  }

  // Each text a tab, named by it
  return (
    <Tabs
      ariaLabel={t('reference')}
      selectedId={tab}
      onSelect={setTab}
      items={parts.map((part) => ({
        id: part.id,
        label: labels[part.id],
        count: null,
        panel: <ReadingPane label={labels[part.id]}>{part.body}</ReadingPane>,
      }))}
    />
  )
}

/**
 * Props for the {@link ProposalSurfaces} component.
 */
type ProposalSurfacesProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
}

/**
 * What a problem is judged against: a row opening one surface with its solution, its grading note and its hints,
 * laid out by {@link ReferenceParts}. The solution and the hints are in the language being read, or the one
 * {@link resolveText} falls back to, and the note is in the one language it is written in. A problem with none of
 * them leaves no row at all.
 *
 * The surface fills the screen's height, so folding its statement away leaves it where it stands.
 */
export function ProposalSurfaces({ proposal, language }: ProposalSurfacesProps) {
  // Copy for the problem's texts
  const t = useTranslations('problemSelection.text')

  // Whether the surface is open
  const [isOpen, setIsOpen] = useState(false)

  // Whether there is room for two panes, read before the surface opens so its first frame is laid out for the screen
  const isWide = useMinWidth('lg')

  // Closed whenever the row is hidden or leaves the page, so a row kept while hidden comes back with nothing open
  useEffect(() => () => setIsOpen(false), [])

  // The text in the language being read, or the first one the problem has
  const resolved = resolveText(proposal, language)

  // Nothing written, so nothing to open
  if (resolved === null) return null

  // The solution, where the text being read has one
  const solution = hasSolution(resolved.text) ? resolved.text.solution : null

  // The solution as a text on the surface
  const solutionPart: ReferencePart | null =
    solution === null
      ? null
      : {
          id: 'solution',
          body: (
            <div className="math-typography math-reference">
              <RichMathEditorRenderer content={solution} imageContext="problems" />
            </div>
          ),
        }

  // The note, in the one language it is written in, where the problem has one
  const { gradingNote } = proposal

  // The note as a text on the surface
  const notePart: ReferencePart | null =
    gradingNote === null
      ? null
      : {
          id: 'gradingNote',
          body: (
            // The list a note is written as, set at the text's edge
            <div className="math-typography math-reference math-flush-lists">
              <RichMathEditorRenderer content={gradingNote} imageContext="problems" />
            </div>
          ),
        }

  // The hints, weakest nudge first, where the text being read has any
  const { hints } = resolved.text

  // The hints as a text on the surface
  const hintsPart: ReferencePart | null =
    hints.length === 0
      ? null
      : {
          id: 'hints',
          body: (
            // Numbered as a list written in a text is, at the text's edge like the note's list
            <div className="math-typography math-reference math-flush-lists">
              <ol className="list-decimal space-y-3">
                {hints.map((hint, index) => (
                  <li key={index}>
                    <RichMathEditorRenderer content={hint} imageContext="problems" />
                  </li>
                ))}
              </ol>
            </div>
          ),
        }

  // Each text the problem has, the solution first and then the note and the hints read against it
  const parts = [solutionPart, notePart, hintsPart].filter((part) => part !== null)

  // Nothing to judge the problem against, so no row
  if (parts.length === 0) return null

  return (
    <CompetitionProblemSurface
      label={t('reference')}
      icon={BookOpen}
      position={proposal.number}
      statement={resolved.text.statement}
      isOpen={isOpen}
      onOpen={() => setIsOpen(true)}
      onClose={() => setIsOpen(false)}
      count={null}
      isTall
      scrollsInParts
    >
      <ReferenceParts parts={parts} isWide={isWide} />
    </CompetitionProblemSurface>
  )
}
