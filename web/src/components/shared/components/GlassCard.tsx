import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import styles from './GlassCard.module.css'

type GlassCardIconProps = {
  icon?: ReactNode
  iconGradient?: string
  glowColor?: string
}

type GlassCardProps = {
  badge?: ReactNode
  title: ReactNode
  titleElement?: 'h1' | 'h2' | 'h3' | 'h4' | 'div'
  align?: 'left' | 'center'
  iconProps?: GlassCardIconProps
  description?: ReactNode
  children?: ReactNode
}

// Create a mapping from the heading element to a Tailwind font-size class.
const titleSizeClasses = {
  h1: 'text-2xl sm:text-4xl lg:text-5xl',
  h2: 'text-xl sm:text-3xl lg:text-4xl',
  h3: 'text-lg sm:text-2xl lg:text-3xl',
  h4: 'text-base sm:text-xl lg:text-2xl',
  div: 'text-base sm:text-xl lg:text-2xl',
}

export default function GlassCard({
  title,
  badge,
  iconProps,
  description,
  children,
  align = 'center',
  titleElement: TitleElement = 'h3',
}: GlassCardProps) {
  return (
    <div
      className={`${styles.glassCard} p-2 sm:p-4 lg:p-6 rounded-2xl group hover:scale-105 transition-all duration-500
        ${align == 'center' ? 'text-center' : ''}`}
    >
      {badge}
      {iconProps && (
        <div
          className={cn(
            'p-2.5 sm:p-4 rounded-xl sm:rounded-2xl inline-block mb-3 sm:mb-6 mx-auto',
            iconProps.iconGradient && `bg-gradient-to-br ${iconProps.iconGradient}`
          )}
          style={
            iconProps.glowColor == null
              ? undefined
              : { filter: `drop-shadow(0 0 5px ${iconProps.glowColor})` }
          }
        >
          {iconProps.icon}
        </div>
      )}
      <TitleElement
        className={cn('font-bold text-white mb-2 sm:mb-4', titleSizeClasses[TitleElement])}
      >
        {title}
      </TitleElement>
      {description && (
        <div className="text-slate-400 text-sm sm:text-base lg:text-lg leading-relaxed mb-3 sm:mb-6">
          {description}
        </div>
      )}
      {children && <div className="mt-2 sm:mt-4">{children}</div>}
    </div>
  )
}
