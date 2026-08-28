import { existsSync } from 'node:fs'

import { defineConfig } from '@playwright/test'

/** Where a developer's own secrets sit, which is a file only their machine has. */
const LOCAL_ENV_FILE = '.env.local'

// The Clerk keys and the test account's credentials sit with the app's other local secrets, and the
// backend's address with the app's shared configuration. Loading the local file first is what gives
// it precedence, since an already-set variable is never overwritten by a later load.
if (existsSync(LOCAL_ENV_FILE)) {
  process.loadEnvFile(LOCAL_ENV_FILE)
}

// The configuration the whole repo shares, which every machine has
process.loadEnvFile('.env')

// The origin the session is minted against, and the one Clerk scopes its cookie to. A worktree serves its
// own dev server on another port, and without an override the run attaches to whatever holds 3000 and
// tests somebody else's checkout, which reads as the code being broken rather than the wrong app answering.
const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3000'

/**
 * The port that origin is served on, which a dev server this run has to start needs telling. An origin
 * naming none is served on the default one, which is where the dev server puts itself anyway.
 */
const port = new URL(baseURL).port || '3000'

/** Where the signed-in browser state is parked once the sign-in run finishes. */
export const storageStatePath = 'playwright/.clerk/user.json'

/** Whether this run is CI's rather than somebody's own machine. */
const isCi = Boolean(process.env['CI'])

/** Playwright config */
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  // Tests inside one file may run at the same time, since a run otherwise cannot finish faster than
  // its longest file however many workers it is given.
  fullyParallel: true,
  // More workers than the runner has cores, since the time here goes on retry backoff and quiet
  // windows rather than on compute. A machine of one's own keeps Playwright's half-the-cores default.
  workers: isCi ? '100%' : undefined,
  // One retry tells a flake apart from a break
  retries: isCi ? 1 : 0,
  // A test.only left behind would otherwise green the suite by running a single test
  forbidOnly: isCi,
  // Clerk's testing token, minted once into the environment every worker is forked from.
  globalSetup: './e2e/support/global-setup.ts',
  // A retry keeps the trace of the attempt that failed, which is the whole of what a run nobody was
  // watching leaves behind.
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    // Not a test: this run exists to produce a signed-in browser state.
    { name: 'session', testMatch: /.*\.setup\.ts/ },
    // The tests that start with nobody signed in, which is most of them.
    { name: 'spec', testMatch: /.*\.spec\.ts/, testIgnore: /.*\.signed-in\.spec\.ts/ },
    // The tests that need a reader already signed in when the page loads. The session is minted
    // fresh for every run, since a test elsewhere ending one invalidates it for good.
    {
      name: 'signed-in',
      testMatch: /.*\.signed-in\.spec\.ts/,
      dependencies: ['session'],
      use: { storageState: storageStatePath },
    },
  ],
  webServer: {
    // What ships, on CI, which the job has already built: dev mode compiles a route the first time it
    // is asked for and renders it differently from the build these tests are a gate on.
    command: isCi ? `npm run start -- --port ${port}` : `npm run dev -- --port ${port}`,
    url: baseURL,
    // Attach to a server already up rather than starting a second one on the same port. Never on CI,
    // which has nothing of its own to attach to and would otherwise test whatever it found there.
    reuseExistingServer: !isCi,
  },
})
