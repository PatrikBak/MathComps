import type { FacetOption, LabeledSlug } from '../types/problem-api-types'

/**
 * Puts the values filtered on into the order their facet offers them in. A value the facet no longer offers goes to
 * the end, keeping its place among the others like it.
 *
 * @param values - The values filtered on.
 * @param facetOptions - The facet's options, in the order it offers them.
 * @returns The same values, in the facet's order.
 */
export function sortByFacetOrder<TValue extends Pick<LabeledSlug, 'slug'>>(
  values: TValue[],
  facetOptions: Pick<FacetOption, 'slug'>[]
): TValue[] {
  // Where each value sits in the facet
  const positions = new Map(facetOptions.map((option, index) => [option.slug, index]))

  // A function giving a value's place in the facet, past every offered one when the facet no longer offers it
  const positionOf = (value: TValue) => positions.get(value.slug) ?? Number.MAX_SAFE_INTEGER

  // Earlier in the facet means earlier in the result
  return [...values].sort((first, second) => positionOf(first) - positionOf(second))
}

/**
 * Names a value filtered on as its facet does, holding the name steady when filtering elsewhere drops the value out of
 * the current counts. A value neither set of options knows reads as its slug.
 *
 * @param slug - The value to name.
 * @param currentOptions - The facet's options under the current filters.
 * @param baseOptions - The facet's options across everything, whatever is filtered.
 * @returns The value's name.
 */
export function facetValueName(
  slug: string,
  currentOptions: FacetOption[],
  baseOptions: FacetOption[]
): string {
  // The name under the current counts, then across everything, then the slug itself
  return (
    currentOptions.find((option) => option.slug === slug)?.displayName ??
    baseOptions.find((option) => option.slug === slug)?.displayName ??
    slug
  )
}
