import { cva, type VariantProps } from 'class-variance-authority'
import { Heart, Lightbulb } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import { TIP_BOX_VARIANTS } from '../content/guide-colors'
import { GuideHeading } from './GuideHeading'
import { GuideText } from './GuideText'

/**
 * Style variants for the {@link TipBox}.
 */
const tipBoxVariants = cva('mt-4 rounded-lg border p-4 sm:mt-5 sm:p-5', {
  variants: {
    variant: {
      tip: TIP_BOX_VARIANTS.tip,
      brand: TIP_BOX_VARIANTS.brand,
    },
  },
  defaultVariants: {
    variant: 'tip',
  },
})

/**
 * Resolved visual scheme for a single {@link TipBox} variant.
 */
type TipScheme = {
  /** Accent text-color class. */
  accentColor: string
  /** Localized header label. */
  label: string
  /** Leading header icon. */
  iconNode: React.ReactNode
}

/**
 * Props for the {@link TipBox} component.
 */
type TipBoxProps = VariantProps<typeof tipBoxVariants> & {
  /** Content displayed inside the callout body. */
  children: React.ReactNode
  /** Optional header label overriding the variant default. */
  label?: string
}

/**
 * Callout box for guide-specific tips and informational notes.
 */
export default function TipBox({ children, variant, label }: TipBoxProps) {
  // Deck label translations
  const tDeck = useTranslations('guide.deck')

  // Resolve the visual scheme for the variant
  const scheme = ((): TipScheme => {
    // Branch on the variant
    switch (variant) {
      case 'brand':
        // Brand block: brand accent, heart glyph (warm closing notes)
        return {
          accentColor: 'text-brand-light',
          label: tDeck('noteLabel'),
          iconNode: <Heart size={20} />,
        }
      case 'tip':
      case undefined:
      case null:
        // Tip block: amber accent, lightbulb glyph (the default scheme)
        return {
          accentColor: ACCENT_COLOR_MAP.amber.text,
          label: tDeck('tipLabel'),
          iconNode: <Lightbulb size={20} />,
        }
      // A new variant must fail the build here
      default:
        return assertNever(variant)
    }
  })()

  // Render the callout: accent icon, header, and body
  return (
    <div className={tipBoxVariants({ variant })}>
      <div className="flex items-start gap-3">
        <div className={cn(scheme.accentColor, 'mt-0.5 flex-shrink-0')}>{scheme.iconNode}</div>
        <div className="flex-1 min-w-0">
          <GuideHeading level="h4" className={cn('mb-1 text-sm sm:text-base', scheme.accentColor)}>
            {label ?? scheme.label}
          </GuideHeading>
          <GuideText variant="small" as="div" className="text-foreground/80">
            {children}
          </GuideText>
        </div>
      </div>
    </div>
  )
}
