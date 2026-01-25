import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Configuration for a country flag, without title (fetched from translations).
 */
type CountryConfig = {
  /** ISO code of the country */
  code: string
}

/**
 * Metadata for each country flag.
 * Uses `as const satisfies` to preserve literal key types for type-safe translations.
 */
const COUNTRY_METADATA = {
  SK: { code: 'sk' },
  CZ: { code: 'cz' },
  PL: { code: 'pl' },
  EN: { code: 'gb' },
  INTERNATIONAL: { code: 'un' },
} as const satisfies Record<string, CountryConfig>

/**
 * Type of a country flag.
 */
export type Country = keyof typeof COUNTRY_METADATA

/**
 * Properties for the {@link FlagIcon} component.
 */
type FlagIconProperties = {
  /** Country whose flag to display */
  country: Country
  /** Additional CSS classes to apply */
  className?: string
  /** Height of the flag icon */
  flagHeight?: number
  /** Width of the flag icon */
  flagWidth?: number
}

/**
 * Displays country flags as SVG icons using the flag-icons library.
 * Pass an array of countries for maximum flexibility.
 * Supports any combination: single country, multiple countries, or international UN flag.
 */
export function FlagIcon({
  country,
  className,
  flagHeight = 20,
  flagWidth = 28,
}: FlagIconProperties) {
  // Get country translations
  const t = useTranslations('countries')

  // Get the data for the country flag
  const { code } = COUNTRY_METADATA[country]

  // Get translated country name (type-safe since Country keys match translation keys)
  const title = t(country)

  // Return the flag icon
  return (
    <span
      className={cn(`fi fi-${code}`, 'rounded-sm shadow-sm', className)}
      title={title}
      style={{
        width: `${flagWidth}px`,
        height: `${flagHeight}px`,
        display: 'inline-block',
        backgroundSize: 'cover',
      }}
    />
  )
}
