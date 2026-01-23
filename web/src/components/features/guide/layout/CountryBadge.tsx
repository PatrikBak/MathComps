import { cn } from '@/components/shared/utils/css-utils'

import type { Country } from './FlagIcon'
import { FlagIcon } from './FlagIcon'

/**
 * Properties for the {@link CountryBadge} component.
 */
type CountryBadgeProperties = {
  /** List of countries to display. */
  countries: Country[]
  /** Size of the country flags. */
  size?: 'sm' | 'md'
}

/**
 * Displays compact country flag badges next to each other.
 */
export function CountryBadge({ countries, size = 'sm' }: CountryBadgeProperties) {
  // Get the configuration based on the size
  const config = {
    sm: { height: 12, width: 18, gap: 'gap-1' },
    md: { height: 16, width: 24, gap: 'gap-1.5' },
  }[size]

  return (
    <div className={cn(`inline-flex items-center`, config.gap)}>
      {countries.map((country) => (
        <FlagIcon
          key={country}
          country={country}
          className="rounded-[2px]"
          flagHeight={config.height}
          flagWidth={config.width}
        />
      ))}
    </div>
  )
}
