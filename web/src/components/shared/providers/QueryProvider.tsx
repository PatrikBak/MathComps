'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

import { createQueryClient } from '@/lib/query-config'

/**
 * Provider that wraps the application with the shared TanStack Query client from
 * {@link createQueryClient}.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create the QueryClient instance inside state to ensure it's only created once per component lifecycle
  const [queryClient] = useState(createQueryClient)

  // Hand the client down to the whole app tree
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
