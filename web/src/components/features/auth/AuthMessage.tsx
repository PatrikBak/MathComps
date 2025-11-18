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
    error: 'bg-red-600/90 border-red-500/30 text-red-100',
    success: 'bg-green-600/90 border-green-500/30 text-green-100',
  }[type]

  return <div className={cn('mb-6 p-3 border rounded-lg text-sm', styles)}>{message}</div>
}
