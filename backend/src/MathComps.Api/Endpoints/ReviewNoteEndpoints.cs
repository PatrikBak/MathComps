using MathComps.Api.Authorization;
using MathComps.Api.Constants;
using MathComps.Domain.Contracts.ConversationReview;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for writing down what a reviewer notices in a defense conversation, each open to whoever
/// <see cref="ConversationReviewerExtensions.RequireConversationReviewer"/> lets reach the conversation.
/// </summary>
public static class ReviewNoteEndpoints
{
    /// <summary>
    /// The base path the note endpoints hang off.
    /// </summary>
    private const string NotesPath = "/admin/defense/notes";

    /// <summary>
    /// Maps the note endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapReviewNoteEndpoints(this IEndpointRouteBuilder app)
    {
        // Write a note
        app.MapPost(NotesPath, async (
            CreateReviewNoteRequest request,
            HttpContext context,
            IUserManager userManager,
            IReviewNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // A note saying nothing says nothing, a shape the wire can express and the service's own contract can't,
            // so it is refused here. One about no conversation never gets this far, since the route's filter refuses
            // a note naming none.
            if (request.SessionId is not { } sessionId || request.Content is not { } content)
                throw new ReviewNoteValueException();

            // The reviewer writing it, taken from the caller rather than from what they sent
            var authorId = await userManager.RequireUserIdAsync(context);

            // The note as written
            var note = await noteService.CreateAsync(
                authorId, sessionId, request.TurnId, content, request.Category, cancellationToken);

            // Return it at its own address
            return Results.Created($"{NotesPath}/{note.Id}", note);
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Revise a note
        app.MapPut($"{NotesPath}/{{noteId:guid}}", async (
            Guid noteId,
            UpdateReviewNoteRequest request,
            HttpContext context,
            IUserManager userManager,
            IReviewNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // A revision saying nothing is the wire's shape to express, not the service's to take
            if (request.Content is not { } content)
                throw new ReviewNoteValueException();

            // The reviewer revising it, taken from the caller rather than from what they sent
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // The note as revised
            var note = await noteService.UpdateAsync(
                reviewerId, noteId, content, request.Category, cancellationToken);

            // Return it
            return Results.Ok(note);
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Drop a note
        app.MapDelete($"{NotesPath}/{{noteId:guid}}", async (
            Guid noteId,
            HttpContext context,
            IUserManager userManager,
            IReviewNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer dropping it, taken from the caller rather than from what they sent
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Drop it
            await noteService.DeleteAsync(reviewerId, noteId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Settle a note
        app.MapPut($"{NotesPath}/{{noteId:guid}}/resolution", async (
            Guid noteId,
            IReviewNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // Mark it settled as of now
            await noteService.SetResolvedAsync(noteId, resolved: true, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Put a note back to standing
        app.MapDelete($"{NotesPath}/{{noteId:guid}}/resolution", async (
            Guid noteId,
            IReviewNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // Clear the settled stamp
            await noteService.SetResolvedAsync(noteId, resolved: false, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireConversationReviewer()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}
