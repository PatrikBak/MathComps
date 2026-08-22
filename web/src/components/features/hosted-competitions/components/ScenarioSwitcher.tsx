'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import type { EntryBlocker, EntryReader } from '../model/entry-reader'
import type { HostedCompetitionScenario } from '../services/hosted-competition-mock-service'
import { ANONYMOUS_SCENARIO } from '../services/hosted-competition-mock-service'

/**
 * What each scenario puts on the screen, led by the reader's state rather than the scenario's own name.
 *
 * Not product copy, so it is not translated and goes when the mocked service does.
 */
const SCENARIO_SUMMARY: Record<HostedCompetitionScenario, string> = {
  ready: 'signed in, ready to enter',
  'gate-blocked': 'signed in, profile unfilled',
  'first-entry': 'signed in, rules not yet accepted',
  running: 'signed in, clock running with 80 min left',
  expiring: 'signed in, clock running with 90 seconds left',
  finished: 'signed in, entry finished an hour ago',
  forfeited: 'signed in, gave the entry up for the problems',
}

/**
 * The value standing for no scenario at all.
 *
 * It does not mean signed out. It means nothing is mocked about who is reading, so the page falls back to
 * whatever Clerk session the browser actually has, which on a developer's machine is usually a signed-in
 * one. {@link ANONYMOUS_SCENARIO} is the one that forces the other answer.
 */
const NO_SCENARIO = 'none'

/**
 * The order they are offered in, which follows how far into the program a reader has got.
 *
 * Taken off the summaries, so a scenario added to the union has to be described here before it is offered.
 */
const SCENARIO_ORDER = Object.keys(SCENARIO_SUMMARY) as HostedCompetitionScenario[]

/**
 * Props for the {@link ScenarioSwitcher} component.
 */
type ScenarioSwitcherProps = {
  /** Who the page has decided is reading, mocked or real. */
  reader: EntryReader
  /** What the page has decided stands in the way, undefined while it is still working that out. */
  blocker: EntryBlocker | null | undefined
}

/**
 * Every state the mocked backend can put the page in, switchable without editing the address bar.
 *
 * Development only, and it goes when the mocked service does. It also prints what the page made of the
 * scenario, the Clerk session behind that being the one input nothing on screen shows.
 */
export function ScenarioSwitcher({ reader, blocker }: ScenarioSwitcherProps) {
  // Where the choice gets written
  const router = useRouter()

  // The address it gets written into
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /**
   * Puts the chosen scenario in the address, which is where the page reads it from.
   *
   * @param chosen - The scenario picked, or {@link NO_SCENARIO} for none.
   */
  function choose(chosen: string): void {
    // Everything else in the query string stays
    const next = new URLSearchParams(searchParams?.toString() ?? '')

    // Asking for no scenario is asking for the parameter to be gone
    if (chosen === NO_SCENARIO) {
      next.delete('scenario')
    } else {
      // Otherwise the chosen one replaces whatever was there
      next.set('scenario', chosen)
    }

    // A navigation rather than a rewrite, so the page re-reads the scenario
    const query = next.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }

  // Nothing of this reaches a student
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  // Whichever is on, or the visitor nobody mocked
  const current = searchParams?.get('scenario') ?? NO_SCENARIO

  return (
    // In the flow under the header, dashed so it never reads as part of the page
    <div className="mt-6 flex w-fit flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed border-foreground/25 px-3 py-2 text-xs">
      <span className="font-mono uppercase tracking-wide text-muted">dev scenario</span>

      <select
        value={current}
        onChange={(event) => choose(event.target.value)}
        className="rounded border border-foreground/15 bg-surface px-2 py-1 text-foreground"
      >
        <option value={NO_SCENARIO}>none (your real Clerk session)</option>
        <option value={ANONYMOUS_SCENARIO}>signed out, whatever the browser says</option>
        {SCENARIO_ORDER.map((scenario) => (
          <option key={scenario} value={scenario}>
            {SCENARIO_SUMMARY[scenario]} ({scenario})
          </option>
        ))}
      </select>

      {/* What the page made of it */}
      <span className="font-mono text-muted">
        {reader.kind} / gate: {blocker ?? (blocker === null ? 'clear' : '…')}
      </span>
    </div>
  )
}
