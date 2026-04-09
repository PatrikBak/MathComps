import { cva, type VariantProps } from 'class-variance-authority'
import { CheckCircle, Circle } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { COMPLETION_ACCENT } from '../guide-colors'

/**
 * The styles for the bullet list.
 */
const bulletListVariants = cva('space-y-3 sm:space-y-4', {
  variants: {
    variant: {
      normal: '',
      small: 'space-y-2.5 sm:space-y-3',
    },
  },
  defaultVariants: {
    variant: 'normal',
  },
})

/**
 * The styles for the bullet list item.
 */
const bulletListItemVariants = cva('flex items-start gap-3 leading-relaxed', {
  variants: {
    variant: {
      normal: 'text-sm sm:text-base text-muted',
      small: 'text-sm text-muted',
    },
  },
  defaultVariants: {
    variant: 'normal',
  },
})

/**
 * The styles for the bullet icon.
 */
const bulletIconClassNames = {
  checkbox: cn('mt-[2px] flex-shrink-0 sm:mt-[4px]', COMPLETION_ACCENT.icon),
  circle: cn('mt-[6px] flex-shrink-0 sm:mt-[8px]', COMPLETION_ACCENT.icon),
} as const

/**
 * Props for the {@link BulletList} component.
 */
type BulletListProps = VariantProps<typeof bulletListVariants> & {
  /** Items rendered as bullet rows. */
  items: React.ReactNode[]
  /** Additional classes for the list wrapper. */
  className?: string
  /** Additional classes for each list item. */
  itemClassName?: string
  /** Semantic bullet icon style. */
  bulletStyle?: 'circle' | 'checkbox'
}

/**
 * Reusable bullet list component for guide prose and checklists.
 *
 * The component owns guide-specific bullet spacing, icon alignment, and muted
 * text treatment so sections can describe content semantically.
 */
export function BulletList({
  items,
  className,
  itemClassName,
  variant,
  bulletStyle = 'circle',
}: BulletListProps) {
  // Resolve the appropriate icon based on the requested style
  const renderBulletIcon = (
    style: NonNullable<BulletListProps['bulletStyle']>
  ): React.JSX.Element => {
    switch (style) {
      case 'checkbox':
        // Return a checkbox icon for completion-oriented lists
        return <CheckCircle className={bulletIconClassNames.checkbox} size={16} />
      case 'circle':
        // Return a standard circle for prose bullet points
        return <Circle className={bulletIconClassNames.circle} size={8} fill="currentColor" />
    }
  }

  return (
    <ul className={cn(bulletListVariants({ variant }), className)}>
      {items.map((item, index) => (
        <li key={index} className={cn(bulletListItemVariants({ variant }), itemClassName)}>
          {renderBulletIcon(bulletStyle)}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}
