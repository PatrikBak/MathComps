import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the LoadingSpinner component.
 */
type LoadingSpinnerProps = {
  /** Optional class name for custom styling */
  className?: string
  /** Optional inline styles */
  style?: React.CSSProperties
}

/**
 * A reusable loading spinner component.
 */
export const LoadingSpinner = ({ className, style }: LoadingSpinnerProps) => {
  return (
    <div
      className={cn(
        'w-10 h-10 border-2 border-focus/30 border-t-focus rounded-full animate-spin',
        className
      )}
      style={style}
    />
  )
}
