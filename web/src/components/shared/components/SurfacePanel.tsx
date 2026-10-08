import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Corner radius options, named after Tailwind's `rounded-*` scale.
 */
type SurfacePanelRadius = 'xl' | '2xl'

/**
 * Props for the {@link SurfacePanel} component.
 */
type SurfacePanelProps = {
  /** The rendered element type. */
  as?: 'div' | 'article' | 'section'
  /** What the panel is, for assistive tech, where it is a landmark of its own. */
  'aria-label'?: string
  /** Corner radius. */
  radius: SurfacePanelRadius
  /** Extra classes. */
  className?: string
  /** The panel's content. */
  children: ReactNode
}

/**
 * Tailwind's `rounded-*` class for each {@link SurfacePanelRadius}.
 */
const RADIUS_CLASS: Record<SurfacePanelRadius, string> = {
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
}

/**
 * The site's one translucent-surface card: a hairline border over a dim tinted panel, rendered either
 * as a standalone card or as a panel nested inside a section.
 */
export function SurfacePanel({
  as = 'div',
  radius,
  className,
  children,
  'aria-label': ariaLabel,
}: SurfacePanelProps) {
  // The element type
  const Wrapper = as

  return (
    <Wrapper
      aria-label={ariaLabel}
      className={cn(
        'overflow-hidden border border-foreground/10 bg-surface/25',
        RADIUS_CLASS[radius],
        className
      )}
    >
      {children}
    </Wrapper>
  )
}
