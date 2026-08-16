// Whether a problem the reader has just edited still belongs on the screen they edited it from, and
// whether a screen turns on the state they moved at all. Each case is a filter the reader can move
// from the problem itself, read in both directions.

import { describe, expect, it } from 'vitest'

import { belongsUnderFilters, filtersOnState } from '../utils/problem-view-membership'
import { noFilters, problemWith } from './support/problem-fixtures'

describe('a screen of the reader’s own likes', () => {
  it('keeps a problem they like', () => {
    // A liked problem, read under the favorites filter
    expect(
      belongsUnderFilters({ ...noFilters, favoritesOnly: true }, problemWith({ liked: true }))
    ).toBe(true)
  })

  it('has no place for one they have taken the like off', () => {
    // The same problem once the like is gone
    expect(
      belongsUnderFilters({ ...noFilters, favoritesOnly: true }, problemWith({ liked: false }))
    ).toBe(false)
  })
})

describe('a screen filtered by the reader’s marks', () => {
  it('keeps a marked problem where marked ones are asked for', () => {
    // A marked problem under the mark filter
    expect(
      belongsUnderFilters({ ...noFilters, markStatus: 'marked' }, problemWith({ marked: true }))
    ).toBe(true)
  })

  it('has no place for an unmarked one there', () => {
    // The same screen, a problem whose mark has just come off
    expect(
      belongsUnderFilters({ ...noFilters, markStatus: 'marked' }, problemWith({ marked: false }))
    ).toBe(false)
  })

  it('has no place for a marked one where unmarked ones are asked for', () => {
    // The filter read the other way round
    expect(
      belongsUnderFilters({ ...noFilters, markStatus: 'unmarked' }, problemWith({ marked: true }))
    ).toBe(false)
  })
})

describe('a list being browsed', () => {
  it('keeps a problem the list holds', () => {
    // A problem in the list on screen
    expect(
      belongsUnderFilters(
        { ...noFilters, listContentId: 'list-a' },
        problemWith({ listContentIds: ['list-a'] })
      )
    ).toBe(true)
  })

  it('has no place for one taken out of it', () => {
    // The same problem, now in some other list only
    expect(
      belongsUnderFilters(
        { ...noFilters, listContentId: 'list-a' },
        problemWith({ listContentIds: ['list-b'] })
      )
    ).toBe(false)
  })
})

describe('a screen filtering none of it', () => {
  it('keeps whatever it was given', () => {
    // A problem the reader likes nothing about, on a screen that asked nothing of them
    expect(belongsUnderFilters(noFilters, problemWith())).toBe(true)
  })

  it('keeps it where there are no filters at all', () => {
    // Which is what a problem drawn outside any filtered screen amounts to
    expect(belongsUnderFilters(null, problemWith())).toBe(true)
  })
})

describe('several filters at once', () => {
  it('has no place for a problem that answers only one of them', () => {
    // Liked, as the screen asks, but unmarked where it asks for marked
    expect(
      belongsUnderFilters(
        { ...noFilters, favoritesOnly: true, markStatus: 'marked' },
        problemWith({ liked: true, marked: false })
      )
    ).toBe(false)
  })

  it('keeps a problem that answers every one of them', () => {
    // The same screen, a problem the reader both likes and has marked
    expect(
      belongsUnderFilters(
        { ...noFilters, favoritesOnly: true, markStatus: 'marked' },
        problemWith({ liked: true, marked: true })
      )
    ).toBe(true)
  })

  it('has no place for a liked problem taken out of the list on screen', () => {
    // A screen narrowed to one list and to the reader's likes, and a problem only half of that holds
    expect(
      belongsUnderFilters(
        { ...noFilters, favoritesOnly: true, listContentId: 'list-a' },
        problemWith({ liked: true, listContentIds: [] })
      )
    ).toBe(false)
  })

  it('has no place for a marked problem taken out of the list on screen', () => {
    // A list read for its marked problems, and one the reader has just dropped from the list
    expect(
      belongsUnderFilters(
        { ...noFilters, markStatus: 'marked', listContentId: 'list-a' },
        problemWith({ marked: true, listContentIds: ['list-b'] })
      )
    ).toBe(false)
  })
})

describe('a screen turning on the reader’s likes', () => {
  it('turns on them where it asks for the liked ones', () => {
    // The favorites filter is the only thing that narrows a screen by likes
    expect(filtersOnState({ ...noFilters, favoritesOnly: true }, 'liked')).toBe(true)
  })

  it('says nothing about them otherwise', () => {
    // A screen narrowed by marks alone answers the same whichever way a like goes
    expect(filtersOnState({ ...noFilters, markStatus: 'marked' }, 'liked')).toBe(false)
  })

  it('says nothing about them outside a filtered screen', () => {
    // Which is what a problem drawn with no filters around it amounts to
    expect(filtersOnState(null, 'liked')).toBe(false)
  })
})

describe('a screen turning on the reader’s marks', () => {
  it('turns on them where it asks for the marked ones', () => {
    // A screen of marked problems holds a different set once a mark moves
    expect(filtersOnState({ ...noFilters, markStatus: 'marked' }, 'marked')).toBe(true)
  })

  it('turns on them where it asks for the unmarked ones', () => {
    // And so does the same filter read the other way round
    expect(filtersOnState({ ...noFilters, markStatus: 'unmarked' }, 'marked')).toBe(true)
  })

  it('says nothing about them where it asks for neither', () => {
    // The reader's likes narrow this screen, and a mark moves nothing on it
    expect(filtersOnState({ ...noFilters, favoritesOnly: true }, 'marked')).toBe(false)
  })

  it('says nothing about them outside a filtered screen', () => {
    // Again the case of a problem drawn on no filtered screen at all
    expect(filtersOnState(null, 'marked')).toBe(false)
  })
})
