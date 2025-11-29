import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link GradientText} component
 */
type GradientTextProps = {
  /** The text to display */
  children: React.ReactNode
  /** Optional Tailwind classes for the text */
  className?: string
}

/**
 * A component that displays text with a purple (obvious AI) gradient effect.
 */
export default function GradientText({ children, className }: GradientTextProps) {
  // The gradient style for the text
  const gradientStyle = {
    background:
      'linear-gradient(135deg, #a78bfa 0%, #818cf8 25%, #c084fc 50%, #f472b6 75%, #fb7185 100%)',
    backgroundSize: '300% 300%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  }

  // The gradient text component
  return (
    <span className={cn('pb-0.5', className)} style={gradientStyle}>
      {children}
    </span>
  )
}
