import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { type ApiCaller, useApi } from '@/hooks/use-api'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import type { ApiResult } from '@/types/api'

/**
 * Result type for the optimistic mutation.
 */
type MutationResult<TData> =
  | { type: 'success'; data: TData }
  | { type: 'authenticationLoading' }
  | { type: 'unauthenticated' }

/**
 * Configuration for creating an optimistic mutation with built-in auth handling.
 *
 * @template TData - The type of data returned by the mutation on success.
 * @template TVariables - The type of variables passed to the mutation.
 * @template TContext - The type of context returned by onMutate for rollback.
 */
export type OptimisticMutationConfig<TData, TVariables, TContext> = {
  /**
   * The API function to call. Receives the authenticated `apiCall` function and mutation variables.
   * Should return an {@link ApiResult} - the hook handles success/error checking automatically.
   */
  apiFn: (apiCall: ApiCaller, variables: TVariables) => Promise<ApiResult<TData>>
  /**
   * Called before the mutation executes. Use this to:
   *
   * 1. Cancel outgoing queries to prevent overwrites
   * 2. Snapshot current data for rollback
   * 3. Optimistically update the cache
   *
   * Return context that will be passed to {@link onError} for rollback.
   */
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext
  /**
   * Called after a successful mutation. Useful for cache invalidation, query updates, or success notifications.
   */
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void
  /**
   * Called if the mutation fails OR if authentication fails (for rollback).
   *
   * Use this to rollback optimistic updates using the context from {@link onMutate}.
   */
  onError?: (error: unknown, variables: TVariables, context: TContext | undefined) => void
  /**
   * Called after the mutation settles (success or error). Useful for cleanup or refetching regardless of outcome.
   */
  onSettled?: (
    data: TData | undefined,
    error: unknown,
    variables: TVariables,
    context: TContext | undefined
  ) => void
  /**
   * Shows a login prompt toast with this reason when the user is unauthenticated.
   */
  authReason: string
  /**
   * Called before the login prompt is shown when user is unauthenticated.
   */
  onBeforeLoginPrompt?: (variables: TVariables) => void
  /**
   * Called when the login prompt toast is dismissed.
   */
  onLoginPromptDismiss?: () => void
  /**
   * Error message to show in toast when mutation fails.
   */
  errorMessage: string
}

/**
 * Creates a mutation with built-in optimistic update support, auth handling, error handling, and rollback.
 *
 * This hook standardizes the mutation pattern used across the app:
 * - Automatic authentication state checking with login prompts
 * - API result unwrapping (handles `success`/`error` pattern)
 * - Optimistic updates via onMutate
 * - Automatic rollback on error
 * - Error toasts
 *
 * @template TData - The type of data returned by the mutation on success.
 * @template TVariables - The type of variables passed to the mutation.
 * @template TContext - The type of context returned by onMutate for rollback.
 *
 * @param config - Configuration for the mutation.
 *
 * @returns A React Query mutation object with `mutate`, `mutateAsync`, `isPending`, etc.
 */
export function useOptimisticMutation<TData = unknown, TVariables = void, TContext = unknown>(
  config: OptimisticMutationConfig<TData, TVariables, TContext>
) {
  // Get the API client
  const api = useApi()

  // Get the function to show a login prompt toast
  const showLoginPrompt = useLoginPromptToast()

  // Create the mutation
  return useMutation({
    mutationFn: async (variables: TVariables): Promise<MutationResult<TData>> => {
      // Handle different authentication states
      switch (api.state) {
        // Still loading Clerk's data...
        case 'loading':
          // Show a loading toast (fun fact: have not seen this triggered yet mhm)
          toast.loading('Overujem prihlásenie')

          // Gracefully return
          return { type: 'authenticationLoading' }

        // User is not signed in
        case 'unauthenticated':
          // Call custom handler to store pending action
          config.onBeforeLoginPrompt?.(variables)

          // Show a login prompt with optional dismiss callback
          showLoginPrompt({
            reason: config.authReason,
            onDismiss: config.onLoginPromptDismiss,
          })

          // Gracefully return
          return { type: 'unauthenticated' }

        // User is signed in
        case 'ready':
          // Call the API function with the authenticated apiCall
          const result = await config.apiFn(api.apiCall, variables)

          // If the API call fails, throw an error so that onError can handle it
          if (!result.success) {
            throw new Error(result.error.message)
          }

          // Otherwise the API call was successful
          return { type: 'success', data: result.data }
      }
    },

    // Pass down the custom onMutate handler, but only run it if we are ready to call the API
    onMutate: (variables) => {
      // If we are not authenticated, we don't want to perform optimistic updates
      if (api.state !== 'ready') {
        return undefined as TContext
      }

      // Otherwise run the user's onMutate
      return config.onMutate?.(variables)
    },

    // Handle the mutation result based on its type
    onSuccess: (result, variables, context) => {
      switch (result.type) {
        // Still loading Clerk's data - rollback optimistic updates
        case 'authenticationLoading':
          config.onError?.(new Error(result.type), variables, context)
          break

        // User is not signed in - rollback optimistic updates
        case 'unauthenticated':
          config.onError?.(new Error(result.type), variables, context)
          break

        // Happy path - call the user's success handler
        case 'success':
          config.onSuccess?.(result.data, variables, context)
          break
      }
    },

    // Handle settled regardless of outcome
    onSettled: (result, error, variables, context) => {
      // Extract data from result if it was a success
      const data = result?.type === 'success' ? result.data : undefined

      // Call custom settled handler
      config.onSettled?.(data, error, variables, context)
    },

    // Handle actual API errors (not auth states, those are handled in onSuccess)
    onError: (error, variables, context) => {
      // Show error toast for actual API errors
      toast.error(config.errorMessage)

      // Call custom error handler (for rollback)
      config.onError?.(error, variables, context)
    },
  })
}
