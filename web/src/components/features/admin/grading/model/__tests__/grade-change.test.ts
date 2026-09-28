import { describe, expect, it } from 'vitest'

import { applyGradeChange, markClickChange } from '../grade-change'
import type { Grade } from '../grading-types'

/** The grader every grade here was last changed by. */
const GRADER = { id: 'grader', username: 'Grader', email: null }

/**
 * Builds a grade, filling in whatever the test is not about.
 * @param fields - The fields the test is about.
 * @returns The grade.
 */
function gradeOf(fields: Partial<Grade>): Grade {
  // A pre-graded 5 with no help and no comment, overridden where the test says
  return {
    mark: 5,
    help: 0,
    internalComment: '',
    isFinal: false,
    updatedAt: '2026-09-27T10:00:00Z',
    updatedBy: GRADER,
    ...fields,
  }
}

describe('markClickChange', () => {
  it('sends only the mark for a first grade', () => {
    // Nothing given yet, so nothing else moves
    expect(markClickChange(null, 4)).toEqual({ mark: { value: 4 } })
  })

  it('takes the mark back when the chosen one is clicked again, and whatever rested on it', () => {
    // A final 5 with 2 of it from Mathilda
    const grade = gradeOf({ mark: 5, help: 2, isFinal: true })

    // Clicking 5 again leaves nothing that needs a mark
    expect(markClickChange(grade, 5)).toEqual({ mark: { value: null }, help: 0, isFinal: false })
  })

  it('pulls the help down with a mark lowered beneath it, and only then', () => {
    // A 5 with 3 of it from Mathilda
    const grade = gradeOf({ mark: 5, help: 3 })

    // Lowered under the help, and to where the help still fits
    expect(markClickChange(grade, 2)).toEqual({ mark: { value: 2 }, help: 2 })
    expect(markClickChange(grade, 4)).toEqual({ mark: { value: 4 } })
  })
})

describe('applyGradeChange', () => {
  it('tells a mark taken back apart from a mark left alone', () => {
    // A graded 5
    const grade = gradeOf({ mark: 5 })

    // Another grader
    const author = { id: 'other', username: 'Other', email: null }

    // Taken back, and left alone by a change to the comment
    expect(applyGradeChange(grade, { mark: { value: null } }, author, 'now').mark).toBeNull()
    expect(applyGradeChange(grade, { internalComment: 'Why?' }, author, 'now')).toEqual({
      ...grade,
      internalComment: 'Why?',
      updatedAt: 'now',
      updatedBy: author,
    })
  })

  it('starts a first grade from nothing given', () => {
    // A comment is all there is so far
    expect(applyGradeChange(null, { internalComment: 'Later.' }, GRADER, 'now')).toEqual({
      mark: null,
      help: 0,
      internalComment: 'Later.',
      isFinal: false,
      updatedAt: 'now',
      updatedBy: GRADER,
    })
  })
})
