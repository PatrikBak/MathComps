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

        // Comment threads on every kind of target
        app.MapCommentEndpoints();

        // The authenticated user's problem lists
        app.MapUserListEndpoints();

        // The authenticated user's own account
        app.MapUserEndpoints();

        // AI-examiner defense conversations
        app.MapDefenseEndpoints();

        // The competitions the site hosts itself: the groups, entries, and the problems an entry opens
        app.MapCompetitionEndpoints();

        // The admin's whoami endpoint, gated by the admin policy
        app.MapAdminEndpoints();

        // Reading one defense conversation back and recording how far it has been read
        app.MapConversationReviewEndpoints();

        // What gets written down while reviewing a conversation
        app.MapReviewNoteEndpoints();

        // The admin's queue of the students' defense conversations
        app.MapAdminDefenseReviewEndpoints();

        // The notes written across the conversations, read as one feed
        app.MapAdminNoteEndpoints();

        // Grading the hosted groups from the students' defense conversations
        app.MapAdminGradingEndpoints();

        // Picking the hosted competitions' papers from the proposals
        app.MapProblemSelectionEndpoints();

        // Add health check endpoint for monitoring
        app.MapHealthChecks("/health");

        // Return the app for chaining
        return app;
    }
}
