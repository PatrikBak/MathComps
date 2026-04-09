import type { LucideIcon } from 'lucide-react'
import React from 'react'

import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link IconBadge} component.
 */
type IconBadgeProps = {
  /** Lucide icon component to render inside the badge. */
  icon: LucideIcon
  /** Decorative accent color from the approved palette. */
  accent: AccentColor
  /** Icon pixel size. */
  size?: number
}

/**
 * Renders a Lucide icon inside a tinted pill, using a constrained
 * {@link AccentColor} to prevent ad-hoc color invention.
 */
export function IconBadge({ icon: Icon, accent, size = 20 }: IconBadgeProps) {
  // Resolve the accent to concrete Tailwind classes
  const scheme = ACCENT_COLOR_MAP[accent]

  return (
    <div className={cn('flex-shrink-0 p-2 sm:p-2.5 rounded-lg', scheme.bg, scheme.text)}>
      <Icon size={size} />
    </div>
  )
}
