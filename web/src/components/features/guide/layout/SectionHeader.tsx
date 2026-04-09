import { type LucideIcon } from 'lucide-react'
import React from 'react'

import { CopyLinkButton } from '@/components/shared/components/CopyLinkButton'
import { IconBadge } from '@/components/shared/components/IconBadge'
import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * A type of icon used in the header
 */
type IconType = { type: 'lucide'; icon: LucideIcon } | { type: 'custom'; icon: React.ReactNode }

/**
 * Props for the {@link SectionHeader} component.
 */
export type SectionHeaderProps = {
  /** Icon to display in the header badge */
  icon: IconType
  /** Decorative accent color from the approved palette */
  accent: AccentColor
  /** Section number (e.g., "1.2.3") */
  number: string
  /** Main title text */
  title: string
  /** Description text below the title */
  description?: React.ReactNode
  /** Section slug/ID for anchor link */
  sectionSlug: string
}

/**
 * Reusable section header component for guide sections.
 */
export function SectionHeader({
  icon,
  accent,
  number,
  title,
  description,
  sectionSlug,
}: SectionHeaderProps) {
  // Resolve the accent to concrete Tailwind classes
  const scheme = ACCENT_COLOR_MAP[accent]

  /**
   * Renders the icon based on the icon type.
   *
   * @param iconObj - The icon object.
   * @returns The rendered icon.
   */
  const renderIcon = (iconObj: IconType): React.JSX.Element => {
    switch (iconObj.type) {
      case 'lucide':
        // Standard lucide icons are wrapped in the constrained IconBadge
        return <IconBadge icon={iconObj.icon} accent={accent} />
      case 'custom':
        // Custom nodes (like custom flags or SVGs) get a standard background container
        return (
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              scheme.text,
              scheme.bg
            )}
          >
            {iconObj.icon}
          </div>
        )
    }
  }

  return (
    <div className="mb-4 sm:mb-6 md:mb-8">
      <h3 className="group text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-3 sm:mb-4 border-b border-surface pb-2 sm:pb-3 flex items-center gap-2 sm:gap-3">
        {renderIcon(icon)}
        <span className="mr-1">{number}</span>
        <span>{title}</span>
        <CopyLinkButton slug={sectionSlug} iconSize={18} />
      </h3>
      {description && (
        <div className="text-base sm:text-lg text-muted-foreground max-w-4xl leading-relaxed">
          {description}
        </div>
      )}
    </div>
  )
}
