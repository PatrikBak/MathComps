import { defineConfig } from '@playwright/test'

// The Clerk keys and the test account's credentials sit with the app's other local secrets.
process.loadEnvFile('.env.local')

// The origin the session is minted against, and the one Clerk scopes its cookie to.
const baseURL = 'http://localhost:3000'

/** Where the signed-in browser state is parked once the sign-in run finishes. */
export const storageStatePath = 'playwright/.clerk/user.json'

/** Playwright config */
export default defineConfig({
  testDir: './e2e',
  // Nothing here is a test; the run exists to produce a signed-in browser state.
  testMatch: /.*\.setup\.ts/,
  reporter: 'list',
  use: { baseURL },
  // Attach to an already-running dev server instead of starting a second one on the same port.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
  },
})
