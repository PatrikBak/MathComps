import { describe, expect, it } from 'vitest'

import type { SearchFiltersState } from '../types/problem-library-types'
import { isNoOpFilterChange, isTextOnlyChange } from '../utils/search-logic'

describe('deciding when to search', () => {
  /** Nothing filtered on, which every case below moves one thing away from. */
  const defaultFilters: SearchFiltersState = {
    searchText: '',
    searchInSolution: false,
    seasons: [],
    problemNumbers: [],
    tags: [],
    tagLogic: 'or',
    authors: [],
    authorLogic: 'or',
    competitionSelection: [],
    favoritesOnly: false,
    markStatus: null,
    listContentId: null,
  }

  describe('a change that is nothing but typing', () => {
    it('covers the term, its scope, and both at once', () => {
      // A state carrying discrete filters that none of the changes below touch
      const baseFilters = {
        ...defaultFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        competitionSelection: [{ path: 'mo-a' }],
      }

      // The term rewritten
      const textChange = { ...baseFilters, searchText: 'new search' }

      // Typing, so worth waiting out
      expect(isTextOnlyChange(baseFilters, textChange)).toBe(true)

      // The term reaching into solutions
      const solutionChange = { ...baseFilters, searchInSolution: true }

      // Where the term is matched counts as part of the term
      expect(isTextOnlyChange(baseFilters, solutionChange)).toBe(true)

      // Both text fields moving in one step
      const bothTextChanges = { ...baseFilters, searchText: 'test', searchInSolution: true }

      // Still nothing but typing
      expect(isTextOnlyChange(baseFilters, bothTextChanges)).toBe(true)
    })

    it('never covers a tag that moved, alone or alongside the text', () => {
      // A state with a term already typed
      const baseFilters = { ...defaultFilters, searchText: 'existing search' }

      // A tag picked, with the term left alone
      const tagChange = { ...baseFilters, tags: [{ slug: 'new-tag', displayName: 'New Tag' }] }

      // Not typing, so nothing to wait out
      expect(isTextOnlyChange(baseFilters, tagChange)).toBe(false)

      // The term rewritten and a tag picked in the same step
      const mixedChange = {
        ...baseFilters,
        searchText: 'different search',
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
      }

      // The tag decides it, whatever the term did
      expect(isTextOnlyChange(baseFilters, mixedChange)).toBe(false)
    })

    it('never covers a tag traded for another while the term moves', () => {
      // A term already typed, with one tag behind it
      const baseFilters = {
        ...defaultFilters,
        searchText: 'existing search',
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
      }

      // The term rewritten and the tag swapped for a different one, leaving the count where it was
      const swappedTag = {
        ...baseFilters,
        searchText: 'different search',
        tags: [{ slug: 'geometry', displayName: 'Geometry' }],
      }

      // The tag asks a different question, so its results cannot wait out the typing
      expect(isTextOnlyChange(baseFilters, swappedTag)).toBe(false)
    })

    it('never covers a season traded for another while the term moves', () => {
      // A term already typed, with one school year behind it
      const baseFilters = {
        ...defaultFilters,
        searchText: 'existing search',
        seasons: [{ slug: '2023', displayName: '2023' }],
      }

      // The term rewritten and the year swapped, leaving the count where it was
      const swappedSeason = {
        ...baseFilters,
        searchText: 'different search',
        seasons: [{ slug: '2024', displayName: '2024' }],
      }

      // A different year entirely, so its results cannot wait out the typing
      expect(isTextOnlyChange(baseFilters, swappedSeason)).toBe(false)
    })

    it('never covers a position traded for another while the term moves', () => {
      // A term already typed, with one position within the round behind it
      const baseFilters = { ...defaultFilters, searchText: 'existing search', problemNumbers: [1] }

      // The term rewritten and the position swapped, leaving the count where it was
      const swappedNumber = {
        ...baseFilters,
        searchText: 'different search',
        problemNumbers: [2],
      }

      // A different position entirely, so its results cannot wait out the typing
      expect(isTextOnlyChange(baseFilters, swappedNumber)).toBe(false)
    })

    it('never covers favourites switching on while the term moves', () => {
      // A term already typed, with every problem still in reach
      const baseFilters = { ...defaultFilters, searchText: 'existing search' }

      // The term rewritten and the user narrowing to their own likes in the same step
      const favoritesChange = {
        ...baseFilters,
        searchText: 'different search',
        favoritesOnly: true,
      }

      // A smaller pool of problems entirely, so its results cannot wait out the typing
      expect(isTextOnlyChange(baseFilters, favoritesChange)).toBe(false)
    })

    it('never covers dropping into a list while the term moves', () => {
      // A term already typed, with the whole library behind it
      const baseFilters = { ...defaultFilters, searchText: 'existing search' }

      // The term rewritten and one list stepped into in the same step
      const listChange = {
        ...baseFilters,
        searchText: 'different search',
        listContentId: 'abc123',
      }

      // The list holds its own problems, so its results cannot wait out the typing
      expect(isTextOnlyChange(baseFilters, listChange)).toBe(false)
    })

    it('never covers a competition traded for another while the term moves', () => {
      // A term already typed, with one competition behind it
      const withSelections = {
        ...defaultFilters,
        searchText: 'existing search',
        competitionSelection: [{ path: 'mo-a-i' }],
      }

      // The term rewritten and another competition put in its place, leaving the count where it was
      const differentSelections = {
        ...withSelections,
        searchText: 'different search',
        competitionSelection: [{ path: 'imo' }],
      }

      // A different competition entirely, so its results cannot wait out the typing
      expect(isTextOnlyChange(withSelections, differentSelections)).toBe(false)
    })
  })

  describe('a change that cannot move the results', () => {
    it('covers the AND/OR toggle when no tag is picked', () => {
      // Matching any of the tags
      const before = { ...defaultFilters, tagLogic: 'or' as const }

      // Against matching all of them, with no tag for either mode to apply to
      const after = { ...defaultFilters, tagLogic: 'and' as const }

      // Both modes ask the same question, so there is nothing to re-query
      expect(isNoOpFilterChange(before, after)).toBe(true)
    })

    it('covers it when a single tag is picked', () => {
      // One tag, matched under either mode
      const before = {
        ...defaultFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        tagLogic: 'or' as const,
      }

      // The same tag, with the mode flipped
      const after = {
        ...defaultFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
        tagLogic: 'and' as const,
      }

      // Any of one and all of one are the same question
      expect(isNoOpFilterChange(before, after)).toBe(true)
    })

    it('stops covering it once a second tag is picked', () => {
      // Two tags, which give the mode something to say
      const twoTags = [
        { slug: 'algebra', displayName: 'Algebra' },
        { slug: 'geometry', displayName: 'Geometry' },
      ]

      // Problems carrying either tag
      const before = { ...defaultFilters, tags: twoTags, tagLogic: 'or' as const }

      // Against problems carrying both
      const after = { ...defaultFilters, tags: twoTags, tagLogic: 'and' as const }

      // Two different questions, so the query has to go out again
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('covers the author toggle when no author is picked', () => {
      // Matching any of the authors
      const before = { ...defaultFilters, authorLogic: 'or' as const }

      // Against matching all of them, with no author for either mode to apply to
      const after = { ...defaultFilters, authorLogic: 'and' as const }

      // Both modes ask the same question, so there is nothing to re-query
      expect(isNoOpFilterChange(before, after)).toBe(true)
    })

    it('stops covering it once a second author is picked', () => {
      // Two authors, which give the mode something to say
      const twoAuthors = [
        { slug: 'alice', displayName: 'Alice' },
        { slug: 'bob', displayName: 'Bob' },
      ]

      // Problems by either of them
      const before = { ...defaultFilters, authors: twoAuthors, authorLogic: 'or' as const }

      // Against problems by both
      const after = { ...defaultFilters, authors: twoAuthors, authorLogic: 'and' as const }

      // Two different questions, so the query has to go out again
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('never covers an added tag', () => {
      // Nothing filtered on
      const before = { ...defaultFilters }

      // The first tag picked
      const after = {
        ...defaultFilters,
        tags: [{ slug: 'algebra', displayName: 'Algebra' }],
      }

      // A narrower question than before, so it has to be asked
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('never covers a switch to another list', () => {
      // One list being browsed
      const before = { ...defaultFilters, listContentId: 'list-a' }

      // Another in its place, holding its own problems
      const after = { ...defaultFilters, listContentId: 'list-b' }

      // A different set of problems entirely
      expect(isNoOpFilterChange(before, after)).toBe(false)
    })

    it('never covers a season, a position, a competition, favourites or a mark moving', () => {
      // A state already narrowed by a school year, a position within the round and one competition
      const picked = {
        ...defaultFilters,
        seasons: [{ slug: '2023', displayName: '2023' }],
        problemNumbers: [1],
        competitionSelection: [{ path: 'mo-a-i' }],
      }

      // The year traded for another, leaving every count where it was
      const seasonMoved = { ...picked, seasons: [{ slug: '2024', displayName: '2024' }] }

      // A different year entirely, so the query has to go out again
      expect(isNoOpFilterChange(picked, seasonMoved)).toBe(false)

      // The position traded for another
      const numberMoved = { ...picked, problemNumbers: [2] }

      // A different position entirely
      expect(isNoOpFilterChange(picked, numberMoved)).toBe(false)

      // The competition traded for another
      const competitionMoved = { ...picked, competitionSelection: [{ path: 'imo' }] }

      // A different competition entirely
      expect(isNoOpFilterChange(picked, competitionMoved)).toBe(false)

      // The user narrowing to their own likes
      const favoritesOn = { ...picked, favoritesOnly: true }

      // Which drops every problem they never liked
      expect(isNoOpFilterChange(picked, favoritesOn)).toBe(false)

      // The user narrowing to what they have already marked
      const markSet = { ...picked, markStatus: 'marked' as const }

      // Which drops every unmarked problem
      expect(isNoOpFilterChange(picked, markSet)).toBe(false)

      // A term typed where there was none
      const termTyped = { ...picked, searchText: 'algebra' }

      // Which is the narrowest change of all
      expect(isNoOpFilterChange(picked, termTyped)).toBe(false)

      // A term already typed, then told to reach into the solutions as well
      const solutionsReached = { ...picked, searchText: 'algebra', searchInSolution: true }

      // Where the term is matched decides which problems it matches
      expect(isNoOpFilterChange(termTyped, solutionsReached)).toBe(false)
    })

    it('covers a state that did not change at all', () => {
      // The same filters twice over, with nothing moved between them
      expect(isNoOpFilterChange(defaultFilters, { ...defaultFilters })).toBe(true)
    })
  })
})
