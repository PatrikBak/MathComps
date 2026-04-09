'use client'

import { MessageSquare } from 'lucide-react'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'

import { useCommentCount } from './CommentCountContext'

/**
 * Props for the {@link CommentCountPill} component.
 */
type CommentCountPillProps = {
  /** The permanent target ID to display the comment count for */
  targetId: string
}

/**
 * Displays a comment count pill with the icon.
 * Reads the count from the {@link CommentCountProvider} context.
 */
export function CommentCountPill({ targetId }: CommentCountPillProps) {
  // Get the count from the context
  const { count, isLoading } = useCommentCount(targetId)

  // Determine if there are comments
  const hasComments = count > 0

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 leading-none transition-colors duration-200',
        hasComments ? 'text-focus/80' : 'text-muted'
      )}
    >
      <MessageSquare className={cn('w-4 h-4', hasComments ? 'fill-focus/20' : 'opacity-40')} />
      <span className="text-sm font-bold tracking-tight">
        {isLoading ? <LoadingSpinner className="w-3 h-3 border-2" /> : count}
      </span>
    </div>
  )
}
