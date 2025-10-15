import type { LucideIcon } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

type IconBadgeProps = {
  icon: LucideIcon
  color: string
  background: string
  size?: number
}

export function IconBadge({ icon: Icon, color, background, size = 20 }: IconBadgeProps) {
  return (
    <div className={cn('flex-shrink-0 p-2 sm:p-2.5 rounded-lg', background, color)}>
      <Icon size={size} />
    </div>
  )
}
