using MathComps.Api.Constants;
using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Infrastructure.Services.Selection;

namespace MathComps.Api.Authorization;

/// <summary>
/// Lets a caller who is no admin through a route reading or writing against one defense conversation only where it
/// is a reviewer's conversation about a proposal the selection holds. An admin reaches every conversation.
/// </summary>
/// <remarks>
/// The conversation is the one the note named by the route's <see cref="NoteIdRouteValue"/> stands on, else the one
/// named by its <see cref="SessionIdRouteValue"/> or by a new note's body. A route naming none lets nobody but an
/// admin through.
/// </remarks>
/// <param name="proposalConversations">Settles whether a conversation is a reviewer's about a proposal.</param>
public sealed class ProposalConversationFilter(IProposalConversations proposalConversations) : IEndpointFilter
{
    /// <summary>
    /// The route value naming a conversation.
    /// </summary>
    public const string SessionIdRouteValue = "id";

    /// <summary>
    /// The route value naming a note.
    /// </summary>
    public const string NoteIdRouteValue = "noteId";

    /// <inheritdoc/>
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        // The request, with who is asking and what its route names
        var httpContext = context.HttpContext;

        // An admin reaches every conversation
        if (httpContext.User.IsInRole(ClerkClaims.AdminRole))
            return await next(context);

        // A note, settled through the conversation it stands on
        if (RouteGuid(httpContext, NoteIdRouteValue) is { } noteId)
            await proposalConversations.EnsureNoteAsync(noteId, httpContext.RequestAborted);

        // A conversation, named by the route or by a new note's body
        else if ((RouteGuid(httpContext, SessionIdRouteValue)
                     ?? context.Arguments.OfType<CreateReviewNoteRequest>().FirstOrDefault()?.SessionId)
                 is { } sessionId)
            await proposalConversations.EnsureConversationAsync(sessionId, httpContext.RequestAborted);

        // Nothing naming a conversation, so nothing to let anybody but an admin reach
        else
            throw new SelectionTargetNotFoundException();

        // A reviewer's conversation about a proposal
        return await next(context);
    }

    /// <summary>
    /// Reads an id out of the request's route.
    /// </summary>
    /// <param name="httpContext">The request.</param>
    /// <param name="name">The name of the route value holding the id.</param>
    /// <returns>The id; null where the route holds none under <paramref name="name"/>.</returns>
    private static Guid? RouteGuid(HttpContext httpContext, string name) =>
        // The value, where it reads as an id
        Guid.TryParse(httpContext.Request.RouteValues[name]?.ToString(), out var id) ? id : null;
}
