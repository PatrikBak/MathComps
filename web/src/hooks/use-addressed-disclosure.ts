'use client'

import { useWindowEvent } from '@mantine/hooks'
import { useCallback, useMemo, useState } from 'react'

import { useAddressSync } from './use-address-sync'
import { useInitialUrlState } from './use-initial-url-state'

/**
 * What {@link useAddressedDisclosure} hands back.
 */
export type AddressedDisclosure = {
  /** Which of the things the query parameter names is open, or null while none is. */
  openedValue: string | null
  /** Opens the thing a value names, and puts that value on the address. */
  open: (value: string) => void
  /** Closes whatever is open, and takes its value back off the address. */
  close: () => void
}

/**
 * One open thing among many, named by a query parameter, so that the address bar is a link to what is on
 * screen and sending that link opens it again.
 *
 * Hold it above every thing that shares the parameter rather than inside each of them: one opening has to
 * close the last, and per-thing copies of the same parameter would each keep their own answer.
 *
 * {@link useAddressSync} keeps the address. An opening replaces it in place, and a navigation that drops the
 * parameter leaves the thing open and puts the parameter back. A step back or forward through history opens
 * what that step's address names, and closes the open thing when the address names none.
 *
 * @param param - The query parameter that names the open thing.
 *
 * @returns What is open, and the two ways to change it.
 */
export function useAddressedDisclosure(param: string): AddressedDisclosure {
  // What the address asked for when the page opened, which is what starts open
  const initialValue = useInitialUrlState((params) => params.get(param))

  // What is open now
  const [openedValue, setOpenedValue] = useState(initialValue)

  // The one query parameter this disclosure owns on the address
  const ownedParams = useMemo(() => [param], [param])

  // What is open, as the address should say it, or nothing while none is
  const query = openedValue === null ? '' : new URLSearchParams({ [param]: openedValue }).toString()

  // The address kept saying what is open, every other parameter left as it stands
  useAddressSync(query, ownedParams)

  // A function which opens the thing a value names
  const open = useCallback((value: string) => setOpenedValue(value), [])

  // A function which closes whatever is open
  const close = useCallback(() => setOpenedValue(null), [])

  // A function which opens what the address names, or closes whatever is open when it names nothing
  const followAddress = useCallback(
    () => setOpenedValue(new URLSearchParams(window.location.search).get(param)),
    [param]
  )

  // What the address names, open after every step back or forward through history
  useWindowEvent('popstate', followAddress)

  // What is open, and the two ways to change it
  return { openedValue, open, close }
}
