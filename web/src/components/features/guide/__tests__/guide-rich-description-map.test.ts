import { describe, expect, it } from 'vitest'

import {
  descriptionSlotKey,
  resolveCardContent,
  resolveGuideDescriptionText,
} from '../components/guide-rich-description-map'
import type { GuideDescription } from '../content/guide-content-types'

/** A rich blurb carrying inline markdown, in all three languages. */
const rich = (value: string): GuideDescription => ({
  kind: 'rich',
  value: { en: value, sk: value, cs: value },
})

/** A plain-text blurb, in all three languages. */
const plain = (value: string): GuideDescription => ({
  kind: 'text',
  value: { en: value, sk: value, cs: value },
})

describe('resolveGuideDescriptionText', () => {
  // A markdown link collapses to just its visible text
  it('unwraps a markdown link to its text', () => {
    // Resolve a blurb whose only markup is one link
    const result = resolveGuideDescriptionText(
      rich('The easiest problems from [seminars](#seminars), or lower categories.'),
      'en'
    )
    // The link syntax is gone, the words remain
    expect(result).toBe('The easiest problems from seminars, or lower categories.')
  })

  // Several links in one blurb all collapse
  it('unwraps every link in a blurb', () => {
    // Resolve a blurb with two links of different href kinds
    const result = resolveGuideDescriptionText(
      rich('See [a](#x) and [b](https://y.z) today.'),
      'en'
    )
    // Both reduce to their text
    expect(result).toBe('See a and b today.')
  })

  // Bold emphasis loses its delimiters, keeping the word
  it('unwraps bold emphasis', () => {
    // Resolve a blurb with both asterisk and underscore bold
    const result = resolveGuideDescriptionText(rich('Read **this** and __that__ carefully.'), 'en')
    // The delimiters are gone, the emphasized words remain
    expect(result).toBe('Read this and that carefully.')
  })

  // Italic emphasis loses its delimiters, keeping the word
  it('unwraps italic emphasis', () => {
    // Resolve a blurb with both asterisk and underscore italics
    const result = resolveGuideDescriptionText(rich('A *gentle* and _kind_ intro.'), 'en')
    // The delimiters are gone, the emphasized words remain
    expect(result).toBe('A gentle and kind intro.')
  })

  // Intraword underscores are ordinary text, not italic delimiters (CommonMark's rule)
  it('leaves intraword underscores intact', () => {
    // Resolve a blurb naming a snake_case identifier
    const result = resolveGuideDescriptionText(rich('The is_original flag matters.'), 'en')
    // The underscores survive untouched
    expect(result).toBe('The is_original flag matters.')
  })

  // Inline code drops its backticks but keeps its content
  it('unwraps inline code', () => {
    // Resolve a blurb with a backticked token
    const result = resolveGuideDescriptionText(rich('Run the `validate` command.'), 'en')
    // The backticks are gone, the token remains
    expect(result).toBe('Run the validate command.')
  })

  // A NoWrap glue span drops its tags but keeps its content
  it('drops NoWrap spans, keeping their content', () => {
    // Resolve the GeoGebra-style no-break run
    const result = resolveGuideDescriptionText(
      rich('GeoGebra draws them <NoWrap>precisely 📐</NoWrap>.'),
      'en'
    )
    // The tags are stripped, the glued run survives
    expect(result).toBe('GeoGebra draws them precisely 📐.')
  })

  // Plain text passes through untouched (and trimmed)
  it('leaves plain text untouched but trimmed', () => {
    // Resolve a plain blurb padded with whitespace
    const result = resolveGuideDescriptionText(plain('  a discord community  '), 'en')
    // Nothing is stripped beyond the surrounding whitespace
    expect(result).toBe('a discord community')
  })

  // The requested locale is the one resolved
  it('resolves the requested locale', () => {
    // A blurb that differs per language
    const description: GuideDescription = {
      kind: 'text',
      value: { en: 'English', sk: 'Slovak', cs: 'Czech' },
    }
    // Asking for Slovak yields the Slovak string
    expect(resolveGuideDescriptionText(description, 'sk')).toBe('Slovak')
  })
})

describe('descriptionSlotKey', () => {
  // The slot-key format: a bare id for the main description, id + index for a detail bullet
  it('keys the main description on the bare id and a detail on id + index', () => {
    // No index keeps the bare id
    expect(descriptionSlotKey('imo')).toBe('imo')
    // A detail index rides on the id behind the detail separator
    expect(descriptionSlotKey('imo', 0)).toBe('imo::detail::0')
  })
})

describe('resolveCardContent', () => {
  // Rich blurbs resolve to their pre-rendered node via the shared slot key; text blurbs render inline.
  // This pins the cross-module contract with renderGuideRichDescriptions, which keys the map identically.
  it('keys rich blurbs into the map and renders text inline', () => {
    // A rich main description
    const description = rich('the main blurb')
    // A rich detail bullet and a text detail bullet
    const details = [rich('first detail'), plain('second detail')]
    // The pre-rendered map, keyed exactly as renderGuideRichDescriptions keys it
    const richDescriptions = {
      [descriptionSlotKey('imo')]: 'MAIN_NODE',
      [descriptionSlotKey('imo', 0)]: 'DETAIL_NODE',
    }
    // Resolve the card's content
    const result = resolveCardContent('imo', description, details, richDescriptions, 'en')
    // The rich main resolves to its node at the bare-id slot
    expect(result.description).toBe('MAIN_NODE')
    // The rich detail resolves to its node at the id::detail::0 slot
    expect(result.details[0]).toBe('DETAIL_NODE')
    // The text detail renders inline as the localized string, never touching the map
    expect(result.details[1]).toBe('second detail')
  })

  // A text-only card needs no map entry, and no details yield an empty list
  it('renders a text main description inline with no details', () => {
    // A plain main description and no detail bullets
    const result = resolveCardContent('mods', plain('a discord community'), [], {}, 'en')
    // It renders inline as the localized string
    expect(result.description).toBe('a discord community')
    // No details produce an empty list
    expect(result.details).toEqual([])
  })
})
