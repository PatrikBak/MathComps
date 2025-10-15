import { type LucideIcon } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { IconBadge } from './IconBadge'

/**
 * A type of icon used in the header
 */
type IconType = { type: 'lucide'; icon: LucideIcon } | { type: 'custom'; icon: React.ReactNode }

/**
 * Props for the SectionHeader component.
 */
export interface SectionHeaderProps {
  /** Icon to display in the header badge */
  icon: IconType
  /** Color class for the icon */
  iconColor: string
  /** Background color class for the icon badge */
  iconBackground: string
  /** Section number (e.g., "1.2.3") */
  number: string
  /** Main title text */
  title: string
  /** Description text below the title */
  description?: React.ReactNode
}

/**
 * Reusable section header component for guide sections.
 */
export function SectionHeader({
  icon,
  iconColor,
  iconBackground,
  number,
  title,
  description,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 sm:mb-6 md:mb-8">
      <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 border-b border-gray-700 pb-2 sm:pb-3 flex items-center gap-2 sm:gap-3">
        {icon.type === 'lucide' ? (
          <IconBadge icon={icon.icon} color={iconColor} background={iconBackground} />
        ) : (
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              iconColor,
              iconBackground
            )}
          >
            {icon.icon}
          </div>
        )}
        <span className="mr-1">{number}</span>
        <span>{title}</span>
      </h3>
      {description && (
        <div className="text-base sm:text-lg text-slate-400 max-w-4xl leading-relaxed">
          {description}
        </div>
      )}
    </div>
  )
}
