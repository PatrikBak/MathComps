import Image from 'next/image'
import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'

import { cn } from '../shared/utils/css-utils'

/**
 * Props for the {@link MathCompsLogo} component.
 */
type MathCompsLogoProps = {
  /* Optional class name to apply to the logo. */
  className?: string
}

/**
 * The best logo in the world? 🥺😇
 */
export default function MathCompsLogo({ className }: MathCompsLogoProps) {
  // Get translations
  const t = useTranslations('navigation')

  return (
    <AppLink
      href="/"
      className={cn('font-bold text-2xl text-white flex items-center gap-2 sm:gap-3', className)}
      aria-label={`MathComps - ${t('home')}`}
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
