import { getAlpha2Codes } from 'i18n-iso-countries'

import type { SearchableSelectOption } from '@/components/shared/components/select/SearchableSelect'
import type { Locale } from '@/i18n/i18n'

/**
 * The country pinned above the alphabet in each language. English pins none, having no one country behind it.
 */
const PINNED_COUNTRY_BY_LOCALE: Record<Locale, string | undefined> = {
  sk: 'SK',
  cs: 'CZ',
  en: undefined,
}

/**
 * Every country a student can say they compete from, named in their own language.
 *
 * The codes come from the ISO list and the names from CLDR through the platform, so every locale is named
 * without a country ever entering the message files.
 *
 * Not `COUNTRY_FLAG_CODES` from the guide, which is a content-tagging vocabulary and holds entries like
 * "English" and "International" that nobody is from.
 *
 * @param locale - The language to name the countries in.
 *
 * @returns The countries sorted the way that language sorts them, the reader's own first.
 */
export function getCountryOptions(locale: Locale): SearchableSelectOption[] {
  // What the platform calls a region in this language
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' })

  // Whatever this language considers alphabetical, which is not what code-point order considers it
  const collator = new Intl.Collator(locale)

  // Every ISO code with the name this language gives it, dropping any the platform cannot name
  const options = Object.keys(getAlpha2Codes())
    .map((code) => ({ value: code, label: regionNames.of(code) ?? code }))
    .filter((option) => option.label !== option.value)
    .sort((first, second) => collator.compare(first.label, second.label))

  // The country this language pins, if it pins one
  const pinnedCode = PINNED_COUNTRY_BY_LOCALE[locale]

  // Which it may well not have among the ones the platform could name
  const pinnedOption = options.find((option) => option.value === pinnedCode)
  if (pinnedOption === undefined) return options

  // It reads on top, and not a second time down in the alphabet
  return [pinnedOption, ...options.filter((option) => option !== pinnedOption)]
}
