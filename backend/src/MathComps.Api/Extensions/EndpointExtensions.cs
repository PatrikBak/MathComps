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
        // Problem catalog: filtering, competition browser, lookup, like/mark
        app.MapProblemEndpoints();

        // Threaded comments on problems, handouts and news
        app.MapCommentEndpoints();

        // The authenticated user's problem lists
        app.MapUserListEndpoints();

        // The authenticated user's own account
        app.MapUserEndpoints();

        // AI-examiner defense conversations
        app.MapDefenseEndpoints();

        // Admin-only endpoints, gated by the admin policy
        app.MapAdminEndpoints();

        // Reading every student's defense conversations back for review
        app.MapAdminDefenseReviewEndpoints();

        // What gets written down while reviewing those conversations
        app.MapAdminNoteEndpoints();

        // Add health check endpoint for monitoring
        app.MapHealthChecks("/health");

        // Return the app for chaining
        return app;
    }
}
