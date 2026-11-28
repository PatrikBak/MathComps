'use client'

import type { CSSProperties } from 'react'

import { HueBadge } from '@/components/shared/components/HueBadge'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { hueTextStyle } from '@/components/shared/utils/hue-colors'

import { useRecommendationTargetName } from '../hooks/use-recommendation-target-name'
import {
  recommendationTargetsOf,
  recommendedKeysOf,
  targetHue,
  targetKeyOf,
} from '../model/recommendation-targets'
import { type BoardSlot, categoryHue, slotLabel, type SlotPosition } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'
import { useLoadedSelection } from './SelectionWorkspaceProvider'

/**
 * The look of a mark warning about a problem, in the theme's warning colour.
 */
export const WARNING_MARK_CLASS = 'rounded-md bg-warning/10 text-warning'

/** How a slot's square stands: empty, holding a problem, or picked out from the rest. */
export type SlotSquareState = 'empty' | 'filled' | 'highlighted'

/** The look of a slot's square. */
export type SlotSquareLook = {
  /** The square's classes. */
  className: string
  /** The square's colour, where it wears its paper's. */
  style: CSSProperties
}

/**
 * The look of a slot's square for how it stands, a filled one in its paper's colour.
 *
 * @param state - How the slot stands.
 * @param hue - The hue of the paper's category, by its index; null for none.
 *
 * @returns The look.
 */
export function slotSquareLook(state: SlotSquareState, hue: number | null): SlotSquareLook {
  // Each state its own look
  switch (state) {
    // A dashed outline around nothing
    case 'empty':
      return {
        className: 'text-muted outline-1 -outline-offset-1 outline-dashed outline-foreground/25',
        style: {},
      }

    // A faint fill, in the paper's colour
    case 'filled':
      return { className: 'bg-foreground/[0.06]', style: hueTextStyle(hue) }

    // The brand's fill
    case 'highlighted':
      return { className: 'bg-brand/50 text-brand-foreground', style: {} }

    // Every state is handled above
    default:
      return assertNever(state)
  }
}

/**
 * Props for the {@link SlotNumber} component.
 */
type SlotNumberProps = SlotPosition & {
  /** How the slot stands, highlighted while it waits for a problem from the pool. */
  state: SlotSquareState
}

/**
 * The slot's short label, like E2, in a small square that says how the slot stands.
 */
export function SlotNumber({ paper, index, state }: SlotNumberProps) {
  // The selection's categories, in the order they run
  const { categories } = useLoadedSelection()

  // How the square looks for how the slot stands
  const look = slotSquareLook(state, categoryHue(categories, paper.category))

  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums',
        look.className
      )}
      style={look.style}
    >
      {slotLabel(paper, index)}
    </span>
  )
}

/**
 * Props for the {@link RecommendedMarks} component.
 */
type RecommendedMarksProps = {
  /** The proposal whose recommendations are shown. */
  proposal: Proposal
}

/**
 * What a proposal is recommended for, a badge per recommendation target in the order they run: a category in its own
 * colour, a paper in the page's text colour. A recommendation for anything that isn't a target, such as a finalized
 * board's paper, shows no badge.
 */
export function RecommendedMarks({ proposal }: RecommendedMarksProps) {
  // The selection's categories, in the order they run, and its boards
  const { categories, boards } = useLoadedSelection()

  // What each recommendation target is called
  const targetName = useRecommendationTargetName()

  // The keys of what the proposal is recommended for
  const recommended = recommendedKeysOf(proposal)

  // A badge per target the proposal is recommended for
  return recommendationTargetsOf(categories, boards)
    .filter((target) => recommended.includes(targetKeyOf(target)))
    .map((target) => (
      <HueBadge
        key={targetKeyOf(target)}
        label={targetName(target)}
        hue={targetHue(categories, target)}
        size="small"
      />
    ))
}

/**
 * Props for the {@link PlacementMark} component.
 */
type PlacementMarkProps = {
  /** Where the proposal sits. */
  placement: BoardSlot
}

/**
 * One slot a proposal fills, named by its board and its short label, like "October 2026 E2".
 */
export function PlacementMark({ placement }: PlacementMarkProps) {
  // The selection's categories, in the order they run
  const { categories } = useLoadedSelection()

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground/[0.06] px-1.5 py-0.5 text-xs">
      {/* The board */}
      <span className="text-muted">{placement.board.name}</span>

      {/* The slot's short label, in its paper's colour */}
      <span
        className="font-semibold tabular-nums"
        style={hueTextStyle(categoryHue(categories, placement.paper.category))}
      >
        {slotLabel(placement.paper, placement.index)}
      </span>
    </span>
  )
}
