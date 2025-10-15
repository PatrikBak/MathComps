# MathComps

A platform for browsing and searching mathematical competition problems, built with Next.js and .NET.

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

### AI Features (Optional)

- **Similarity**: Requires Python embedding service – see [Similarity README](backend/src/Tools/MathComps.Cli.Similarity/README.md)
- **Tagging**: Requires Gemini API key – see [Tagging README](backend/src/Tools/MathComps.Cli.Tagging/README.md)

## Prerequisites

- **Node.js** 20+ and npm
- **PostgreSQL** 16+ with **pgvector extension** (only for backend/problem search)
- **.NET SDK** 9.0+ (only for backend)
- **Python** 3.9+ (only for similarity features)

See [Backend README](backend/README.md) for database setup instructions.

## Project Structure

```
MathComps/
├── backend/                   # .NET backend (API + CLI tools)
│   ├── src/
│   │   ├── Api/               # Web API
│   │   ├── Core/              # Domain models
│   │   ├── Infrastructure/    # Database
│   │   └── Tools/             # CLI tools
│   └── services/
│       └── embedding-service/ # Python embedding service
├── web/                       # Next.js frontend
│   └── src/
│       ├── app/               # Pages
│       └── components/        # React components
└── data/                      # Raw data files
    ├── skmo/                  # SKMO competition data
    └── handouts/              # TeX handouts
```

## Documentation

- **[Backend README](backend/README.md)** – Database setup, API, CLI tools
- **[Frontend README](web/README.md)** – Development server, testing, commands
- **[Similarity System](backend/src/Tools/MathComps.Cli.Similarity/README.md)** – Similar problems suggestions
- **[Tagging Assistant](backend/src/Tools/MathComps.Cli.Tagging/README.md)** – AI categorization
- **[Embedding Service](backend/services/embedding-service/README.md)** – Python vector service

## Updating Content

1. **Make changes in data/skmo/archive**
2. **Run the SKMO problems CLI with default settings** - see [SKMO Problems README](backend/src/Tools/MathComps.Cli.SkmoProblems/README.md) for details
3. **Run the SKMO scraper to scrape links** if there is a new solution link on SKMO - see [SKMO Scraper README](backend/src/Tools/MathComps.Cli.SkmoScraper/README.md) for details

**Deploy (requires DB access):**

4. **Run the database seeder** (needs a connection to the real DB) - see [Database Seeder README](backend/src/Tools/MathComps.Cli.DatabaseSeeder/README.md) for details
5. **Run the update links** if there is a new link or new problems with an existing link
6. **Run the tagging tool** to tag new problems if there are any - see [Tagging README](backend/src/Tools/MathComps.Cli.Tagging/README.md) for details
7. **Run the similarity tool** to calculate similarities for new problems - see [Similarity README](backend/src/Tools/MathComps.Cli.Similarity/README.md) for details

## FAQ

**Q:** Is this vibe-coded?  
**A:** Depends.

- Backend mostly is not. I care about C# code, so I wanted to be in control. Though I find using AI quite efficient sometimes, like when I let it write very well-defined initial code and then fix it manually so it's how I want.
- Frontend mostly is. When I started coding this, I didn't have much frontend experience beforehand and this really helped. However, as things got bigger, refactoring was needed. For example, the problem library became very complicated and AI couldn't cope. Now I've learned a lot and use AI less, mostly the way I use it for the backend.
