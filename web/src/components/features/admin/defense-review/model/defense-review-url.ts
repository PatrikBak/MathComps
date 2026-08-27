import type { DefenseReviewFilter } from './defense-review-types'

/**
 * The query parameter naming the conversation being read.
 */
const OPEN_PARAM = 'open'

/**
 * The filter's one three-way field: carrying notes, carrying none, or not asked at all, which is why it is
 * written out as 1 and 0 instead of by presence.
 */
const THREE_WAY_FLAG_FIELDS = ['hasNotes'] as const

/**
 * The filter's yes-or-nothing fields, which only ever narrow to the case they name. Written by presence, since
 * a false one asks for the same conversations as leaving it out and would otherwise read as a filter that is
 * on while narrowing nothing.
 */
const ONE_WAY_FLAG_FIELDS = ['unread', 'studentReported', 'studentFeedback'] as const

/**
 * The furthest back a period may reach, in days. A hand-typed one beyond this is somebody's typing rather than
 * a period, and a large enough one overflows the date arithmetic the query does with it.
 */
const MAX_WITHIN_DAYS = 3650

/**
 * How a period is spelled in the address: a plain run of digits. Number reads far more than that, taking
 * `0x10` for sixteen days and `1e3`, `7.0` and a padded ` 7 ` for periods nobody typed.
 */
const WITHIN_DAYS_PATTERN = /^\d+$/

/**
 * How a student's id is spelled. The backend binds it to a GUID, so text of any other shape is not a
 * narrowing that matches nobody but a request it refuses outright, leaving the queue on a failure the
 * reader can only retry into the same answer.
 */
const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The filter's free-text fields, which go into the address as they stand.
 */
const TEXT_FIELDS = [
  'userId',
  'handoutContentId',
  'environmentId',
  'problemSlug',
  'promptVersion',
] as const

/**
 * What the queue is showing, as the address bar carries it.
 */
export type DefenseReviewUrlState = {
  /** Which conversations the queue is narrowed to. */
  filter: DefenseReviewFilter
  /** The conversation being read; null while none is. */
  openId: string | null
}

/**
 * Writes what the queue is showing into query parameters, so a reload comes back to it and the address can be
 * handed to somebody else.
 *
 * @param state - What the queue is showing.
 * @returns The query string, without its leading question mark; empty when nothing is worth carrying.
 */
export function toDefenseReviewQuery(state: DefenseReviewUrlState): string {
  // What the address will carry
  const params = new URLSearchParams()

  // The notes field, written either way round so that "carries no notes" survives as well as "carries some"
  THREE_WAY_FLAG_FIELDS.forEach((field) => {
    // What the queue is asking of it
    const value = state.filter[field]

    // Only a field that was asked about goes into the address
    if (value !== undefined) params.set(field, value ? '1' : '0')
  })

  // The fields that only narrow one way, which are there or they aren't
  ONE_WAY_FLAG_FIELDS.forEach((field) => {
    // Only the narrowing case is worth writing down
    if (state.filter[field] === true) params.set(field, '1')
  })

  // The fields naming a student, a handout, either kind of problem, or a set of settings
  TEXT_FIELDS.forEach((field) => {
    // What it was narrowed to
    const value = state.filter[field]

    // Empty text travels as if it had never been typed
    if (value !== undefined && value !== '') params.set(field, value)
  })

  // A problem's id only means anything alongside its handout's, so a half-named problem stays out of the
  // address rather than being written into one that reads back as something else
  if (!params.has('handoutContentId')) params.delete('environmentId')

  // A conversation is held against one problem, so an address naming one of each kind narrows to nothing.
  // The handout is the one that stands, since it takes two fields to name and so is the harder to arrive at
  // by hand.
  if (params.has('handoutContentId')) params.delete('problemSlug')

  // How recently the conversation must have moved
  if (state.filter.withinDays !== undefined) {
    // The period travels as the plain count of days
    params.set('withinDays', String(state.filter.withinDays))
  }

  // And which one is open, so a link lands on the conversation rather than on the queue around it
  if (state.openId !== null) params.set(OPEN_PARAM, state.openId)

  // Sorted, so the same queue always produces the same address
  params.sort()

  // The address's query, ready to hang off the queue's path
  return params.toString()
}

/**
 * Reads back what {@link toDefenseReviewQuery} wrote. Anything the address carries that isn't one of ours, or
 * isn't shaped like the field it names, is left out rather than trusted: a query string is somebody's typing.
 *
 * @param params - The address's query parameters.
 * @returns What the queue should show.
 */
export function fromDefenseReviewQuery(params: URLSearchParams): DefenseReviewUrlState {
  // What the address turned out to be asking for
  const filter: DefenseReviewFilter = {}

  // The notes field, which only 1 and 0 mean anything for
  THREE_WAY_FLAG_FIELDS.forEach((field) => {
    // What the address says about it
    const value = params.get(field)

    // Asked for the conversations carrying notes
    if (value === '1') filter[field] = true
    // Asked for the ones carrying none
    else if (value === '0') filter[field] = false
  })

  // The fields that only narrow one way, where anything but a 1 asks for the same conversations as nothing
  ONE_WAY_FLAG_FIELDS.forEach((field) => {
    // Take it as asked for
    if (params.get(field) === '1') filter[field] = true
  })

  // The fields naming something, where non-empty text is kept unless it is shaped wrong for the wire
  TEXT_FIELDS.forEach((field) => {
    // What the address names it as
    const value = params.get(field)

    // Nothing to match on
    if (value === null || value === '') return

    // The student's id is the one field the wire won't take an arbitrary string for
    if (field === 'userId' && !USER_ID_PATTERN.test(value)) return

    // Keep it as written
    filter[field] = value
  })

  // How far back the address asks the queue to reach, as it was written down
  const withinDaysParam = params.get('withinDays')

  // Read only when it is spelled the way a period is, so nothing else reaches the count
  const withinDays =
    withinDaysParam !== null && WITHIN_DAYS_PATTERN.test(withinDaysParam)
      ? Number(withinDaysParam)
      : null

  // A period of no days asks for nothing, and one past the cap is somebody's typing rather than a period
  if (withinDays !== null && withinDays > 0 && withinDays <= MAX_WITHIN_DAYS) {
    // Narrow to it as typed
    filter.withinDays = withinDays
  }

  // A problem's id only means anything alongside its handout's, so a half-named problem narrows nothing
  if (filter.environmentId !== undefined && filter.handoutContentId === undefined) {
    // Drop it and leave the rest of the narrowing standing
    delete filter.environmentId
  }

  // And an address naming a problem of each kind narrows to nothing, the handout being the one that stands
  if (filter.handoutContentId !== undefined) {
    // Drop the archive one and leave the rest of the narrowing standing
    delete filter.problemSlug
  }

  // Which conversation to open, if the address names one
  const openId = params.get(OPEN_PARAM)

  // The queue as the address describes it, an empty name read as naming nothing
  return { filter, openId: openId === null || openId === '' ? null : openId }
}
