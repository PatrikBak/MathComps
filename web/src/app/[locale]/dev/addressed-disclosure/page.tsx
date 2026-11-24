'use client'

import { Suspense } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { Button } from '@/components/shared/components/Button'
import { useAddressedDisclosure } from '@/hooks/use-addressed-disclosure'

import type { HarnessGroup } from './addressed-disclosure-harness'
import { HARNESS_COPY, HARNESS_GROUPS, HARNESS_ROUTE } from './addressed-disclosure-harness'

/**
 * Props for the {@link DisclosureGroup} component.
 */
type DisclosureGroupProps = {
  /** The set it shows. */
  group: HarnessGroup
}

/**
 * One set of things, a button opening each and one closing whatever is open, over a line saying which is open.
 */
function DisclosureGroup({ group }: DisclosureGroupProps) {
  // Which of the set's things is open, as the address names it, and the ways to change it
  const { openedValue, open, close } = useAddressedDisclosure(group.param)

  // The set's status line, naming the open thing or saying none is
  const status = openedValue === null ? HARNESS_COPY.noneOpen : HARNESS_COPY.opened(openedValue)

  // The buttons, then the line saying which thing is open
  return (
    <section aria-label={group.title} className="space-y-2">
      <h2 className="font-semibold">{group.title}</h2>
      <div className="flex gap-2">
        {group.values.map((value) => (
          <Button key={value} variant="secondary" onClick={() => open(value)}>
            {HARNESS_COPY.open(value)}
          </Button>
        ))}
        <Button variant="secondary" onClick={close}>
          {HARNESS_COPY.close}
        </Button>
      </div>
      <p role="status">{status}</p>
    </section>
  )
}

/**
 * Dev-only harness for {@link useAddressedDisclosure} on its own: sets of things sharing one address, each set with
 * a parameter of its own, and a link to the page itself, which drops every parameter from the address.
 */
export default function AddressedDisclosurePage() {
  // The sets, then the link, drawn in the browser, which holds the address they read
  return (
    <Suspense fallback={null}>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {HARNESS_GROUPS.map((group) => (
          <DisclosureGroup key={group.param} group={group} />
        ))}
        <AppLink href={HARNESS_ROUTE}>{HARNESS_COPY.thisPage}</AppLink>
      </div>
    </Suspense>
  )
}
