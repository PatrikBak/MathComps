import { TruncatedText } from '@/components/shared/components/TruncatedText'

/**
 * The props of {@link FacetItemLabel}.
 */
type FacetItemLabelProps = {
  /** The option's name. */
  children: string
}

/**
 * An option's name, truncated at the row's width. The `min-w-0` wrapper is what lets it
 * shrink below its content width in a flex row.
 */
export function FacetItemLabel({ children }: FacetItemLabelProps) {
  return (
    <div className="min-w-0 pr-3">
      <TruncatedText className="truncate text-xs sm:text-sm font-medium">{children}</TruncatedText>
    </div>
  )
}

/**
 * The props of {@link FacetItemCount}.
 */
type FacetItemCountProps = {
  /** How many results the option carries, absent on a facet that shows no counts. */
  count: number | undefined
}

/**
 * The result count trailing an option row. It is hidden from assistive tech, which
 * reads the figure from the option's accessible name instead.
 */
export function FacetItemCount({ count }: FacetItemCountProps) {
  // A facet without counts has nothing to trail its rows with
  if (typeof count !== 'number') return null

  // Pushed to the end of the row, in figures that hold their width as they change
  return (
    <span
      className="text-right text-[10px] sm:text-xs tabular-nums text-muted shrink-0 ml-auto"
      aria-hidden="true"
    >
      {count}
    </span>
  )
}
