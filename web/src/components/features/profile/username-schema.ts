import { type useTranslations } from 'next-intl'
import { z } from 'zod'

/**
 * Type for the validation translation function.
 */
type ValidationTranslator = ReturnType<typeof useTranslations<'validation'>>

/**
 * The shortest a username may be.
 */
const MIN_USERNAME_LENGTH = 3

/**
 * The longest a username may be, short enough to sit in a results row.
 */
const MAX_USERNAME_LENGTH = 20

/**
 * The characters a username may be built from: letters in any alphabet, digits, and the separators a name
 * written out in full needs. Diacritics are letters, so Peťo Novák is a name a Slovak student can actually have.
 */
const USERNAME_PATTERN = /^[\p{L}\p{N} _-]+$/u

/**
 * Anything living outside the Basic Multilingual Plane, which this pattern has to refuse separately.
 *
 * The backend runs the same character class over UTF-16 code units, where a surrogate half is category Cs rather
 * than a letter, so .NET refuses a name like 𝐏𝐞𝐭𝐨 that JavaScript's own \p{L} happily accepts. Letting it through
 * here would spend the confirm dialog on a name the server then throws out.
 */
const OUTSIDE_BMP_PATTERN = /[\uD800-\uDFFF]/

/**
 * Creates the schema for a username.
 *
 * A username cannot be changed once taken, so a name the backend would refuse is worth refusing here, where the
 * student can still fix it, rather than after the fact.
 *
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns The schema for the username
 */
export const createUsernameSchema = (t: ValidationTranslator) =>
  z
    .string()
    .min(1, t('usernameRequired'))
    .min(MIN_USERNAME_LENGTH, t('usernameMinLength', { count: MIN_USERNAME_LENGTH }))
    .max(MAX_USERNAME_LENGTH, t('usernameMaxLength', { count: MAX_USERNAME_LENGTH }))
    .regex(USERNAME_PATTERN, t('usernameCharacters'))
    .refine((username) => !OUTSIDE_BMP_PATTERN.test(username), t('usernameCharacters'))
