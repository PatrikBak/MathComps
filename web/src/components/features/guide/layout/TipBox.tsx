import { cva, type VariantProps } from 'class-variance-authority'
import { Info } from 'lucide-react'
import React from 'react'

import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

import { TIP_BOX_VARIANTS } from '../guide-colors'
import { GuideHeading } from './GuideHeading'
import { GuideText } from './GuideText'

/**
 * The styles for the tip box.
 */
const tipBoxVariants = cva('mt-4 rounded-lg border bg-gradient-to-br p-4 sm:mt-5 sm:p-5', {
  variants: {
    variant: {
      note: TIP_BOX_VARIANTS.note,
      tip: TIP_BOX_VARIANTS.tip,
    },
  },
  defaultVariants: {
    variant: 'tip',
  },
})

/**
 * Resolved visual scheme for a single {@link TipBox} variant
 */
type TipScheme = {
  /** Tailwind text-color class applied to the leading icon. */
  iconColor: string
  /** Tailwind text-color class applied to the callout title. */
  titleColor: string
  /** Visible title label rendered inside the callout header. */
  label: string
  /** Extra layout / typography classes applied to the icon wrapper. */
  iconLayoutClass: string
  /** React node rendered as the leading icon (Lucide component or emoji). */
  iconNode: React.ReactNode
}

/**
 * Props for the {@link TipBox} component.
 */
type TipBoxProps = VariantProps<typeof tipBoxVariants> & {
  /** Content displayed inside the callout body. */
  children: React.ReactNode
}

/**
 * Callout box for guide-specific tips and informational notes.
 */
export default function TipBox({ children, variant }: TipBoxProps) {
  // Resolve the visual scheme config tailored to the variant
  const scheme = ((): TipScheme => {
    switch (variant) {
      case 'note':
        // Return info block config
        return {
          iconColor: ACCENT_COLOR_MAP.blue.text,
          titleColor: ACCENT_COLOR_MAP.blue.text,
          label: 'Info',
          iconLayoutClass: 'mt-0.5',
          iconNode: <Info size={20} />,
        }
      case 'tip':
      default:
        // Return warning block config
        return {
          iconColor: ACCENT_COLOR_MAP.amber.text,
          titleColor: ACCENT_COLOR_MAP.amber.text,
          label: 'Tip',
          iconLayoutClass: 'text-xl font-bold',
          iconNode: '💡',
        }
    }
  })()

  return (
    <div className={tipBoxVariants({ variant })}>
      <div className="flex items-start gap-3">
        <div className={cn(scheme.iconColor, 'flex-shrink-0', scheme.iconLayoutClass)}>
          {scheme.iconNode}
        </div>
        <div className="flex-1 min-w-0">
          <GuideHeading level="h4" className={cn('mb-1 text-sm sm:text-base', scheme.titleColor)}>
            {scheme.label}
          </GuideHeading>
          <GuideText variant="small" color="subtle" as="div">
            {children}
          </GuideText>
        </div>
      </div>
    </div>
  )
}
