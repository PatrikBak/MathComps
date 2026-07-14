using MathComps.Api.Endpoints;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for mapping API endpoints.
/// </summary>
public static class EndpointExtensions
{
    /// <summary>
    /// Maps all API endpoints for the MathComps application.
    /// </summary>
    /// <param name="app">The web application to configure.</param>
    /// <returns>The configured web application for chaining.</returns>
    public static WebApplication MapApiEndpoints(this WebApplication app)
    {
        // Problem catalog: filtering, contest browser, lookup, like/mark
        app.MapProblemEndpoints();

        // Threaded comments on problems, handouts and news
        app.MapCommentEndpoints();

        // The authenticated user's problem lists
        app.MapUserListEndpoints();

        // Admin-only endpoints, gated by the admin policy
        app.MapAdminEndpoints();

        // Add health check endpoint for monitoring
        app.MapHealthChecks("/health");

        // Return the app for chaining
        return app;
    }
}
