import { Filter } from 'lucide-react'

import { CountBadge } from '@/components/shared/components/CountBadge'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * The props of {@link FilterMark}.
 */
type FilterMarkProps = {
  /** How many filters are set. */
  count: number
}

/**
 * The filters' funnel, lit with how many filters are set at its corner once any are.
 */
export function FilterMark({ count }: FilterMarkProps) {
  return (
    <CountBadge
      count={count}
      color="indigo"
      isHighlighted={count > 0}
      // Room for the count hanging past the funnel's edge
      className={cn(count > 0 && 'mr-2.5')}
    >
      <Filter className="h-4 w-4" aria-hidden="true" />
    </CountBadge>
  )
}
