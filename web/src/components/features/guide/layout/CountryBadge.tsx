import type { Country } from '../content/guide-content-types'
import { FlagIcon } from './FlagIcon'

/**
 * Props for the {@link CountryBadge} component.
 */
type CountryBadgeProps = {
  /** Countries to badge. */
  countries: Country[]
}

/**
 * Displays compact country flag badges next to each other.
 */
export function CountryBadge({ countries }: CountryBadgeProps) {
  // Render a flag per country in a tight row
  return (
    <div className="inline-flex items-center gap-1.5">
      {countries.map((country) => (
        <FlagIcon
          key={country}
          country={country}
          className="rounded-[2px]"
          flagHeight={16}
          flagWidth={24}
        />
      ))}
    </div>
  )
}
