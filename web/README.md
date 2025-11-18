# MathComps Frontend

A Next.js application for browsing and searching mathematical competition problems.

## Structure

- **`src/app/`** – Next.js App Router pages
  - `problems/` – Problem search and filtering
  - `handouts/` – Educational handouts viewer
  - `about/` – Project information
  - `guide/` – Orientation for exploring math contests
- **`src/components/`** – React components organized by purpose
  - `features/` – Page-specific feature components
  - `shared/` – Reusable components and utilities
  - `layout/` – Header, footer, navigation
  - `math/` – KaTeX rendering and math utilities
- **`src/content/`** – Static content (handouts JSON)

## Getting Started

### 1. Install Dependencies

```bash
cd web
npm install
```

### 2. Environment Configuration (Optional)

Most of the application works out of the box with sensible defaults. You only need to configure environment variables if you want to use the contact form or authentication functionality.

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

# Email address where contact form submissions will be sent
# Must be verified in your Resend account
CONTACT_EMAIL=contact@yourdomain.com

# Email address to send from (just the email, no name)
# Must be verified in your Resend account
SENDER_EMAIL=noreply@yourdomain.com
```

**Development Mode:** Leave email variables empty for development - the contact form will work without sending actual emails. Form data will be logged to the console instead, and you'll get helpful error messages for configuration issues.

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

### Handouts

Educational handouts are parsed from TeX and stored as JSON in [`src/content/handouts/`](src/content/handouts/). See the [Handouts CLI tool](../backend/src/Tools/MathComps.Cli.Handouts/README.md) for parsing instructions.

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
