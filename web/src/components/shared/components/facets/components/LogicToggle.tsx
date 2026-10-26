import { useTranslations } from 'next-intl'
import type { RefObject } from 'react'

import { FLOATING_PANEL_FILL_CLASS } from '@/components/shared/components/DropdownMenu'
import { SegmentedSwitch } from '@/components/shared/components/SegmentedSwitch'
import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'

import { FACET_LOGIC_MODES, type FacetLogicConfig, type FacetLogicMode } from '../model/facet-types'

/**
 * The props of {@link LogicToggle}.
 */
type LogicToggleProps = {
  /** How the selected options are currently combined. */
  value: FacetLogicMode
  /** Applies the mode the user picked. */
  onChange: (mode: FacetLogicMode) => void
  /** Wording for each mode, when the generic copy doesn't fit the facet. */
  labels?: FacetLogicConfig['labels']
  /** The facet's search box. */
  searchRef: RefObject<HTMLInputElement | null>
}

/**
 * The choice between matching any of the selected options and matching all of them.
 */
export function LogicToggle({ value, onChange, labels, searchRef }: LogicToggleProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // What each mode reads, in the facet's own words where it has them
  const modeLabels: Record<FacetLogicMode, string> = {
    or: labels?.or ?? tFilters('logicAtLeastOne'),
    and: labels?.and ?? tFilters('logicAll'),
  }

  /**
   * Applies the mode picked. A click made with the caret in the search box hands the caret back to it, since the
   * mode's own control takes focus once the change is through.
   *
   * @param mode - The mode picked.
   */
  function handleChange(mode: FacetLogicMode) {
    // Whether the caret sits in the search box, where the press on the mode left it
    const isCaretInSearch =
      searchRef.current !== null && document.activeElement === searchRef.current

    // The mode applied
    onChange(mode)

    // Back into the search box once the mode's control has taken focus, before anything is drawn
    if (isCaretInSearch) queueMicrotask(() => searchRef.current?.focus())
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b border-foreground/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-muted',
        FLOATING_PANEL_FILL_CLASS
      )}
      // A press anywhere along the switch leaves focus where it was
      onMouseDown={preventFocusLoss}
    >
      {/* What the choice is about */}
      <span className="whitespace-nowrap">{tFilters('logic')}</span>

      {/* The modes */}
      <SegmentedSwitch
        value={value}
        onChange={handleChange}
        ariaLabel={tFilters('selectionLogic')}
        options={FACET_LOGIC_MODES.map((mode) => ({ value: mode, label: modeLabels[mode] }))}
        compactOnPhones
      />
    </div>
  )
}
