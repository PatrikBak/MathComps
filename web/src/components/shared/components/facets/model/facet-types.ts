/**
 * A selectable value in a facet.
 */
export type FacetOption = {
  /** Identifies the option within its facet. */
  id: string
  /** The option's label. */
  displayName: string
  /** How many results carry this option. */
  count?: number
  /** The section this option belongs to, one of {@link FacetGrouping.keys}. */
  groupKey?: string
}

/**
 * A node in a hierarchical facet, where selecting a node stands for its whole subtree.
 */
export type TreeNode = FacetOption & {
  /** The node's unabbreviated name. */
  fullName?: string
  /** The nodes one level below this one. */
  children?: TreeNode[]
}

/**
 * How a tree node's checkbox reads, where `indeterminate` means part of its
 * subtree is selected.
 */
export type TreeCheckState = 'checked' | 'indeterminate' | 'unchecked'

/**
 * How a facet section orders its options.
 */
export type FacetSortMode = 'alpha' | 'count-desc' | 'count-asc'

/**
 * The labelled sections a facet's options are split into.
 */
export type FacetGrouping = {
  /** Section keys, in the order their sections are shown. */
  keys: string[]
  /** Section heading per key. */
  labels: Record<string, string>
}

/**
 * A section with at least one option to show.
 */
export type VisibleSection<T extends FacetOption = FacetOption> = {
  /** The section's key. */
  groupKey: string
  /** The options landing in it, already ordered. */
  sectionOptions: T[]
}

/**
 * Whether the values selected in a facet are combined with OR or with AND.
 */
export type FacetLogicMode = 'or' | 'and'

/**
 * How a facet combines its selected values, and how that gets changed.
 */
export type FacetLogicConfig = {
  /** The mode currently in force. */
  mode: FacetLogicMode
  /** Applies the mode the user picked. */
  onChange: (next: FacetLogicMode) => void
  /** Facet-specific wording for the two modes. */
  labels?: {
    /** Wording for the OR mode. */
    or: string
    /** Wording for the AND mode. */
    and: string
  }
}
