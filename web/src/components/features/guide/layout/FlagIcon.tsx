import 'flag-icons/css/flag-icons.min.css'

import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

export type Country = 'SK' | 'CZ' | 'PL' | 'INTERNATIONAL'

type FlagIconProperties = {
  countries: Country[]
  className?: string
  flagHeight?: number
  flagWidth?: number
}

// Metadata for each country flag: ISO code and localized name
const COUNTRY_METADATA: Record<Country, { code: string; title: string }> = {
  SK: { code: 'sk', title: 'Slovensko' },
  CZ: { code: 'cz', title: 'Česko' },
  PL: { code: 'pl', title: 'Poľsko' },
  INTERNATIONAL: { code: 'un', title: 'Medzinárodný' },
}

/**
 * Displays country flags as SVG icons using the flag-icons library.
 * Pass an array of countries for maximum flexibility.
 * Supports any combination: single country, multiple countries, or international UN flag.
 */
export function FlagIcon({
  countries,
  className,
  flagHeight = 20,
  flagWidth = 28,
}: FlagIconProperties) {
  // Generate flag component for a given country using shared styling and metadata
  const createFlagComponent = (country: Country): React.ReactNode => {
    const { code, title } = COUNTRY_METADATA[country]
    return (
      <span
        key={country}
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

  const flags = countries.map((country) => createFlagComponent(country))

  return flags.length === 1 ? (
    <>{flags[0]}</>
  ) : (
    <div className="inline-flex items-center gap-1.5">{flags}</div>
  )
}
