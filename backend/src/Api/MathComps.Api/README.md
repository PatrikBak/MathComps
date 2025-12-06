# MathComps API

The main .NET Web API for the MathComps application. Provides endpoints for browsing problems, filtering, similarity search, and serving problem metadata.

## Setup

For database configuration and migrations, see the [main backend README](../../../README.md).

## Running the API

```bash
# From the API directory
cd backend/src/Api/MathComps.Api
dotnet run
```

The API will be available at `http://localhost:5000`.

## Configuration

The `appsettings.json` file contains settings for:

- **CORS Origins** – Allowed frontend URLs (already configured for `localhost:3000`)
- **Pagination** – Default and maximum page sizes for list endpoints
- **Similarity** – Problem similarity thresholds and result limits

## Webhooks

### Clerk User Synchronization

**Endpoint:** `POST /api/webhooks/clerk`

This webhook receives events from Clerk to synchronize user data with the local database. It handles user creation, updates, and deletion events.

**Configuration:** Set the webhook secret using user secrets (see [Backend README](../../../README.md#4-configure-clerk-webhooks-optional))

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

This will give you a public URL (e.g., `https://random-name.loca.lt`) that you can use in the Clerk Dashboard webhook settings. Configure the webhook endpoint as `https://your-url.loca.lt/api/webhooks/clerk`.
