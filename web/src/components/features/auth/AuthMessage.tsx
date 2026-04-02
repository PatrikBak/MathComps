import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link AuthMessage} component.
 */
type AuthMessageProps = {
  /** Type of message to display */
  type: 'error' | 'success'
  /** The message content to display */
  message: string
}

/**
 * Displays a styled message in the authentication form.
 */
export default function AuthMessage({ type, message }: AuthMessageProps) {
  const styles = {
    error: 'bg-error/15 border-error/30 text-error',
    success: 'bg-success/15 border-success/30 text-success',
  }[type]

  return <div className={cn('mb-6 p-3 border rounded-lg text-sm', styles)}>{message}</div>
}
