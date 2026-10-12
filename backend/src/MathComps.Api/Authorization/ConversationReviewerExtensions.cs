using MathComps.Api.Constants;

namespace MathComps.Api.Authorization;

/// <summary>
/// Extension methods opening a route on one defense conversation to the reviewers picking the competitions' problems.
/// </summary>
public static class ConversationReviewerExtensions
{
    /// <summary>
    /// Opens a route reading or writing against one defense conversation to the reviewers as well as the admins, for
    /// the conversations the reviewers held about the proposals alone. The policy and the check on the conversation come
    /// together, so a route can't take the one without the other.
    /// </summary>
    /// <param name="builder">The route.</param>
    /// <returns>The route, for chaining.</returns>
    public static RouteHandlerBuilder RequireConversationReviewer(this RouteHandlerBuilder builder) =>
        // Admins and reviewers past the door, and the reviewers on to the reviewers' conversations alone
        builder
            .RequireAuthorization(AuthorizationPolicies.AdminOrPreparesCompetitions)
            .AddEndpointFilter<ProposalConversationFilter>();
}
