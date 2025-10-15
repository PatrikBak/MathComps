import React from 'react'

import type { Country } from './FlagIcon'
import { FlagIcon } from './FlagIcon'

type CountryBadgeProperties = {
  countries: Country[]
  size?: 'sm' | 'md'
}

/**
 * Displays compact country flag badges.
 * Designed to sit inline with SchoolLevelBadge without overwhelming the layout.
 * Handles single countries, multiple countries (CZ+SK), and international flags gracefully.
 */
export function CountryBadge({ countries, size = 'sm' }: CountryBadgeProperties) {
  // Size configurations for different use cases
  const sizeConfig = {
    sm: { height: 12, width: 18, gap: 'gap-1' },
    md: { height: 16, width: 24, gap: 'gap-1.5' },
  }

  const config = sizeConfig[size]

  return (
    <div className={`inline-flex items-center ${config.gap}`}>
      <FlagIcon
        countries={countries}
        className="rounded-[2px]"
        flagHeight={config.height}
        flagWidth={config.width}
      />
    </div>
  )
}
