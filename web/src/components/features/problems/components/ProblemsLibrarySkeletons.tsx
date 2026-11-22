import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'

import { PROBLEM_CARD_LAYOUTS } from '../constants/problem-card-layouts'
import type { ProblemCardView } from '../types/problem-card-types'

/**
 * A pulsing placeholder in the shape of the filter sidebar.
 */
export function FilterSkeleton() {
  return (
    <div className="flex flex-col space-y-4 animate-pulse">
      <div className="h-8 w-32 bg-foreground/10 rounded" />
      {Array.from({ length: 3 }, (_unused, index) => (
        <div key={index} className="h-6 w-64 bg-foreground/10 rounded" />
      ))}
    </div>
  )
}

/**
 * A pulsing placeholder in the shape of the bar over the list.
 */
export function ActiveFilterBarSkeleton() {
  return (
    <div className="flex animate-pulse items-center justify-between">
      <div className="h-5 w-48 rounded-md bg-foreground/10"></div>
      <div className="h-5 w-24 rounded-md bg-foreground/10"></div>
    </div>
  )
}

/**
 * Props for the {@link ProblemCardSkeleton} component.
 */
type ProblemCardSkeletonProps = {
  /** How the card it stands in for is drawn. */
  view: ProblemCardView
}

/**
 * A pulsing placeholder in the shape of a problem's card, held while the problems are on their way.
 */
function ProblemCardSkeleton({ view }: ProblemCardSkeletonProps) {
  // How the card it stands in for is laid out
  const layout = PROBLEM_CARD_LAYOUTS[view]

  return (
    <SurfacePanel radius="xl" className={cn('animate-pulse', layout.paddingClass)}>
      {/* Header: the number and the name, then the actions where the card has them */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-foreground/10" />
        {layout.hasDetails && <div className="h-4 w-32 rounded bg-foreground/10" />}
      </div>

      {/* Statement */}
      <div className={cn('space-y-2.5', layout.statementGapClass)}>
        <div className="h-3.5 w-full rounded bg-foreground/10" />
        <div className="h-3.5 w-5/6 rounded bg-foreground/10" />
        <div className="h-3.5 w-2/3 rounded bg-foreground/10" />
      </div>

      {/* Footer: the tags and the rows, where the card has them */}
      {layout.hasDetails && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="h-5 w-24 rounded-full bg-foreground/10" />
            <div className="h-5 w-20 rounded-full bg-foreground/10" />
          </div>
          <div className="h-4 w-20 rounded bg-foreground/10" />
        </div>
      )}
    </SurfacePanel>
  )
}

/**
 * The props of {@link CardSkeletons}.
 */
type CardSkeletonsProps = {
  /** How the cards they stand in for are drawn. */
  view: ProblemCardView
}

/**
 * Two placeholder cards, standing in for a list on its way.
 */
export function CardSkeletons({ view }: CardSkeletonsProps) {
  // The room each card keeps below itself in that view
  const { spacingBelowClass } = PROBLEM_CARD_LAYOUTS[view]

  return (
    <div className="pr-2">
      <div className={spacingBelowClass}>
        <ProblemCardSkeleton view={view} />
      </div>
      <div className={spacingBelowClass}>
        <ProblemCardSkeleton view={view} />
      </div>
    </div>
  )
}
