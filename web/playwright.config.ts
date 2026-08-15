import { defineConfig } from '@playwright/test'

// The Clerk keys and the test account's credentials sit with the app's other local secrets, and the
// backend's address with the app's shared configuration. Loading the local file first is what gives
// it precedence, since an already-set variable is never overwritten by a later load.
process.loadEnvFile('.env.local')
process.loadEnvFile('.env')

// The origin the session is minted against, and the one Clerk scopes its cookie to.
const baseURL = 'http://localhost:3000'

/** Where the signed-in browser state is parked once the sign-in run finishes. */
export const storageStatePath = 'playwright/.clerk/user.json'

/** Playwright config */
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  // Clerk's testing token, minted once into the environment every worker is forked from.
  globalSetup: './e2e/support/global-setup.ts',
  use: { baseURL },
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
  // Attach to an already-running dev server instead of starting a second one on the same port.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
  },
})
