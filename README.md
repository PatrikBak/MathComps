# MathComps

The repository behind https://mathcomps.fun, a non-profit platform built for students and teachers. Browse and search mathematical competition problems, read study handouts, and defend a solution to an AI examiner. Next.js and .NET.

## Building it

Needs Node 20+, .NET SDK 10+, and Postgres 16+ with pgvector. Setup is in the [Backend README](backend/README.md) and the [Frontend README](web/README.md).

The problem archive is not in the repo, so a fresh database comes up empty. `cd web && npm run dev` alone serves the pages that do not need the API.

## License

AGPL-3.0, see [LICENSE](LICENSE).

## FAQ

**Q:** Is this vibe-coded?
**A:** Nowadays, I use Claude Code heavily to develop this. However, I still read the code, I still make the final decisions, and I still want to be on top of things. So far it's proven to be the right approach, as there have been many cases where letting it work on its own would bite, in either the shorter or the longer run. As someone who coded manually in the old days, I now feel empowered. I'm shipping much faster, as well as learning much faster. We're living in interesting times 🙃😀 