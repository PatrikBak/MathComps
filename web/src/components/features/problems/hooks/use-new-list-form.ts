'use client'

import { useTranslations } from 'next-intl'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { listNameSchema } from '../schemas/user-list-schemas'
import { useCreateUserList } from './use-create-user-list'

/**
 * The options of {@link useNewListForm}.
 */
type UseNewListFormOptions = {
  /** Called whenever the field opens or closes. */
  onCreatingChange?: (isCreating: boolean) => void
}

/**
 * The return type of {@link useNewListForm}.
 */
export type UseNewListFormResult = {
  /** Whether the name field is open. */
  isCreating: boolean
  /** The name typed so far. */
  name: string
  /** The name field. */
  inputRef: RefObject<HTMLInputElement | null>
  /** Whether the list is being created. */
  isPending: boolean
  /** Records a keystroke in the name field. */
  setName: (name: string) => void
  /** Opens the name field. */
  start: () => void
  /** Abandons the name typed so far and closes the field. */
  cancel: () => void
  /** Creates the list under the name typed, refusing a name the server would not take. */
  submit: () => void
}

/**
 * Hook for naming a new list: the field, what has been typed into it, and the naming rules.
 *
 * @param options - The options described by {@link UseNewListFormOptions}.
 *
 * @returns The form described by {@link UseNewListFormResult}.
 */
export function useNewListForm(options: UseNewListFormOptions = {}): UseNewListFormResult {
  // Translations for the filter sidebar
  const t = useTranslations('problems.filters')

  // Whether the name field is open
  const [isCreating, setIsCreatingRaw] = useState(false)

  // A function which opens or closes the field, passing the change on
  const setIsCreating = (value: boolean) => {
    setIsCreatingRaw(value)
    options.onCreatingChange?.(value)
  }

  // The name typed so far
  const [name, setName] = useState('')

  // The name field
  const inputRef = useRef<HTMLInputElement>(null)

  // Creating a list, and whether one is in flight
  const { createList, isPending } = useCreateUserList()

  // Focus lands on the field once it is on screen. It is sometimes mounted-but-hidden, which
  // focus does not reach, so this waits a tick past the commit that reveals it.
  useEffect(() => {
    if (isCreating) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [isCreating])

  // A function which opens the name field
  const start = () => setIsCreating(true)

  // A function which abandons the name typed so far
  const cancel = () => {
    setName('')
    setIsCreating(false)
  }

  // A function which creates the list under the name typed
  const submit = () => {
    // The name has to be one the server would accept
    const result = listNameSchema.safeParse(name)

    // A name it would not take goes back to the user
    if (!result.success) {
      toast.error(t('listNameInvalid'))
      return
    }

    // The field stays put until the new list is in the cache, so nothing blinks in its place
    createList(result.data, { onSuccess: cancel })
  }

  // The form
  return { isCreating, name, inputRef, isPending, setName, start, cancel, submit }
}
