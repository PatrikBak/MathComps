'use client'

import { useCallback, useState } from 'react'

import { replaceQuery } from '@/components/shared/utils/url-utils'

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
 * The address is written straight to history rather than routed. The page has already answered for
 * everything the parameter names, so a route would refetch it to change nothing the reader can see, and a
 * pushed entry would make the back button walk the openings instead of leaving the page.
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

  // A function which puts the opening on the address, keeping every other parameter as it stands. It reads
  // the live address, so an opening lands on top of whatever else has written to it since this render
  const publish = useCallback(
    (value: string | null) => {
      // The query as it stands
      const query = new URLSearchParams(window.location.search)

      // Say what is open, or stop saying anything
      if (value === null) {
        query.delete(param)
      } else {
        query.set(param, value)
      }

      // And put it back, leaving the page where it stands
      replaceQuery(query.toString())
    },
    [param]
  )

  // A function which opens the thing a value names
  const open = useCallback(
    (value: string) => {
      setOpenedValue(value)
      publish(value)
    },
    [publish]
  )

  // A function which closes whatever is open
  const close = useCallback(() => {
    setOpenedValue(null)
    publish(null)
  }, [publish])

  // What is open, and the two ways to change it
  return { openedValue, open, close }
}
