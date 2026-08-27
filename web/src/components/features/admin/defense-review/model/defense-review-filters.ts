import { assertNever } from '@/components/shared/utils/assert-never'

import type { DefenseReviewFilter, DefenseReviewTarget } from './defense-review-types'

/**
 * Sits between the parts of a problem's key. Every part is a slug or a nanoid, so it can't appear inside one.
 */
const PROBLEM_KEY_SEPARATOR = ':'

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
 * Which problem a filter narrows to. A conversation is held against a handout problem or an archive one, so a
 * filter naming a problem sets one arm's fields and leaves the other's unset.
 */
export type DefenseReviewProblemFields = Pick<
  DefenseReviewFilter,
  'handoutContentId' | 'environmentId' | 'problemSlug'
>

/**
 * What a problem key names before its own address: which kind of problem it is, since a handout problem and an
 * archive one are addressed by different things and one key has to be read back as the right one.
 */
const PROBLEM_KEY_KINDS = { handout: 'handout', problem: 'problem' } as const

/**
 * Reduces a problem to one string, so it can be an option's id and be read back from the reader's selection.
 *
 * @param target - The problem.
 * @returns The problem as one id.
 */
export function encodeProblemKey(target: DefenseReviewTarget): string {
  switch (target.kind) {
    // A handout problem, which both of its ids are needed to locate
    case 'handout':
      return handoutProblemKey(target.handoutContentId, target.environmentId)

    // An archive problem, which one slug addresses
    case 'problem':
      return archiveProblemKey(target.slug)

    // An arm nothing here knows
    default:
      return assertNever(target)
  }
}

/**
 * The key a handout problem reads under.
 *
 * @param handoutContentId - The handout's permanent content id.
 * @param environmentId - The environment's permanent id, unique within its handout.
 *
 * @returns The problem as one id.
 */
function handoutProblemKey(handoutContentId: string, environmentId: string): string {
  // Both halves, since a problem's own id only means anything within its handout
  return [PROBLEM_KEY_KINDS.handout, handoutContentId, environmentId].join(PROBLEM_KEY_SEPARATOR)
}

/**
 * The key an archive problem reads under.
 *
 * @param slug - The problem's slug, unique across the archive.
 * @returns The problem as one id.
 */
function archiveProblemKey(slug: string): string {
  // The slug addresses it on its own
  return [PROBLEM_KEY_KINDS.problem, slug].join(PROBLEM_KEY_SEPARATOR)
}

/**
 * Reads an id back into the fields it narrows by, undoing what {@link encodeProblemKey} wrote.
 *
 * @param key - The id to read.
 * @returns The fields it narrows by, or null when the id isn't one of ours.
 */
export function decodeProblemKey(key: string): DefenseReviewProblemFields | null {
  // What the key names, its kind leading
  const [kind, ...address] = key.split(PROBLEM_KEY_SEPARATOR)

  // A handout problem, which stands only once both of its halves do
  if (kind === PROBLEM_KEY_KINDS.handout && address.length === 2 && address.every(Boolean)) {
    return { handoutContentId: address[0], environmentId: address[1] }
  }

  // An archive problem, which one slug addresses
  if (kind === PROBLEM_KEY_KINDS.problem && address.length === 1 && address[0] !== '') {
    return { problemSlug: address[0] }
  }

  // Anything else came from somewhere other than encodeProblemKey
  return null
}

/**
 * Reads the problem a filter narrows to back as the key its option carries, so the facet can show which of its
 * options is the one standing.
 *
 * @param filter - The filter as it stands.
 * @returns The key, or null while the filter names no problem.
 */
export function problemKeyOf(filter: DefenseReviewFilter): string | null {
  // A handout problem, which only stands once both halves are set
  if (filter.handoutContentId !== undefined && filter.environmentId !== undefined) {
    return handoutProblemKey(filter.handoutContentId, filter.environmentId)
  }

  // An archive problem, addressed by its slug
  if (filter.problemSlug !== undefined) {
    return archiveProblemKey(filter.problemSlug)
  }

  // The filter narrows to every problem
  return null
}
