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

### 2. Connect to Backend API (Optional)

The frontend automatically connects to `http://localhost:5000` in development (configured in `.env.development`).

To use a different API URL, create a `.env.local` file:

```bash
# Override the default backend URL
echo "NEXT_PUBLIC_API_URL=http://your-custom-url" > .env.local
```

For backend API setup, see the [Backend README](../backend/README.md).

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 4. Build for Production

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

## Troubleshooting

**Build fails:** Ensure dev server is stopped before running `npm run build`

**Tests hang:** Use `npm run test:run` instead of `npm test` for non-interactive mode

**Port 3000 busy:** Stop any running Next.js dev servers or change the port with `npm run dev -- -p 3001`

**API connection issues:** Check `NEXT_PUBLIC_API_URL` and backend is running (see [Backend README](../backend/README.md))
