import { useCallbackRef } from '@mantine/hooks'
import {
  type MutateOptions,
  type MutationScope,
  useMutation,
  type UseMutationResult,
} from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import { toast } from 'sonner'

import { type ApiCaller, readyApiCall, useApi } from '@/hooks/use-api'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'
import { errorCodeOf, unwrap } from '@/lib/api/api-error'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'
import type { ApiResult } from '@/types/api'

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
   * Should return an {@link ApiResult} - the hook unwraps it and throws a coded failure on error.
   */
  apiFn: (apiCall: ApiCaller, variables: TVariables) => Promise<ApiResult<TData>>
  /**
   * Called before the mutation executes, only when the client is ready. Use this to:
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
   * Called when the mutation fails (an actual API error, not an auth gate). Use this to roll back the
   * optimistic update using the context from {@link onMutate}.
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
   * Called before the login prompt is shown when the user is unauthenticated.
   */
  onBeforeLoginPrompt?: (variables: TVariables) => void
  /**
   * Called when the login prompt toast is dismissed.
   */
  onLoginPromptDismiss?: () => void
  /**
   * Fallback error toast copy for a failure that carried no recognized error code.
   */
  errorMessage: string
  /**
   * Runs the mutation's calls one at a time alongside every other mutation sharing the id, in the order they
   * were fired. For calls that write the same thing, where landing out of order would leave the last one
   * issued and the last one stored disagreeing. Left off, calls run concurrently.
   */
  scope?: MutationScope
}

/**
 * The React Query mutation object, with the auth-gated callers swapped in for the plain ones.
 *
 * @template TData - The type of data returned by the mutation on success.
 * @template TVariables - The type of variables passed to the mutation.
 * @template TContext - The type of context returned by onMutate for rollback.
 */
type UseOptimisticMutationResult<TData, TVariables, TContext> = Omit<
  UseMutationResult<TData, unknown, TVariables, TContext>,
  'mutate' | 'mutateAsync'
> & {
  /**
   * Fires the mutation once the auth gate clears; a signed-out call prompts a login instead.
   * Referentially stable for the hook's lifetime.
   */
  mutate: (
    variables: TVariables,
    options?: MutateOptions<TData, unknown, TVariables, TContext>
  ) => void
  /**
   * The awaitable mutate, resolving to undefined when the auth gate blocked the call.
   * Referentially stable for the hook's lifetime.
   */
  mutateAsync: (
    variables: TVariables,
    options?: MutateOptions<TData, unknown, TVariables, TContext>
  ) => Promise<TData | undefined>
}

/**
 * Creates a mutation with built-in optimistic update support, auth handling, error handling, and rollback.
 *
 * Auth is gated BEFORE the mutation runs: a call issued while the user is signed out shows a login prompt
 * and never reaches React Query, so a per-call `onSuccess` (e.g. clearing a draft) never fires on the
 * auth path. Once the client is ready the mutation runs, unwrapping the {@link ApiResult} to its data and
 * resolving a failed call's code to localized toast copy.
 *
 * @template TData - The type of data returned by the mutation on success.
 * @template TVariables - The type of variables passed to the mutation.
 * @template TContext - The type of context returned by onMutate for rollback.
 *
 * @param config - Configuration for the mutation.
 *
 * @returns A React Query mutation object whose `mutate`/`mutateAsync` gate on auth before firing.
 */
export function useOptimisticMutation<TData = unknown, TVariables = void, TContext = unknown>(
  config: OptimisticMutationConfig<TData, TVariables, TContext>
): UseOptimisticMutationResult<TData, TVariables, TContext> {
  // Get the API client
  const api = useApi()

  // Get the function to show a login prompt toast
  const showLoginPrompt = useLoginPromptToast()

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // The React Query mutation; its handlers run only for a ready client
  const mutation = useMutation({
    mutationFn: async (variables: TVariables): Promise<TData> => {
      // Call the API with the ready caller and unwrap it to data (throwing a coded failure on error)
      return unwrap(await config.apiFn(readyApiCall(api), variables))
    },

    // Whether the caller's calls queue behind each other
    scope: config.scope,

    // Run the caller's optimistic update
    onMutate: config.onMutate,

    // Hand a success to the caller
    onSuccess: config.onSuccess,

    // Surface a failure and let the caller roll back
    onError: (error, variables, context) => {
      // Toast the failure's localized copy, falling back to the caller's generic message
      toast.error(
        resolveErrorMessage(errorCodeOf(error), tApiErrors, { fallback: config.errorMessage })
      )

      // Let the caller roll back the optimistic update
      config.onError?.(error, variables, context)
    },

    // Pass settlement through to the caller
    onSettled: config.onSettled,
  })

  // The client as it stands right now. Assigned during the render rather than from an effect, because the
  // gate below is stable across renders and a caller firing it from a child's effect would otherwise decide
  // on the client one render out of date, and turn away a call the live one would have let through.
  const apiRef = useRef(api)
  apiRef.current = api

  // Whether the client can fire the mutation; on the signed-out path it prompts a login instead
  const canRun = useCallbackRef((variables: TVariables): boolean => {
    // The client the decision is about
    const currentApi = apiRef.current

    // Ready: the mutation can fire
    if (currentApi.state === 'ready') {
      return true
    }

    // Signed out: save any pending action
    if (currentApi.state === 'unauthenticated') {
      config.onBeforeLoginPrompt?.(variables)

      // Prompt a login
      showLoginPrompt({ reason: config.authReason, onDismiss: config.onLoginPromptDismiss })
    }

    // Signed out or still loading Clerk: nothing ran (the action's button is disabled while loading)
    return false
  })

  // The auth-gated mutate: fires only once the gate clears
  const mutate = useCallbackRef(
    (
      variables: TVariables,
      options?: MutateOptions<TData, unknown, TVariables, TContext>
    ): void => {
      // Run only when ready; otherwise the gate handled the auth state
      if (canRun(variables)) {
        mutation.mutate(variables, options)
      }
    }
  )

  // The awaitable variant, resolving to undefined when the auth gate blocked the call
  const mutateAsync = useCallbackRef(
    (
      variables: TVariables,
      options?: MutateOptions<TData, unknown, TVariables, TContext>
    ): Promise<TData | undefined> => {
      // Run only when ready; otherwise resolve to nothing
      if (canRun(variables)) {
        return mutation.mutateAsync(variables, options)
      }

      // The gate blocked the call
      return Promise.resolve(undefined)
    }
  )

  // The mutation object with the auth-gated callers swapped in
  return { ...mutation, mutate, mutateAsync }
}
