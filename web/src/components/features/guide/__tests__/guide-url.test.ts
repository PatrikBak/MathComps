import { describe, expect, it } from 'vitest'

import { SUPPORTED_LOCALES } from '@/i18n/i18n'

import { GUIDE_PAGES } from '../content/guide-content-types'
import { EMPTY_FILTERS, type GuideDeckState } from '../content/guide-filters'
import { decodeDeckState, encodeDeckState, parseDeckSentinel } from '../content/guide-url'

/**
 * Decodes what {@link encodeDeckState} produced, for round-trip assertions.
 *
 * @param locale - The locale whose token vocabulary drives the encode and decode.
 * @returns The deck state decoded back from its own encoded query string.
 */
const roundTrip = (state: GuideDeckState, locale: (typeof SUPPORTED_LOCALES)[number]) =>
  decodeDeckState(new URLSearchParams(encodeDeckState(state, locale)), locale)

describe('guide-url encode/decode', () => {
  // A representative spread of views to round-trip
  const states: GuideDeckState[] = [
    { page: 'why', filters: EMPTY_FILTERS },
    { page: 'olympiad', filters: EMPTY_FILTERS },
    {
      page: 'other',
      filters: {
        schoolLevel: 'elementary',
        kind: 'team',
        country: 'SK',
        bucket: null,
        resourceLevel: null,
      },
    },
    {
      page: 'other',
      filters: {
        schoolLevel: 'highSchool',
        kind: 'individual',
        country: 'PL',
        bucket: null,
        resourceLevel: null,
      },
    },
    {
      page: 'seminars',
      filters: {
        schoolLevel: null,
        kind: null,
        country: 'INTERNATIONAL',
        bucket: null,
        resourceLevel: null,
      },
    },
    {
      page: 'resources',
      filters: {
        schoolLevel: null,
        kind: null,
        country: null,
        bucket: 'programs',
        resourceLevel: null,
      },
    },
    {
      page: 'resources',
      filters: {
        schoolLevel: null,
        kind: null,
        country: null,
        bucket: 'studyTexts',
        resourceLevel: 'beginner',
      },
    },
    {
      page: 'resources',
      filters: {
        schoolLevel: null,
        kind: null,
        country: null,
        bucket: null,
        resourceLevel: 'advanced',
      },
    },
    { page: 'getStarted', filters: EMPTY_FILTERS },
  ]

  it('round-trips every state in every locale', () => {
    // Walk every supported locale
    for (const locale of SUPPORTED_LOCALES) {
      // And every representative state
      for (const state of states) {
        // Encode then decode lands back on the same state
        expect(roundTrip(state, locale)).toEqual(state)
      }
    }
  })

  it('omits the default first page from the query string', () => {
    // Across every supported locale
    for (const locale of SUPPORTED_LOCALES) {
      // Encoding the default page + empty filters yields an empty query
      expect(encodeDeckState({ page: GUIDE_PAGES[0], filters: EMPTY_FILTERS }, locale)).toBe('')
    }
  })

  it('uses localized tokens for keys and values', () => {
    // Slovak localizes both keys and values
    expect(
      encodeDeckState({ page: 'other', filters: { ...EMPTY_FILTERS, kind: 'team' } }, 'sk')
    ).toBe('stranka=ostatne&typ=timova')
    // English uses the canonical id space
    expect(
      encodeDeckState({ page: 'other', filters: { ...EMPTY_FILTERS, kind: 'team' } }, 'en')
    ).toBe('page=other&kind=team')
    // The resource level rides a distinct localized param, separate from the school-level one
    expect(
      encodeDeckState(
        { page: 'resources', filters: { ...EMPTY_FILTERS, resourceLevel: 'beginner' } },
        'sk'
      )
    ).toBe('stranka=zdroje&obtiaznost=zaciatocnik')
  })

  it('drops unknown tokens to defaults', () => {
    // Slovak params with garbage page and filter tokens
    const params = new URLSearchParams('stranka=bogus&typ=nonsense')
    // Decode drops both to defaults — first page, empty filters
    expect(decodeDeckState(params, 'sk')).toEqual({ page: GUIDE_PAGES[0], filters: EMPTY_FILTERS })
  })

  it('ignores params from a different locale (drop-unknowns)', () => {
    // English param keys, decoded under the Slovak vocabulary
    const params = new URLSearchParams('page=other&kind=team')
    // Unrecognized keys decode to defaults
    expect(decodeDeckState(params, 'sk')).toEqual({ page: GUIDE_PAGES[0], filters: EMPTY_FILTERS })
  })
})

describe('parseDeckSentinel', () => {
  // A bare `#<page>` href is the deck-jump sentinel; anything else stays an ordinary link
  it('reads a real page fragment and rejects anything else', () => {
    // A real page id after the hash drives the deck
    expect(parseDeckSentinel('#olympiad')).toBe('olympiad')
    // An unknown fragment stays an ordinary anchor
    expect(parseDeckSentinel('#bogus')).toBeNull()
    // An internal route path is a normal link
    expect(parseDeckSentinel('/handouts')).toBeNull()
    // An external URL is a normal link
    expect(parseDeckSentinel('https://example.com')).toBeNull()
    // A bare hash names no page
    expect(parseDeckSentinel('#')).toBeNull()
    // An empty href names no page
    expect(parseDeckSentinel('')).toBeNull()
  })
})
