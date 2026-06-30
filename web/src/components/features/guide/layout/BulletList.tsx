import { Circle } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link BulletList} component.
 */
type BulletListProps = {
  /** The list items. */
  items: React.ReactNode[]
  /** Additional classes for the list wrapper. */
  className?: string
  /** Additional classes for each list item. */
  itemClassName?: string
}

/**
 * A bullet list with muted disc markers.
 */
export function BulletList({ items, className, itemClassName }: BulletListProps) {
  // Render each item as a disc-marked row
  return (
    <ul className={cn('space-y-2.5 sm:space-y-3', className)}>
      {items.map((item, index) => (
        <li
          key={index}
          className={cn(
            'flex items-start gap-3 text-sm leading-relaxed text-muted-foreground hyphens-none',
            itemClassName
          )}
        >
          {/* Disc marker */}
          <Circle
            className="mt-[6px] flex-shrink-0 text-muted sm:mt-[8px]"
            size={8}
            fill="currentColor"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
