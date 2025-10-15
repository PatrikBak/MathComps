import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

type GradientTextProps = {
  children: React.ReactNode
  className?: string
}

export default function GradientText({ children, className }: GradientTextProps) {
  const gradientStyle = {
    background:
      'linear-gradient(135deg, #a78bfa 0%, #818cf8 25%, #c084fc 50%, #f472b6 75%, #fb7185 100%)',
    backgroundSize: '300% 300%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: 'gradientShift 8s ease-in-out infinite',
  }

  return (
    <span className={cn('pb-0.5', className)} style={gradientStyle}>
      {children}
    </span>
  )
}
