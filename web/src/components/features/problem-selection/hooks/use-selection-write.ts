'use client'

import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import {
  type OptimisticMutationConfig,
  useOptimisticMutation,
} from '@/hooks/use-optimistic-mutation'

import type { SelectionData } from '../model/selection-types'
import { invalidateSelection, useSelectionQueryKey } from './selection-cache'

/**
 * The queue every write to the selection runs in, one after another in the order they were fired.
 */
const SELECTION_WRITE_SCOPE = { id: 'problem-selection' }

/**
 * The key every write to the selection is filed under, which tells them apart from every other mutation.
 */
const SELECTION_WRITE_KEY = ['problem-selection'] as const

/**
 * The key a write changing what the slots hold is filed under, within {@link SELECTION_WRITE_KEY}.
 */
const SLOT_WRITE_KEY = [...SELECTION_WRITE_KEY, 'slots'] as const

/**
 * How many refused writes are reading the selection back. A write fired meanwhile lets those reads land, so the
 * selection is set straight before a slot is named on the strength of a refused edit.
 */
let refusalReadsOut = 0

/**
 * One write to the selection, as the control firing it sees it.
 *
 * @template TVariables - What the write is fired with.
 */
export type SelectionWrite<TVariables> = {
  /**
   * Fires the write, saying true, or drops the press, saying false. Only a write changing the slots is dropped, while
   * another such write is still out. The selection shows what the write does at once where that can be worked out
   * ahead of the server, and puts things back if the server refuses. A function handed along runs once the server
   * has answered, taken or refused, and the selection has been read again where the write waits for that.
   */
  mutate: (variables: TVariables, onSettled?: () => void) => boolean
  /** What this control's write still out was fired with, any read it waits for included; null while none is. */
  pendingVariables: TVariables | null
}

/**
 * One write's edit as a refusal needs it: the selection from before it, and how far the cache had got with it.
 */
type EditSnapshot = {
  /** The selection as it stood before the edit. */
  previous: SelectionData
  /** How many times the cached selection had been set once the edit was, which anything landing since moves on. */
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
  /** Whether the write can change what a slot holds. */
  changesSlots: boolean
}

/**
 * One write to the selection: shown ahead of the server where it can be, put back on a refusal, and followed by a
 * read of the whole selection, which the write is not over until it lands. A write the server took leaves that read
 * to a later write still out, which reads for both. A press firing a write that changes the slots is dropped while
 * another such write is still out, since the slot it names can have changed by the time that write lands. Every
 * other write waits its turn behind whatever is out. A write the server took whose own read then fails is still
 * reported as saved.
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
  changesSlots,
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
    mutationKey: changesSlots ? SLOT_WRITE_KEY : SELECTION_WRITE_KEY,
    // What the write does, shown at the press where it can be
    onMutate: (variables) => {
      // A write whose outcome only the server knows shows nothing ahead of it
      if (edit === null) return undefined

      // Any read still out would land the selection from before the write over what is shown. Cancelling it puts
      // the selection back at once, so the edit lands within the press, before anything that press redraws. A
      // refused write's read is left to land, and this write's own read brings the edit back
      if (refusalReadsOut === 0) void queryClient.cancelQueries({ queryKey })

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
      // A refusal puts the selection back while the write's own edit is still what shows. Anything landed on top of
      // it, a read or a later write's edit, is left for the read after the write to set straight
      if (
        snapshot !== undefined &&
        queryClient.getQueryState(queryKey)?.dataUpdateCount === snapshot.editedUpdateCount
      ) {
        queryClient.setQueryData(queryKey, snapshot.previous)
      }
    },
    // The selection read again, the server's own word on the outcome
    onSettled: async (_data, error) => {
      // A write taken while a later one is out leaves the read to that one, which shows both. A read now would cover
      // the later write's edit with the selection from before it. A refusal is read at once, so the selection is set
      // straight before a slot is named on the strength of it. The count takes in this write, out until it settles
      if (error === null && queryClient.isMutating({ mutationKey: SELECTION_WRITE_KEY }) > 1) {
        return
      }

      // How many times a read of the selection had given up before this one
      const failedReadsBefore = queryClient.getQueryState(queryKey)?.errorUpdateCount ?? 0

      // A refused write's read, counted while it is out so no write fired meanwhile cancels it
      if (error !== null) refusalReadsOut += 1

      // The read, which keeps the write pending until it lands
      await invalidateSelection(queryClient)

      // That read over, landed or given up
      if (error !== null) refusalReadsOut -= 1

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

  // A function which fires the write, unless it changes the slots while another write changing them is out
  const mutate = (variables: TVariables, onSettled?: () => void) => {
    // A press changing the slots is dropped while another write changing them is out, the slot it names being free
    // to change before that one lands
    if (changesSlots && queryClient.isMutating({ mutationKey: SLOT_WRITE_KEY }) > 0) return false

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
 * Whether any write to the selection is still out, any read it waits for included. A read landing meanwhile could
 * cover a write's edit with the selection from before it.
 *
 * @returns True while any is out.
 */
export function useIsSelectionWriting(): boolean {
  // Whether any write to the selection has yet to settle
  return useIsMutating({ mutationKey: SELECTION_WRITE_KEY }) > 0
}

/**
 * Whether a write changing what the slots hold is still out, any read it waits for included. A slot named while one
 * is out can name another problem by the time it lands.
 *
 * @returns True while one is out.
 */
export function useIsChangingSlots(): boolean {
  // Whether any write changing the slots has yet to settle
  return useIsMutating({ mutationKey: SLOT_WRITE_KEY }) > 0
}
