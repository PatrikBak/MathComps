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
  use: { baseURL },
  projects: [
    // Not a test: this run exists to produce a signed-in browser state.
    { name: 'session', testMatch: /.*\.setup\.ts/ },
    // The actual tests, which sign nobody in and stub the backend out.
    { name: 'spec', testMatch: /.*\.spec\.ts/ },
  ],
  // Attach to an already-running dev server instead of starting a second one on the same port.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
  },
})
