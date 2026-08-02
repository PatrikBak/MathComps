# MathComps

A repository for the website https://mathcomps.fun.

It is a platform for browsing and searching mathematical competition problems, reading study handouts, and defending a solution to an AI examiner, built with Next.js and .NET.

## Quick Start

Choose your path based on what you want to work on:

### Frontend Only (no problem library)

No backend required for static content:

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000`. **See [Frontend README](web/README.md) for details.**

### Full Stack (Frontend + Backend)

For problem search and full functionality:

1. **Backend**: Follow [Backend README](backend/README.md) to set up database, migrations, and API
2. **Frontend**: Follow [Frontend README](web/README.md) to install and run dev server

The frontend automatically connects to `http://localhost:5000` by default (no configuration needed).

## Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** 16+ with **pgvector extension** (only for backend/problem search)
- **.NET SDK** 10.0+ (only for backend)

See [Backend README](backend/README.md) for database setup instructions.

## Project Structure

```
MathComps/
├── backend/                   # .NET backend (API + CLI tools)
│   ├── src/                   # All projects flat, named MathComps.*
│   │   ├── MathComps.Api               # Web API + Webhooks
│   │   ├── MathComps.Domain            # Domain models & DTOs
│   │   ├── MathComps.TexParser         # TeX parsing
│   │   ├── MathComps.Infrastructure    # Database, EF Core, services
│   │   ├── MathComps.Shared            # Shared utilities
│   │   ├── MathComps.Shared.Cli        # Shared CLI helpers
│   │   └── MathComps.Cli.*             # CLI tools (BulkImport, Tagging, Handouts, …)
│   └── tests/                 # Test projects
├── web/                       # Next.js frontend + Webhooks
│   └── src/
│       ├── app/               # Pages (App Router)
│       ├── components/        # React components
│       ├── content/           # News & handouts content
│       ├── hooks/             # React hooks
│       ├── i18n/              # Internationalization
│       └── lib/               # Utilities
└── data/                      # Raw data files
    └── handouts/              # TeX handouts
```

## Webhooks Architecture

The application uses two separate Clerk webhooks to handle different responsibilities:

- **Frontend (`/api/webhooks/clerk`)**: Handles **Email Delivery**.
  - **Event**: `email.created`
  - **Purpose**: Intercepts Clerk's email requests to send custom-branded verification emails (signup, password reset) via Resend.

- **Backend (`/webhooks/clerk`)**: Handles **User Synchronization**.
  - **Events**: `user.created`, `user.updated`, `user.deleted`
  - **Purpose**: Syncs Clerk user data to the local PostgreSQL database for relational data integrity.

## Documentation

- **[Backend README](backend/README.md)**
- **[Frontend README](web/README.md)**

## FAQ

**Q:** Is this vibe-coded?
**A:** Depends.

- Backend mostly is not. I care about C# code, so I wanted to be in control. Though I find using AI quite efficient sometimes, like when I let it write very well-defined initial code and then fix it manually so it's how I want 😇
- Frontend started that way. Nowadays I slowly try to refactor more and more and get rid of AI-ish codes. Only when I looked did I relize how poor AI codes can be, creating solutions that are hard to maintain. I guess I'm not a good vibe-coder for I care too much 🙃
