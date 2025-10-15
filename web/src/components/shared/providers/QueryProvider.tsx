'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * Provider component that wraps the application with TanStack Query client.
 * Creates a QueryClient instance with optimized defaults for the problem library.
 *
 * **Retry Strategy:**
 * - All queries retry infinitely on network/server errors (resilient to transient failures)
 * - Individual queries can override with custom logic (e.g., stop on 404 errors)
 * - See `useSingleProblem` for an example of selective retry logic
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create the QueryClient instance inside state to ensure it's only created once per component lifecycle
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes - reduces unnecessary refetches
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 10 minutes before garbage collection
            gcTime: 10 * 60 * 1000,
            // Infinite retries - never give up on network errors (transient failures)
            retry: Infinity,
            // Fast initial retries, then settle at 10s intervals (exponential backoff)
            retryDelay: (attemptIndex: number) => {
              // First few retries: 500ms, 1s, 2s, 4s
              // After that: constant 10s
              return attemptIndex < 4 ? 500 * 2 ** attemptIndex : 10000
            },
            // Don't refetch on window focus by default (opt-in per query if needed)
            refetchOnWindowFocus: false,
            // Don't refetch on reconnect (we handle offline mode explicitly)
            refetchOnReconnect: false,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
