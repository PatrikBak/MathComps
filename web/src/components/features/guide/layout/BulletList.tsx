import { CheckCircle, Circle } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { GUIDE_STYLES } from './guide-styles'

/**
 * Reusable bullet list component with consistent green bullet styling.
 * Uses a proper icon that scales well at any zoom level.
 */
type BulletListProps = {
  items: React.ReactNode[]
  className?: string
  itemClassName?: string
  bulletStyle?: 'circle' | 'checkbox'
}

export function BulletList({
  items,
  className,
  itemClassName,
  bulletStyle = 'circle',
}: BulletListProps) {
  return (
    <ul className={cn(GUIDE_STYLES.listSpacing, className)}>
      {items.map((item, index) => (
        <li key={index} className={cn(GUIDE_STYLES.listItemSmall, itemClassName)}>
          {bulletStyle === 'checkbox' ? (
            <CheckCircle
              className={cn(GUIDE_STYLES.bulletDotCheckbox, 'text-emerald-400')}
              size={16}
            />
          ) : (
            <Circle
              className={cn(GUIDE_STYLES.bulletDot, 'text-emerald-400')}
              size={8}
              fill="currentColor"
            />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
