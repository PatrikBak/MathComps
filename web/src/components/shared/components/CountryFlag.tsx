import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link CountryFlag} component.
 */
type CountryFlagProps = {
  /** The country's ISO 3166-1 alpha-2 code, in either case. */
  code: string
  /** What the flag stands for, said on hover and to a screen reader. */
  name: string
  /** How wide it is drawn, in pixels. */
  width: number
  /** How tall it is drawn, in pixels. */
  height: number
  /** Its corners and its place in whatever holds it. */
  className: string
}

/**
 * A country's flag, drawn by the flag-icons sheet and named for whoever cannot see it.
 */
export function CountryFlag({ code, name, width, height, className }: CountryFlagProps) {
  // The flag at the size asked for, cropped to fill it
  return (
    <span
      className={cn('fi', `fi-${code.toLowerCase()}`, className)}
      role="img"
      aria-label={name}
      title={name}
      style={{ width, height, display: 'inline-block', backgroundSize: 'cover' }}
    />
  )
}
