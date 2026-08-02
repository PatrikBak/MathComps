# MathComps API

The main .NET Web API for the MathComps application. Provides endpoints for browsing problems, filtering, similarity search, and serving problem metadata, plus the signed-in surfaces: comments, user lists, and the AI defense conversations described in the [Examiner CLI README](../MathComps.Cli.Examiner/README.md).

## Setup

For full setup — database configuration, migrations, and Clerk authentication — see the [main backend README](../../README.md#getting-started).

## Running the API

```bash
# From the API directory
cd backend/src/MathComps.Api
dotnet run
```

The API will be available at `http://localhost:5000`.

## Configuration

The `appsettings.json` file contains settings for:

- **CORS Origins** – Allowed frontend URLs (already configured for `localhost:3000`)
- **Pagination** – Default and maximum page sizes for list endpoints
- **Similarity** – Problem similarity thresholds and result limits

## Error responses

Business failures use RFC 9457 problem responses. Services (and endpoints) throw a plain, specific exception that lives next to the interface it comes from: `CommentNotFoundException`, `NotCommentAuthorException`, `ListNotFoundException`, and so on. The API layer owns all transport knowledge: `GlobalExceptionHandler` classifies each known exception into an HTTP status plus the machine-readable `errorCode` (e.g. `404` + `"CommentNotFound"`, `403` + `"NotCommentAuthor"`, `409` + `"CannotLikeOwnComment"`). The `ApiErrorCode` enum (`MathComps.Api.Errors`) is the source of truth for the codes and is mirrored to the frontend's `web/src/types/backend-error-codes.ts`, kept in lockstep by a parity test.

Anything the handler doesn't recognize is an unexpected fault, returned as a bare `500` problem, with no stack trace or HTML.

## Webhooks

### Clerk User Synchronization

**Endpoint:** `POST /webhooks/clerk`

This webhook receives events from Clerk to synchronize user data with the local database. It handles user creation, updates, and deletion events.

**Configuration:** Set the webhook secret using user secrets (see [Backend README](../../README.md#5-configure-clerk-authentication))

**Events handled:**

- `user.created` – Creates a new user record
- `user.updated` – Updates existing user information
- `user.deleted` – Soft-deletes the user

The webhook verifies request signatures using Svix to ensure authenticity.

> **Note:** Email events (`email.created`) are handled by the **Frontend** webhook to send custom emails via Resend.

**Testing the webhook locally:**

To test the webhook during development, you need to expose your local API to the internet so Clerk can send events to it:

```bash
# From the backend directory
cd backend

# Expose your local API (make sure it's running on port 5000)
npx localtunnel --port 5000
```

This will give you a public URL (e.g., `https://random-name.loca.lt`) that you can use in the Clerk Dashboard webhook settings. Configure the webhook endpoint as `https://your-url.loca.lt/webhooks/clerk`.
