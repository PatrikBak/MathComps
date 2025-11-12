'use client'

import { ProgressProvider } from '@bprogress/next/app'

/**
 * Props for the {@link ProgressBarProvider} component.
 */
interface ProgressBarProviderProps {
  /** The child components to be wrapped by the progress bar provider. */
  children: React.ReactNode
}

/**
 * Provides a global progress bar UI for the application using BProgress.
 *
 * @returns The provider component that wraps its children with the application progress bar context.
 *
 * @see {@link ProgressProvider} - The underlying BProgress provider component.
 */
export default function ProgressBarProvider({
  children,
}: ProgressBarProviderProps): React.ReactElement {
  return (
    <ProgressProvider
      height="3px"
      color="#818cf8"
      options={{
        // No weird spinner in the right
        showSpinner: false,
        // Slower trickle for smoother, less aggressive progress
        trickleSpeed: 300,
        // Smoother animation speed
        speed: 300,
        // Use ease-out for more natural deceleration
        easing: 'ease-out',
      }}
      shallowRouting
    >
      {children}
    </ProgressProvider>
  )
}
