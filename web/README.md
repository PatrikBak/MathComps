# MathComps Frontend

A Next.js application for browsing and searching mathematical competition problems.

## Structure

- **`src/app/`** – Next.js App Router pages
  - `[locale]/` – Localized routes (English canonical: `problems`, `handouts`, `news`, etc.)
  - `api/` – API routes (contact form, webhooks)
- **`src/components/`** – React components organized by purpose
  - `features/` – Page-specific feature components (problems, handouts, contact, etc.)
  - `shared/` – Reusable components and utilities
  - `layout/` – Header, footer, navigation
  - `math/` – KaTeX rendering and math utilities
  - `login/` – Authentication UI components
  - `animations/` – Animation components
  - `table-of-contents/` – ToC components for handouts
- **`src/constants/`** – Application constants (OG metadata, etc.)
- **`src/content/`** – Static content (handouts, news)
- **`src/i18n/`** – Internationalization config and routing
- **`src/hooks/`** – Custom React hooks
- **`src/lib/`** – Shared utilities (email, metadata, etc.)
- **`src/stores/`** – Zustand state stores
- **`src/types/`** – TypeScript type definitions
- **`messages/`** – Locale JSON files (cs.json, en.json, sk.json)

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

#### File Storage (Cloudflare R2)

For file upload functionality (e.g., image attachments), configure Cloudflare R2 storage:

```bash
# Cloudflare R2 Configuration
R2_BUCKET_NAME=your-bucket-name
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_PUBLIC_URL=https://your-bucket.r2.dev
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

## Available Commands

### Development

- `npm run dev` – Start development server with Turbopack
- `npm run build` – Production build
- `npm run preview` – Build and preview production version
- `npm start` – Start production server (requires `npm run build` first)

### Testing & Quality

- `npm test` – Run tests in watch mode
- `npm run test:run` – Run tests once (AI-agents-friendly)
- `npm run type-check` – TypeScript type checking
- `npm run lint` – Check for linting errors
- `npm run lint:fix` – Fix linting errors automatically
- `npm run format` – Format code with Prettier
- `npm run format:check` – Check code formatting
- `npm run knip` – Find unused files, exports, and dependencies
- `npm run knip:fix` – Remove unused code (be careful!)
- `npm run e2e:session` – Sign in and save a browser session (see [Signed-in browser](#signed-in-browser))

### Combined Commands

- `npm run check` – Run all quality checks (type-check, lint, format, knip)
- `npm run fix` – Auto-fix linting, formatting, and unused code
- `npm run ci` – Full CI pipeline (check + build)

## Key Technologies

- **Next.js 15** – React framework with App Router
- **React 19** – UI library
- **TypeScript** – Type safety
- **Tailwind CSS 4** – Styling
- **KaTeX** – Math rendering
- **TanStack Query** – Data fetching and caching
- **Resend** – Contact form email delivery
- **Vitest** – Testing framework

## Development Tips

### Math Rendering

All math content is rendered using KaTeX. See [`src/components/math/`](src/components/math/) for rendering utilities.

### Problem Search

The problem search feature is in [`src/components/features/problems/`](src/components/features/problems/). Key features:

- URL-based filter state
- Faceted search with tags and competitions
- Virtual infinite scrolling
- Similar problems integration

### Signed-in browser

`npm run e2e:session` produces a browser session for driving the app manually against local dev. It is not a test suite: it signs the E2E account in through Clerk's API (the sign-up form's Turnstile check deadlocks an automated browser) and writes `playwright/.clerk/user.json` plus a snippet at `.playwright-mcp/inject-session.mjs` that replays the session into a Playwright MCP browser. Both are git-ignored and hold live auth cookies.

Needs `E2E_CLERK_USER_EMAIL` and `E2E_CLERK_USER_PASSWORD` in `.env.local`, a dev server on port 3000, and `npx playwright install chromium` once per machine. The account must have a first name set, or the backend refuses to create its user row.

### Webhooks

**Purpose:** Handles `email.created` events to send custom-branded emails via Resend (replacing Clerk's default emails).
**Events:** `email.created` (Signup, Password Reset)

**Testing the webhook locally:**

To test the webhook during development, you need to expose your local API to the internet so Clerk can send events to it:

```bash
# From the web directory
cd web

# Expose your local app (make sure it's running on port 3000)
npx localtunnel --port 3000
```

This will give you a public URL (e.g., `https://random-name.loca.lt`) that you can use in the Clerk Dashboard webhook settings. Configure the webhook endpoint as `https://your-url.loca.lt/api/webhooks/clerk`.

### Handouts

Educational handouts are parsed from TeX and stored as JSON in [`src/content/handouts/`](src/content/handouts/). See the [Handouts CLI tool](../backend/src/MathComps.Cli.Handouts/README.md) for parsing instructions.

### Contact Form

The contact form feature includes:

- Modal-based contact form with validation
- Email submission via Resend API
- Bot detection with honeypot fields
- Form validation using Zod schemas
- Rate limiting handled by Cloudflare

Configuration is handled through environment variables (see [Environment Configuration](#2-environment-configuration-optional) section above).

## Troubleshooting

**Build fails:** Ensure dev server is stopped before running `npm run build`

**Tests hang:** Use `npm run test:run` instead of `npm test` for non-interactive mode

**Port 3000 busy:** Stop any running Next.js dev servers or change the port with `npm run dev -- -p 3001`

**API connection issues:** Check `NEXT_PUBLIC_API_URL` and backend is running (see [Backend README](../backend/README.md))

**Contact form not working:** Verify Resend API key and email configuration in `.env` file
