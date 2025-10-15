import { Info } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the TipBox component.
 */
interface TipBoxProps {
  /** The main content of the tip */
  children: React.ReactNode
  /** Visual style variant */
  variant?: 'tip' | 'info'
}

/**
 * Reusable tip box component for displaying helpful tips and information.
 * Features a prominent emoji, title, and content with consistent styling.
 */
export default function TipBox({ children, variant = 'tip' }: TipBoxProps) {
  const scheme = {
    info: {
      border: 'border-blue-500/20',
      bgFrom: 'from-blue-500/5',
      bgTo: 'to-blue-600/5',
      iconColor: 'text-blue-400',
      titleColor: 'text-blue-300',
      label: 'Info',
      iconLayoutClass: 'mt-0.5',
      iconNode: <Info size={20} />,
    },
    tip: {
      border: 'border-amber-500/20',
      bgFrom: 'from-amber-500/5',
      bgTo: 'to-amber-600/5',
      iconColor: 'text-amber-400',
      titleColor: 'text-amber-300',
      label: 'Tip',
      iconLayoutClass: 'text-xl font-bold',
      iconNode: '💡',
    },
  }[variant]

  return (
    <div
      className={cn(
        'rounded-lg border bg-gradient-to-br p-4 sm:p-5 mt-4 sm:mt-5',
        scheme.border,
        scheme.bgFrom,
        scheme.bgTo
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(scheme.iconColor, 'flex-shrink-0', scheme.iconLayoutClass)}>
          {scheme.iconNode}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm sm:text-base font-semibold mb-1', scheme.titleColor)}>
            {scheme.label}
          </p>
          <div className="text-sm sm:text-base text-slate-300 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}
