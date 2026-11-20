'use client'

import { BookOpen } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useState } from 'react'

import {
  CompetitionProblemSurface,
  type SurfaceSize,
} from '@/components/features/hosted-competitions/components/CompetitionProblemSurface'
import { LabelledSection } from '@/components/shared/components/LabelledSection'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { ScrollRegion } from '@/components/shared/components/ScrollRegion'
import { Tabs } from '@/components/shared/components/Tabs'
import { assertNever } from '@/components/shared/utils/assert-never'
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
 * The solution in a pane of its own, with everything read against it in a narrower pane beside it.
 */
type SideBySideLayout = {
  /** Which layout it is. */
  kind: 'sideBySide'
  /** The solution. */
  solution: ReferencePart
  /** Everything read against the solution. */
  others: readonly ReferencePart[]
}

/**
 * Every text in one pane.
 */
type OnePaneLayout = {
  /** Which layout it is. */
  kind: 'onePane'
}

/**
 * Each text a tab.
 */
type TabsLayout = {
  /** Which layout it is. */
  kind: 'tabs'
}

/**
 * How the texts a problem is judged against are laid out.
 */
type ReferenceLayout = SideBySideLayout | OnePaneLayout | TabsLayout

/**
 * How much of the screen the surface takes for each layout. One pane is a single column of text, so the surface wraps
 * it; the other layouts hold parts that scroll on their own, so it takes the screen's height.
 */
const SURFACE_SIZE: Record<ReferenceLayout['kind'], SurfaceSize> = {
  sideBySide: 'screen',
  onePane: 'text',
  tabs: 'screen',
}

/**
 * The layout the texts take, by the room the screen gives. Where there is room, the solution stands in a pane of its
 * own with the rest beside it, so whatever is being checked against the solution stays in view however long the
 * solution runs.
 *
 * @param parts - The texts the problem has, the solution first.
 * @param isWide - Whether there is room for two panes side by side.
 * @returns How the texts are laid out.
 */
function referenceLayoutOf(parts: readonly ReferencePart[], isWide: boolean): ReferenceLayout {
  // The solution
  const solution = parts.find((part) => part.id === 'solution')

  // Everything read against the solution
  const others = parts.filter((part) => part.id !== 'solution')

  // The solution beside everything read against it, where there is room for both
  if (isWide && solution !== undefined && others.length > 0) {
    return { kind: 'sideBySide', solution, others }
  }

  // A single text, or room for two panes but no solution to fill one, so every text in one pane
  if (parts.length === 1 || (isWide && solution === undefined)) return { kind: 'onePane' }

  // Each text a tab
  return { kind: 'tabs' }
}

/**
 * Props for the {@link ReferenceParts} component.
 */
type ReferencePartsProps = {
  /** The texts the problem has, the solution first. */
  parts: readonly ReferencePart[]
  /** How the texts are laid out. */
  layout: ReferenceLayout
}

/**
 * The texts a problem is judged against, in the layout {@link referenceLayoutOf} picks. Side by side, each pane
 * scrolls on its own.
 */
function ReferenceParts({ parts, layout }: ReferencePartsProps) {
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

  // A function which sets each of the texts under its name
  const sections = (shown: readonly ReferencePart[]) =>
    shown.map((part) => (
      <LabelledSection key={part.id} label={labels[part.id]}>
        {part.body}
      </LabelledSection>
    ))

  switch (layout.kind) {
    // The solution beside everything read against it
    case 'sideBySide':
      return (
        <div className="flex min-h-0 flex-1">
          {/* The solution */}
          <ReadingPane label={labels.solution}>{sections([layout.solution])}</ReadingPane>

          {/* Everything read against the solution */}
          <ReadingPane
            label={format.list(layout.others.map((part) => labels[part.id]))}
            className="w-[24rem] flex-none border-l border-foreground/10"
          >
            {sections(layout.others)}
          </ReadingPane>
        </div>
      )

    // Every text in one pane
    case 'onePane':
      return <ReadingPane label={t('reference')}>{sections(parts)}</ReadingPane>

    // Each text a tab, named by it
    case 'tabs':
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

    // No other layout exists
    default:
      return assertNever(layout)
  }
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

  // How the texts are laid out on the surface
  const layout = referenceLayoutOf(parts, isWide)

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
      size={SURFACE_SIZE[layout.kind]}
      scrollsInParts
    >
      <ReferenceParts parts={parts} layout={layout} />
    </CompetitionProblemSurface>
  )
}
