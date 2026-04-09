/**
 * Visual palette for the landing page hero section.
 */

/** Hero button gradient variants — each maps a name to raw gradient + shadow classes. */
export const HERO_GRADIENTS = {
  indigoPurple:
    'bg-gradient-to-b lg:bg-gradient-to-r from-indigo-700/40 to-purple-800/40 border border-foreground/10 hover:border-foreground/50 hover:shadow-indigo-700/20',
  violetPink:
    'bg-gradient-to-b lg:bg-gradient-to-r from-violet-700/40 to-fuchsia-800/40 border border-foreground/10 hover:border-foreground/50 hover:shadow-violet-700/20',
  pinkRose:
    'bg-gradient-to-b lg:bg-gradient-to-r from-fuchsia-700/40 to-pink-800/40 border border-foreground/10 hover:border-foreground/50 hover:shadow-fuchsia-700/20',
} as const
