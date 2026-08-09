import type { HandoutEnvironmentTarget } from '@/components/features/handouts/handout-metadata-types'

import type { DefenseReviewFilter } from './defense-review-types'

/**
 * A filter narrowing nothing, which is where the queue starts and what clearing returns it to.
 */
export const EMPTY_DEFENSE_REVIEW_FILTER: DefenseReviewFilter = {}

/**
 * Reduces a filter to a string, so two filterings that narrow to the same conversations key as one query however
 * their fields happened to be built up. Sorted by field name, and leaving out whatever is not set.
 *
 * @param filter - The filter to reduce.
 * @returns The filter as one string.
 */
export function serializeFilter(filter: DefenseReviewFilter): string {
  // Every field that is actually set, as name and value
  const parts = Object.entries(filter)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}=${String(value)}`)

  // Sorted, so the order the fields were set in can't key one filtering as two
  return parts.sort().join('&')
}

/**
 * Replaces one of a filter's fields, dropping it entirely when it stops narrowing anything.
 *
 * An unset field is left out rather than held as undefined, which is what keeps a filter's fields and the ones
 * that are actually narrowing something one and the same set.
 *
 * @param filter - The filter as it stands.
 * @param field - The field to replace.
 * @param value - What it should now be; undefined to stop it narrowing anything.
 *
 * @returns The filter as it now stands.
 */
export function withFilterField<TField extends keyof DefenseReviewFilter>(
  filter: DefenseReviewFilter,
  field: TField,
  value: DefenseReviewFilter[TField]
): DefenseReviewFilter {
  // The filter as it stands, to replace the one field on
  const next = { ...filter }

  // Nothing to narrow by, so the field goes
  if (value === undefined) {
    delete next[field]
  } else {
    // Otherwise it narrows by whatever it was set to
    next[field] = value
  }

  // The filter with that one field replaced
  return next
}

/**
 * Counts how many of a filter's fields are actually narrowing anything, which is what decides whether the queue
 * offers to clear them.
 *
 * @param filter - The filter to count.
 * @returns How many fields are set.
 */
export function countActiveFilters(filter: DefenseReviewFilter): number {
  // A field left out narrows nothing
  return Object.values(filter).filter((value) => value !== undefined).length
}

/**
 * What the signals facet holds, which is three of the filter's fields offered as one set of options.
 */
export type DefenseReviewSignals = Pick<
  DefenseReviewFilter,
  'hasNotes' | 'studentReported' | 'studentFeedback'
>

/**
 * Reads a filter as the signal options standing for it.
 *
 * @param filter - The filter to read.
 * @returns The ids of the options it stands for.
 */
export function toSignalSelection(filter: DefenseReviewFilter): string[] {
  // One option per field that is narrowing something, the notes field standing for either of its pair
  return [
    ...(filter.hasNotes === true ? ['hasNotes'] : []),
    ...(filter.hasNotes === false ? ['noNotes'] : []),
    ...(filter.studentReported === true ? ['reported'] : []),
    ...(filter.studentFeedback === true ? ['feedback'] : []),
  ]
}

/**
 * Reads a signal selection back into the fields it stands for.
 *
 * Carrying notes and carrying none are two options over one field, so picking one has to unseat the other rather
 * than lose to whichever is read first. Which is why the filter as it stands is needed to read the new selection:
 * it is what says which of the pair was just added.
 *
 * @param selected - The ids of the options now picked.
 * @param filter - The filter as it stands.
 * @returns The fields those options stand for.
 */
export function readSignalSelection(
  selected: string[],
  filter: DefenseReviewFilter
): DefenseReviewSignals {
  // Whichever of the pair was just added, since the one already standing is the one being replaced
  const addedNotesSignal = selected.find(
    (signal) =>
      (signal === 'hasNotes' && filter.hasNotes !== true) ||
      (signal === 'noNotes' && filter.hasNotes !== false)
  )

  // What that leaves the field standing at
  const notesSignal =
    addedNotesSignal ?? selected.find((signal) => signal === 'hasNotes' || signal === 'noNotes')

  // The three fields as the selection now has them, an unpicked one narrowing nothing
  return {
    hasNotes: notesSignal === 'hasNotes' ? true : notesSignal === 'noNotes' ? false : undefined,
    studentReported: selected.includes('reported') ? true : undefined,
    studentFeedback: selected.includes('feedback') ? true : undefined,
  }
}

/**
 * Reduces a problem to one string, so it can be an option's id and be read back from the reader's selection.
 * Both halves are needed, since a problem's own id only means anything within its handout.
 *
 * @param target - The problem.
 * @returns The problem as one id.
 */
export function encodeProblemKey(target: HandoutEnvironmentTarget): string {
  // The two ids joined; both are nanoids, so the separator can't appear inside either
  return `${target.handoutContentId}:${target.environmentId}`
}

/**
 * Reads a problem back out of the id {@link encodeProblemKey} made.
 *
 * @param key - The id to read.
 * @returns The problem, or null when the id isn't one of ours.
 */
export function decodeProblemKey(key: string): HandoutEnvironmentTarget | null {
  // The two halves
  const [handoutContentId, environmentId] = key.split(':')

  // Anything else came from somewhere other than encodeProblemKey
  if (!handoutContentId || !environmentId) return null

  // The problem it names
  return { handoutContentId, environmentId }
}
