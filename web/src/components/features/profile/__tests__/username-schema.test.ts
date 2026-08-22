import { type useTranslations } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { createUsernameSchema } from '../username-schema'

/**
 * A translator standing in for the real one, since these tests weigh what the schema accepts rather than what it
 * says when it refuses.
 */
const translate = ((key: string) => key) as unknown as ReturnType<
  typeof useTranslations<'validation'>
>

/**
 * The schema under test.
 */
const schema = createUsernameSchema(translate)

describe('createUsernameSchema', () => {
  // Diacritics and spaces are the whole reason this is our own column rather than Clerk's field
  it.each(['peto', 'Peťo Novák', 'peto_novak', 'peto-novak', 'Kocúrkovo42', 'петя'])(
    'accepts %s',
    (username) => {
      expect(schema.safeParse(username).success).toBe(true)
    }
  )

  // The bounds are written out rather than read off the module, so moving one has to be a deliberate edit here too
  it.each(['', 'ab', 'abcdefghijklmnopqrstu'])('refuses %s for its length', (username) => {
    expect(schema.safeParse(username).success).toBe(false)
  })

  // A name is letters and digits, not punctuation somebody could hide a lookalike in
  // The last one is a letter to JavaScript and a pair of surrogates to the backend, which refuses it
  it.each([
    'peto.novak',
    'peto!',
    'peto@novak',
    'peto/novak',
    '🤖bot',
    '\u{1D40F}\u{1D41E}\u{1D42D}\u{1D428}',
  ])('refuses %s for its characters', (username) => {
    expect(schema.safeParse(username).success).toBe(false)
  })
})
