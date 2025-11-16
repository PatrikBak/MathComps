import Image from 'next/image'
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
        <Image
          src="/logo-mathcomps.svg"
          alt="MathComps Logo"
          width={48}
          height={48}
          className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
          role="img"
          aria-label="MathComps Logo"
          unoptimized
        />
        <span className="text-xl sm:text-2xl lg:text-3xl">
          Math<span style={{ color: '#8b5cf6' }}>Comps</span>
        </span>
      </span>
    </AppLink>
  )
}
