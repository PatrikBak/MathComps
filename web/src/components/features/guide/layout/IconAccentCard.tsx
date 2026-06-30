import type { LucideIcon } from 'lucide-react'
import React from 'react'

import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

import { GuideHeading } from './GuideHeading'

/**
 * The visual treatment for one icon-led card: its lead icon and accent color.
 */
export type IconAccentMeta = {
  /** The card's lead icon. */
  icon: LucideIcon
  /** The card's accent color. */
  accent: AccentColor
}

/**
 * Props for the {@link IconAccentCard} component.
 */
type IconAccentCardProps = {
  /** The card's lead icon and accent color. */
  meta: IconAccentMeta
  /** Anchor id for in-page linking. */
  id: string
  /** Icon pixel size. */
  iconSize: number
  /** The card title, shown next to the icon. */
  title: React.ReactNode
  /** The card body beneath the title row. */
  children: React.ReactNode
}

/**
 * A bordered card led by an accent-tinted icon and a title, over arbitrary body content.
 */
export function IconAccentCard({ id, meta, iconSize, title, children }: IconAccentCardProps) {
  // Resolve the accent to concrete Tailwind classes
  const scheme = ACCENT_COLOR_MAP[meta.accent]
  // The lead icon component
  const Icon = meta.icon

  // Lay out the accent header over the body
  return (
    <div id={id} className="rounded-xl border border-foreground/10 bg-surface/40 p-4 sm:p-5">
      {/* Icon + title row */}
      <div className="mb-3 flex items-center gap-3">
        <div className={cn('flex-shrink-0 p-2 sm:p-2.5 rounded-lg', scheme.bg, scheme.text)}>
          <Icon size={iconSize} />
        </div>
        <GuideHeading level="h4">{title}</GuideHeading>
      </div>
      {/* Body */}
      {children}
    </div>
  )
}
