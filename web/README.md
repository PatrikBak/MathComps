# MathComps Frontend

A Next.js application for browsing and searching mathematical competition problems.

## Structure

- **`src/app/`** – Next.js App Router pages
  - `[locale]/` – Localized routes (English canonical: `problems`, `handouts`, `news`, etc.)
  - `api/` – API routes (contact form, webhooks)
- **`src/components/`** – React components organized by purpose
  - `features/` – Page-specific feature components (problems, handouts, defense, contact, etc.)
  - `shared/` – Reusable components and utilities
  - `layout/` – Header, footer, navigation
  - `math/` – KaTeX rendering and math utilities
  - `login/` – Authentication UI components
  - `animations/` – Animation components
  - `table-of-contents/` – ToC components for handouts
- **`src/constants/`** – Application constants (OG metadata, etc.)
- **`src/content/`** – Static content; the handout JSON is built by the [Handouts CLI](../backend/src/MathComps.Cli.Handouts/README.md)
- **`src/i18n/`** – Internationalization config and routing
- **`src/hooks/`** – Hooks more than one feature uses
- **`src/lib/`** – Shared utilities (email, metadata, etc.)
- **`src/stores/`** – Zustand state stores
- **`src/types/`** – Types that cross a boundary: the API contract, the backend's error codes, webhook payloads, globals
- **`messages/`** – Locale JSON files (cs.json, en.json, sk.json)
- **`scripts/`** – Build-time validators and generators, plus the [draft-format spec](scripts/PREFLIGHT_README.md) the bulk importer reads

Anything one feature owns lives with that feature under `src/components/features/`, hooks and types included. The top-level folders are for what several features share.

## Getting Started

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Environment Configuration (Optional)

Most of the application works out of the box with sensible defaults. You only need to configure environment variables if you want to use the contact form, authentication, or file upload functionality.

#### Authentication (Clerk)

To enable user authentication, configure Clerk in your `.env.local` file. The necessary credentials can be found in the Clerk dashboard.

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
CLERK_SECRET_KEY=your_clerk_secret_key_here

# Only the /api/webhooks/clerk route reads this one
CLERK_WEBHOOK_SECRET=whsec_your_signing_secret
```

**Development Mode:** Leave Clerk variables empty to disable authentication entirely. The app will work normally without login functionality.

#### Contact Form Emails (Resend)

**For contact form emails, configure in `.env.local`:**

```bash
# Email Configuration (for contact form)
# Get API key from https://resend.com/
RESEND_API_KEY=your-resend-api-key-here

# Email address where contact form submissions will be sent / used in the privacy page.
# For email-sending it must be configured and verified in the Resend account.
NEXT_PUBLIC_CONTACT_EMAIL=contact@yourdomain.com
```

**Development Mode:** Leave email variables empty for development - the contact form will work without sending actual emails. Form data will be logged to the console instead, and you'll get helpful error messages for configuration issues.

Rate limiting on the form is Cloudflare's, not the app's.

#### File Storage (Cloudflare R2)

For file upload functionality (e.g., image attachments), configure Cloudflare R2 storage:

```bash
# Cloudflare R2 Configuration
R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
NEXT_PUBLIC_R2_URL=https://your-bucket.r2.dev
```

These credentials can be obtained from the [Cloudflare Dashboard](https://dash.cloudflare.com/) under R2 Object Storage.

**Development Mode:** Leave R2 variables empty during development – file upload features will be disabled, but the rest of the application will work normally.

**Other available variables (have good defaults):**

- `NEXT_PUBLIC_API_URL` – The URL where the API listens to (defaults to `http://localhost:5000` for .NET)
- `NEXT_PUBLIC_SITE_URL` – The URL of the website itself, used for Open Graph metadata, canonical URLs, and social media sharing (defaults to `http://localhost:3000`)

### 3. Backend API Connection

The frontend connects to the backend API using `NEXT_PUBLIC_API_URL` from your environment variables.

For backend API setup, see the [Backend README](../backend/README.md).

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Build for Production

```bash
# Stop dev server first (Ctrl+C), then build
npm run build

# Preview the production build
npm run preview
```

## Commands

Most script names say what they do, and `package.json` has all of them. The ones with a catch:

- `npm start` – Start the production server; needs `npm run build` first
- `npm run test:run` – Run tests once, rather than `npm test`'s watch mode
- `npm run knip` – Find unused files, exports, and dependencies
- `npm run knip:fix` – Remove unused code (be careful, it deletes files)
- `npm run e2e:session` – Sign in and save a browser session (see [Signed-in browser](#signed-in-browser))
- `npm run e2e` – Run the whole Playwright suite (CI runs it as its own job). Narrow it with Playwright's own flags, e.g. `--project=spec` or a filename
- `npm run check` – Type-check, lint, format check, knip, and every content validator
- `npm run fix` – Auto-fix linting, formatting, and unused code
- `npm run ci` – `check`, then the unit tests, then the build

## Gotchas

### Browser tests

Every backend call the specs make is answered by a stub, so the suite needs no API and no database. The runner in [`e2e/support/test.ts`](e2e/support/test.ts) refuses anything no stub claimed and fails the test naming the call, which is how a new test that quietly leans on a local backend gets caught. Two things to know when writing one: a call your page makes needs a stub even when your test is about something else, and `route.continue()` reaches the network rather than the stubs, so nothing may use it.

### Signed-in browser

`npm run e2e:session` produces a browser session for driving the app manually against local dev. It is not a test suite: it signs the E2E account in through Clerk's API (the sign-up form's Turnstile check deadlocks an automated browser) and writes `playwright/.clerk/user.json` plus a snippet at the repo root's `.playwright-mcp/inject-session.mjs` that replays the session into a Playwright MCP browser. Both are git-ignored and hold live auth cookies.

Needs `E2E_CLERK_USER_EMAIL` and `E2E_CLERK_USER_PASSWORD` in `.env.local`, a dev server on port 3000, and `npx playwright install chromium` once per machine.

The same session is what the `signed-in` specs start from, minted fresh each run. A spec that needs to end a session mid-test signs in on its own instead, since ending one invalidates it for good and every spec sharing it would start out dead.

### Mathilda (AI defense)

Mathilda is the AI examiner a student defends a handout solution to. The feature lives in [`src/components/features/defense/`](src/components/features/defense/) and talks to the backend's `/defense/sessions` routes.

- **There is no defense route.** The whole feature is modals, opened from a handout environment card or from the user menu.
- **The client names the problem rather than sending it.** A start carries the environment id; the backend resolves the statement, reference and hints and snapshots them onto the session.
- **Reading the conversations back is a route:** [`/admin/defenses`](src/app/[locale]/admin/defenses/page.tsx), gated by the Clerk admin role.

A turn is several LLM calls and takes about 40 seconds, so develop against `"Examiner:UseFake": true` in the backend config.

## Webhooks

`/api/webhooks/clerk` handles Clerk's `email.created` event, sending signup and password-reset mail through Resend. To exercise it locally, Clerk needs a public URL to reach:

```bash
# From the web directory
cd web

# Expose your local app (make sure it's running on port 3000)
npx localtunnel --port 3000
```

This will give you a public URL (e.g., `https://random-name.loca.lt`) that you can use in the Clerk Dashboard webhook settings. Configure the webhook endpoint as `https://your-url.loca.lt/api/webhooks/clerk`.
