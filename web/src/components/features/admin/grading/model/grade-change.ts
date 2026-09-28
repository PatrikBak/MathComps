import type { UserIdentity } from '@/components/features/admin/model/user-identity'

import type { Grade, GradeChange } from './grading-types'

/**
 * Works out the change a click on a mark makes.
 *
 * Clicking the chosen mark again takes it back, and with it the help and the final flag, since neither means
 * anything without a mark. A mark below the help pulls the help down to it, since the help is a part of the mark.
 *
 * @param grade - The grade as it stands; null while none has been given.
 * @param mark - The mark clicked.
 *
 * @returns The change, carrying only the fields it moves.
 */
export function markClickChange(grade: Grade | null, mark: number): GradeChange {
  // The help and the final flag as they stand, which a grade not yet given holds at none
  const help = grade?.help ?? 0
  const isFinal = grade?.isFinal ?? false

  // The chosen mark clicked again, taking it back along with whatever rested on it
  if (grade?.mark === mark) {
    return {
      mark: { value: null },
      ...(help !== 0 && { help: 0 }),
      ...(isFinal && { isFinal: false }),
    }
  }

  // The help, never more than the new mark
  const cappedHelp = Math.min(help, mark)

  // The new mark, with the help only where the mark pulled it down
  return { mark: { value: mark }, ...(cappedHelp !== help && { help: cappedHelp }) }
}

/**
 * Works out the change a click on a help value makes.
 *
 * @param grade - The grade as it stands.
 * @param help - The help value clicked.
 *
 * @returns The change, where clicking the chosen value again takes the help back to none; null when the click
 * moves nothing.
 */
export function helpClickChange(grade: Grade, help: number): GradeChange | null {
  // The chosen value clicked again goes back to none
  const nextHelp = help === grade.help ? 0 : help

  // Nothing to send where the help stays where it is
  return nextHelp === grade.help ? null : { help: nextHelp }
}

/**
 * Lands a change on a grade as the grader makes it, stamped with the grader and the time.
 *
 * @param grade - The grade as it stands; null while none has been given.
 * @param change - What changed.
 * @param author - The grader making the change.
 * @param changedAt - When the change was made, as an ISO-8601 string.
 *
 * @returns The grade as the change leaves it.
 */
export function applyGradeChange(
  grade: Grade | null,
  change: GradeChange,
  author: UserIdentity,
  changedAt: string
): Grade {
  // Every field the change carries replaces the one standing, and the change's author and time replace the grade's
  return {
    mark: change.mark === undefined ? (grade?.mark ?? null) : change.mark.value,
    help: change.help ?? grade?.help ?? 0,
    internalComment: change.internalComment ?? grade?.internalComment ?? '',
    isFinal: change.isFinal ?? grade?.isFinal ?? false,
    updatedAt: changedAt,
    updatedBy: author,
  }
}
