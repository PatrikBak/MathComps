import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

type BadgeProps = {
  icon: React.ReactNode
  text: string
  color: 'sky' | 'green' | 'amber'
}

export default function Badge({ icon, text, color }: BadgeProps) {
  const colorClasses = {
    sky: 'bg-sky-500/10 text-sky-300',
    green: 'bg-green-500/10 text-green-300',
    amber: 'bg-amber-500/10 text-amber-300',
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base lg:text-lg font-semibold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full mb-4 sm:mb-6',
        colorClasses[color]
      )}
    >
      {icon}
      <span>{text}</span>
    </div>
  )
}
