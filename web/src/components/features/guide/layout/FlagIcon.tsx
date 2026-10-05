import { useTranslations } from 'next-intl'

import { CountryFlag } from '@/components/shared/components/CountryFlag'
import { cn } from '@/components/shared/utils/css-utils'

import { type Country, COUNTRY_FLAG_CODES } from '../content/guide-content-types'

/** Default flag height in pixels */
const DEFAULT_FLAG_HEIGHT = 20

/** Default flag width in pixels */
const DEFAULT_FLAG_WIDTH = 28

/**
 * Props for the {@link FlagIcon} component.
 */
type FlagIconProps = {
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
 * A component that renders a country's flag icon, titled with the localized country name.
 */
export function FlagIcon({
  country,
  className,
  flagHeight = DEFAULT_FLAG_HEIGHT,
  flagWidth = DEFAULT_FLAG_WIDTH,
}: FlagIconProps) {
  // Localized country names
  const t = useTranslations('countries')

  // Get the ISO 3166 flag code for the country
  const code = COUNTRY_FLAG_CODES[country]

  // Localized country name for the title
  const title = t(country)

  // The flag, softened at the corners and lifted off the page
  return (
    <CountryFlag
      code={code}
      name={title}
      width={flagWidth}
      height={flagHeight}
      className={cn('rounded-sm shadow-sm', className)}
    />
  )
}
