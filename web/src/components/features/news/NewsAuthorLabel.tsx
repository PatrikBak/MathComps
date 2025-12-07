import { User } from 'lucide-react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link NewsAuthorLabel} component.
 */
type NewsAuthorLabelProps = {
  /** The author's name. */
  author: string
}

/**
 * Author label for news articles.
 */
export function NewsAuthorLabel({ author }: NewsAuthorLabelProps) {
  return (
    <div className={cn('inline-flex items-center gap-1.5 text-gray-400 text-sm')}>
      <User size={14} />
      <span>{author}</span>
    </div>
  )
}
