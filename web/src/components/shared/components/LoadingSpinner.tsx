import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the LoadingSpinner component.
 */
type LoadingSpinnerProps = {
  /** Optional class name for custom styling */
  className?: string
}

/**
 * A reusable loading spinner component.
 */
export const LoadingSpinner = ({ className }: LoadingSpinnerProps) => {
  return (
    <div
      className={cn(
        'w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin',
        className
      )}
    />
  )
}
