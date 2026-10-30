import createNextIntlPlugin from 'next-intl/plugin'

/**
 * The config enabling i18n support + partial static generation
 */
export default createNextIntlPlugin()({
  // Pages prerender a static shell and stream in the parts that read request data. Data is cached
  // only where the code says 'use cache'
  cacheComponents: true,

  // Links prefetch with Next's standard behavior. Partial Prefetching would change what every link
  // fetches, and Next warns at startup until this is set either way
  partialPrefetching: false,

  // The AGENTS.md that next dev writes for coding agents, pointing them at the docs bundled with
  // Next. Off, so a dev run adds no untracked file to the app folder
  agentRules: false,
})
