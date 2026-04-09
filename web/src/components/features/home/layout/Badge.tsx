import React from 'react'

import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The props for the {@link Badge} component.
 */
type BadgeProps = {
  /* The icon to display in the badge. */
  icon: React.ReactNode
  /* The text to display in the badge. */
  text: string
  /* The decorative accent color from the approved palette. */
  color: AccentColor
}

/**
 * A badge with an icon and text-
 */
export default function Badge({ icon, text, color }: BadgeProps) {
  // Resolve the accent to concrete Tailwind classes
  const scheme = ACCENT_COLOR_MAP[color]

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full mb-4 sm:mb-6',
        scheme.bg,
        scheme.text
      )}
    >
      {icon}
      <span>{text}</span>
    </div>
  )
}
