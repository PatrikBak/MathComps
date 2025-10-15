import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { GUIDE_STYLES } from './guide-styles'

type InfoCardProps = {
  children: React.ReactNode
  className?: string
}

export function InfoCard({ children, className }: InfoCardProps) {
  return <article className={cn(GUIDE_STYLES.card, className)}>{children}</article>
}
