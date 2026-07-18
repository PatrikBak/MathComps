/**
 * Canned examiner replies, one per student turn in order. They stand in for the real engine's
 * Socratic probes, so they read as generic challenges that fit any problem.
 */
export const SCRIPTED_EXAMINER_REPLIES: string[] = [
  'Right so far. But you lean on that step as if it were obvious. Spell it out: *why* does it follow from what you established just before?',
  "Careful. You've shown the claim holds in the case you picked, but the problem asks for *all* of them. What rules out the case you skipped?",
  'That closes the gap I was worried about. Now, you invoked a bound without justifying it. Where does that bound come from, and is it tight enough for the conclusion?',
  "Good. So the argument stands for the main case. Convince me the boundary case doesn't break it.",
  'Fair, that holds. I have nothing left to push on here. Want to write up the final step cleanly, or take on a different problem?',
]

/**
 * The reply the mocked examiner falls back to once the scripted sequence is exhausted, keeping the
 * conversation coherent no matter how long it runs.
 */
export const FALLBACK_EXAMINER_REPLY: string =
  'That reasoning is sound. Restate the whole argument in order, and check that each step depends only on the ones before it.'
