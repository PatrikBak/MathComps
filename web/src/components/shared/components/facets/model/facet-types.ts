/**
 * A selectable value in a facet.
 */
export type FacetOption = {
  /** Identifies the option within its facet. */
  id: string
  /** The option's label. */
  displayName: string
  /** The option's name in full, where its label is only as much of it as its surroundings leave to say. */
  fullName?: string
  /** How many results carry this option. */
  count?: number
  /** The section this option belongs to, one of {@link FacetGrouping.keys}. */
  groupKey?: string
}

/**
 * A node in a hierarchical facet, where selecting a node stands for its whole subtree.
 */
export type TreeNode = FacetOption & {
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
 * How many of a facet's options may stand at once, which is what the rows are drawn as: a facet whose field
 * holds one value gets radios, one that takes several gets checkboxes.
 */
export type FacetSelectionMode = 'single' | 'multiple'

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
 * What a key asks of the row focus sits on, beyond moving off it.
 */
export type FacetRowAction = 'collapse' | 'expand' | 'cycle-sort'

/**
 * Applies a key's action to the row focus sits on, answering whether it did anything. A row with nothing to do
 * answers no, and the key goes back to the browser rather than being swallowed by a handler with no use for it.
 *
 * @param rowId - The row focus sits on.
 * @param action - What the key asked of it.
 * @param focusRow - Moves focus onto another row, for an action that takes the reader elsewhere.
 * @returns Whether the row acted.
 */
export type FacetRowActionHandler = (
  rowId: string,
  action: FacetRowAction,
  focusRow: (rowId: string) => void
) => boolean

/** The ways a facet can combine its selected values, in the order a facet offers them. */
export const FACET_LOGIC_MODES = ['or', 'and'] as const

/**
 * Whether the values selected in a facet are combined with OR or with AND.
 */
export type FacetLogicMode = (typeof FACET_LOGIC_MODES)[number]

/**
 * How a facet combines its selected values, and how that gets changed.
 */
export type FacetLogicConfig = {
  /** The mode currently in force. */
  mode: FacetLogicMode
  /** Applies the mode the user picked. */
  onChange: (next: FacetLogicMode) => void
  /** Facet-specific wording for each mode. */
  labels?: {
    /** Wording for the OR mode. */
    or: string
    /** Wording for the AND mode. */
    and: string
  }
}

/**
 * The search a facet offers over what it lists.
 */
export type FacetSearchConfig = {
  /** Prompt shown in the empty search box. */
  placeholder: string
}
