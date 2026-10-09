'use client'

import { type Mutation, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  type OptimisticMutationConfig,
  useOptimisticMutation,
} from '@/hooks/use-optimistic-mutation'

import type { SelectionData } from '../model/selection-types'
import { invalidateSelection, useSelectionQueryKey } from './selection-cache'

/**
 * The queue every write to the selection runs in, which tells them apart from every other mutation.
 */
const SELECTION_WRITE_SCOPE = { id: 'problem-selection' }

/**
 * Whether a mutation is a write to the selection.
 *
 * @param mutation - The mutation.
 *
 * @returns True for a write in the selection's queue.
 */
function isSelectionWrite(mutation: Mutation): boolean {
  // Every write to the selection runs in its queue
  return mutation.options.scope?.id === SELECTION_WRITE_SCOPE.id
}

/**
 * One write to the selection, as the control firing it sees it.
 *
 * @template TVariables - What the write is fired with.
 */
export type SelectionWrite<TVariables> = {
  /**
   * Fires the write, saying true, or drops the press, saying false, while another write to the selection is still
   * out. The selection shows what the write does at once where that can be worked out ahead of the server, and
   * puts things back if the server refuses. A function handed along runs once the server has answered, taken or
   * refused, and the selection has been read again.
   */
  mutate: (variables: TVariables, onSettled?: () => void) => boolean
  /** What this control's write still out was fired with, the read after it included; null while none is. */
  pendingVariables: TVariables | null
}

/**
 * One write's edit as a refusal needs it: the selection from before it, and how far the cache had got with it.
 */
type EditSnapshot = {
  /** The selection as it stood before the edit. */
  previous: SelectionData
  /** How many times the cached selection had been set once the edit was, which any read landing since moves on. */
  editedUpdateCount: number
}

/**
 * What one write to the selection is made of.
 *
 * @template TVariables - What the write is fired with.
 */
type SelectionWriteConfig<TVariables> = Pick<
  OptimisticMutationConfig<void, TVariables, EditSnapshot | undefined>,
  'apiFn' | 'errorMessage'
> & {
  /** The selection as the write leaves it, shown before the server answers; null for a write that waits for it. */
  edit: ((data: SelectionData, variables: TVariables) => SelectionData) | null
}

/**
 * One write to the selection: shown ahead of the server where it can be, put back on a refusal, and followed by a
 * read of the whole selection, which the write is not over until it lands. A press made while any write to the
 * selection is still out is dropped, since what it names can have changed by the time that write lands. A write the
 * server took whose read then fails is still reported as saved.
 *
 * @template TVariables - What the write is fired with.
 *
 * @param config - What the write is made of.
 *
 * @returns The write, as the control firing it sees it.
 */
export function useSelectionWrite<TVariables>({
  apiFn,
  edit,
  errorMessage,
}: SelectionWriteConfig<TVariables>): SelectionWrite<TVariables> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // The React Query cache
  const queryClient = useQueryClient()

  // Where the reader's selection is cached
  const queryKey = useSelectionQueryKey()

  // The write, which hands the selection around its edit along for a refusal to put back
  const mutation = useOptimisticMutation<void, TVariables, EditSnapshot | undefined>({
    apiFn,
    scope: SELECTION_WRITE_SCOPE,
    // What the write does, shown at the press where it can be
    onMutate: (variables) => {
      // A write whose outcome only the server knows shows nothing ahead of it
      if (edit === null) return undefined

      // Any read still out would land the selection from before the write over what is shown. Cancelling it puts
      // the selection back at once, so the edit lands within the press, before anything that press redraws
      void queryClient.cancelQueries({ queryKey })

      // The selection as it stands
      const previous = queryClient.getQueryData<SelectionData>(queryKey)

      // Nothing cached yet, so nothing to show ahead
      if (previous === undefined) return undefined

      // The selection shown as the write will leave it
      queryClient.setQueryData<SelectionData>(queryKey, edit(previous, variables))

      // How many times the cached selection has been set, the edit included
      const editedUpdateCount = queryClient.getQueryState(queryKey)?.dataUpdateCount

      // The selection before the edit and the count after it, kept for a refusal to put back
      return editedUpdateCount === undefined ? undefined : { previous, editedUpdateCount }
    },
    onError: (_error, _variables, snapshot) => {
      // A refusal puts the selection back while the write's own edit is still what shows. A read landed on top of
      // it is left for the read after the write to set straight
      if (
        snapshot !== undefined &&
        queryClient.getQueryState(queryKey)?.dataUpdateCount === snapshot.editedUpdateCount
      ) {
        queryClient.setQueryData(queryKey, snapshot.previous)
      }
    },
    // The selection read again, the server's own word on the outcome
    onSettled: async (_data, error) => {
      // How many times a read of the selection had given up before this one
      const failedReadsBefore = queryClient.getQueryState(queryKey)?.errorUpdateCount ?? 0

      // The read, which keeps the write pending until it lands
      await invalidateSelection(queryClient)

      // And how many times since, one more when this read gave up too
      const failedReadsAfter = queryClient.getQueryState(queryKey)?.errorUpdateCount ?? 0

      // The server took the write but the page could not read it back, so the reader hears it went through
      if (error === null && failedReadsAfter > failedReadsBefore) {
        toast.warning(t('refreshFailed'))
      }
    },
    authReason: t('authReason'),
    errorMessage,
  })

  // A function which fires the write, unless another write to the selection is still out
  const mutate = (variables: TVariables, onSettled?: () => void) => {
    // A press made while a write is out is dropped, what it names being free to change before that one lands
    if (queryClient.isMutating({ predicate: isSelectionWrite }) > 0) return false

    // The write itself
    mutation.mutate(variables, { onSettled })

    // The write fired
    return true
  }

  // What the write still out was fired with
  const pendingVariables = mutation.isPending ? (mutation.variables ?? null) : null

  // The write, as the control firing it sees it
  return { mutate, pendingVariables }
}

/**
 * Whether any write to the selection is still out, the read after it included. A slot named while one is out can
 * name another problem by the time it lands.
 *
 * @returns True while any is out.
 */
export function useIsSelectionWriting(): boolean {
  // Whether any write in the selection's queue has yet to settle
  return useIsMutating({ predicate: isSelectionWrite }) > 0
}
