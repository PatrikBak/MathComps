import { describe, expect, it, vi } from 'vitest'

import {
  type FilterPillGroup,
  getActiveSelections,
  makeFilterGroup,
} from '../components/guide-filter-model'

/**
 * A country dimension offering only SK and CZ (a facet list missing PL), with the given current
 * selection, plus the leading "all" reset.
 *
 * @param selected - The current selection, or null for "all".
 * @returns The assembled filter group.
 */
const countryGroup = (selected: string | null): FilterPillGroup =>
  makeFilterGroup<string>(
    'country',
    'Country',
    'All',
    [
      { value: 'SK', label: 'Slovakia' },
      { value: 'CZ', label: 'Czechia' },
    ],
    selected,
    vi.fn()
  )

describe('getActiveSelections', () => {
  it('omits a dimension resting on "all"', () => {
    // A null selection is the "all" reset — no chip
    expect(getActiveSelections([countryGroup(null)])).toEqual([])
  })

  it('surfaces a chip labeled by the selected option', () => {
    // Resolve the chips for a concrete SK selection
    const selections = getActiveSelections([countryGroup('SK')])
    // One chip, labeled by the matched option
    expect(selections).toHaveLength(1)
    expect(selections[0]).toMatchObject({ key: 'country', label: 'Slovakia' })
  })

  it('drops a selection absent from the options instead of showing a blank chip', () => {
    // A stale/foreign URL value (PL on a page offering only SK/CZ) resolves to no option
    expect(getActiveSelections([countryGroup('PL')])).toEqual([])
  })

  it('clearing a chip sends its dimension back to "all"', () => {
    // Spy on the dimension's onSelect
    const onSelect = vi.fn()
    // Build an SK group wired to the spy
    const group: FilterPillGroup = { ...countryGroup('SK'), onSelect }
    // Fire the chip's clear handler
    getActiveSelections([group])[0].onClear()
    // It resets the dimension to "all"
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
