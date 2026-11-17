'use client'

import { useWindowEvent } from '@mantine/hooks'
import { useCallback, useMemo, useState } from 'react'

import {
  type AddressedChoice,
  addressedOptionOf,
  addressedOptionQuery,
} from '@/components/shared/utils/url-utils'
import { useAddressSync } from '@/hooks/use-address-sync'
import { useInitialUrlState } from '@/hooks/use-initial-url-state'

/**
 * What {@link useAddressedChoice} hands back.
 *
 * @template TOption - One of the options.
 */
export type UseAddressedChoiceResult<TOption extends string> = {
  /** The option picked. */
  option: TOption
  /** Picks another option. */
  choose: (option: TOption) => void
}

/**
 * A setting carried in the URL, so a reload or a link opens on it too. It starts at what the URL says as the hook
 * first runs. A step back or forward through history takes it to the option that step's URL says. Changing it leaves
 * every other query parameter as it stands.
 *
 * @template TOption - One of the options.
 *
 * @param choice - The setting, the same object on every render.
 *
 * @returns The option picked and the way to pick another.
 */
export function useAddressedChoice<TOption extends string>(
  choice: AddressedChoice<TOption>
): UseAddressedChoiceResult<TOption> {
  // The option the URL held when the hook first ran
  const addressed = useInitialUrlState((searchParams) => addressedOptionOf(searchParams, choice))

  // The option picked, the URL's at first
  const [option, setOption] = useState(addressed)

  // The query parameter this setting owns
  const ownedParams = useMemo(() => [choice.param], [choice.param])

  // The URL kept in step with the option, other parameters left alone
  useAddressSync(addressedOptionQuery(choice, option), ownedParams)

  // A function which sets the option the URL names
  const followAddress = useCallback(
    () => setOption(addressedOptionOf(new URLSearchParams(window.location.search), choice)),
    [choice]
  )

  // The URL's option after every step back or forward through history
  useWindowEvent('popstate', followAddress)

  // The option picked and the way to pick another, the same object while the option stays
  return useMemo(() => ({ option, choose: setOption }), [option])
}
