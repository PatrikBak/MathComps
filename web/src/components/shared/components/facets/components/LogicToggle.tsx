import { useTranslations } from 'next-intl'

import { FLOATING_PANEL_FILL_CLASS } from '@/components/shared/components/DropdownMenu'
import { SegmentedSwitch } from '@/components/shared/components/SegmentedSwitch'
import { cn } from '@/components/shared/utils/css-utils'

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
}

/**
 * The choice between matching any of the selected options and matching all of them.
 */
export function LogicToggle({ value, onChange, labels }: LogicToggleProps) {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  // What each mode reads, in the facet's own words where it has them
  const modeLabels: Record<FacetLogicMode, string> = {
    or: labels?.or ?? tFilters('logicAtLeastOne'),
    and: labels?.and ?? tFilters('logicAll'),
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 border-b border-foreground/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs text-muted',
        FLOATING_PANEL_FILL_CLASS
      )}
    >
      {/* What the choice is about */}
      <span className="whitespace-nowrap">{tFilters('logic')}</span>

      {/* The modes */}
      <SegmentedSwitch
        value={value}
        onChange={onChange}
        ariaLabel={tFilters('selectionLogic')}
        options={FACET_LOGIC_MODES.map((mode) => ({ value: mode, label: modeLabels[mode] }))}
        compactOnPhones
      />
    </div>
  )
}
