import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { cn } from '@/components/shared/utils/css-utils'

type MathCompsLogoProps = {
  className?: string
}

export default function MathCompsLogo({ className }: MathCompsLogoProps) {
  return (
    <AppLink
      href="/"
      className={cn('font-bold text-2xl text-white flex items-center gap-2 sm:gap-3', className)}
      aria-label="MathComps - domov"
    >
      <span className="inline-flex items-center gap-2 sm:gap-3">
        <svg
          className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
          viewBox="0 0 24 24"
          role="img"
          aria-label="MathComps Logo"
        >
          <defs>
            <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <g fill="#ffffff" opacity="0.9">
            <circle cx="4" cy="4" r="1.05" />
            <circle cx="12" cy="4" r="1.05" />
            <circle cx="20" cy="4" r="1.05" />
            <circle cx="4" cy="12" r="1.05" />
            <circle cx="12" cy="12" r="1.05" />
            <circle cx="20" cy="12" r="1.05" />
            <circle cx="4" cy="20" r="1.05" />
            <circle cx="12" cy="20" r="1.05" />
          </g>
          <path
            d="M4 4 H12 V12 H20 V20"
            fill="none"
            stroke="url(#logoGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="20" r="3.3" fill="url(#logoGrad)" />
        </svg>
        <span className="text-xl sm:text-2xl lg:text-3xl">
          Math<span style={{ color: '#8b5cf6' }}>Comps</span>
        </span>
      </span>
    </AppLink>
  )
}
