namespace MathComps.Api.Authorization;

/// <summary>
/// Extension methods opening a route on one defense conversation to whoever may reach the conversation.
/// </summary>
public static class ConversationReviewerExtensions
{
    /// <summary>
    /// Opens a route reading or writing against one defense conversation to the signed-in callers
    /// <see cref="ConversationAccessFilter"/> lets reach it. The sign-in and the check on the conversation come
    /// together, so a route can't take the one without the other.
    /// </summary>
    /// <param name="builder">The route.</param>
    /// <returns>The route, for chaining.</returns>
    public static RouteHandlerBuilder RequireConversationReviewer(this RouteHandlerBuilder builder) =>
        // Anybody signed in past the door, and on only to the conversations they may reach
        builder
            .RequireAuthorization()
            .AddEndpointFilter<ConversationAccessFilter>();
}
