using MathComps.Api.Constants;
using MathComps.Api.Endpoints;
using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Authorization;

/// <summary>
/// Lets a caller through a route reading or writing against one defense conversation only where
/// <see cref="IConversationAccess"/> says they may reach it.
/// </summary>
/// <remarks>
/// The conversation is the one the note named by the route's <see cref="NoteIdRouteValue"/> stands on, else the one
/// named by its <see cref="SessionIdRouteValue"/> or by a new note's body. A route naming none lets nobody through.
/// </remarks>
/// <param name="userManager">Resolves the caller to their account.</param>
/// <param name="conversationAccess">Settles whether the caller may reach a conversation.</param>
public sealed class ConversationAccessFilter(
    IUserManager userManager, IConversationAccess conversationAccess) : IEndpointFilter
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

        // The caller, whose account and role decide what they reach
        var viewer = new ConversationViewer(
            await userManager.RequireUserIdAsync(httpContext),
            httpContext.User.IsInRole(ClerkClaims.AdminRole));

        // A note, settled through the conversation it stands on
        if (RouteGuid(httpContext, NoteIdRouteValue) is { } noteId)
            await conversationAccess.EnsureNoteAsync(noteId, viewer, httpContext.RequestAborted);

        // A conversation, named by the route or by a new note's body
        else if ((RouteGuid(httpContext, SessionIdRouteValue)
                     ?? context.Arguments.OfType<CreateReviewNoteRequest>().FirstOrDefault()?.SessionId)
                 is { } sessionId)
            await conversationAccess.EnsureConversationAsync(sessionId, viewer, httpContext.RequestAborted);

        // Nothing naming a conversation, so nothing to let anybody reach
        else
            throw new DefenseSessionNotFoundException();

        // A conversation the caller may reach
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
