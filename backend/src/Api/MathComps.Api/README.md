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
