using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Admin;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for what gets written down while reviewing defense conversations, gated by the
/// <see cref="AuthorizationPolicies.Admin"/> policy.
/// </summary>
public static class AdminNoteEndpoints
{
    /// <summary>
    /// The base path the note endpoints hang off.
    /// </summary>
    private const string NotesPath = "/admin/defense/notes";

    /// <summary>
    /// Maps the <c>/admin/defense/notes</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapAdminNoteEndpoints(this IEndpointRouteBuilder app)
    {
        // Read notes across every conversation
        app.MapGet(NotesPath, async (
            HttpContext context,
            IUserManager userManager,
            IAdminNoteService noteService,
            CancellationToken cancellationToken,
            int pageNumber,
            bool openOnly = false) =>
        {
            // The reviewer asking, which is what each note's authorship is reported against
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // The page of notes, each carrying where it was written
            var feed = await noteService.GetFeedAsync(
                reviewerId, openOnly, pageNumber, cancellationToken);

            // Return it
            return Results.Ok(feed);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Write a note
        app.MapPost(NotesPath, async (
            CreateAdminNoteRequest request,
            HttpContext context,
            IUserManager userManager,
            IAdminNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // A note about no conversation has nowhere to live, and one saying nothing says nothing. Both are
            // shapes the wire can express and the service's own contract can't, so they are refused here.
            if (request.SessionId is not { } sessionId || request.Content is not { } content)
                throw new AdminNoteValueException();

            // The reviewer writing it, taken from the caller rather than from what they sent
            var authorId = await userManager.RequireUserIdAsync(context);

            // The note as written
            var note = await noteService.CreateAsync(
                authorId, sessionId, request.TurnId, content, request.Category, cancellationToken);

            // Return it at its own address
            return Results.Created($"{NotesPath}/{note.Id}", note);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Revise a note
        app.MapPut($"{NotesPath}/{{noteId:guid}}", async (
            Guid noteId,
            UpdateAdminNoteRequest request,
            HttpContext context,
            IUserManager userManager,
            IAdminNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // A revision saying nothing is the wire's shape to express, not the service's to take
            if (request.Content is not { } content)
                throw new AdminNoteValueException();

            // The reviewer revising it, taken from the caller rather than from what they sent
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // The note as revised
            var note = await noteService.UpdateAsync(
                reviewerId, noteId, content, request.Category, cancellationToken);

            // Return it
            return Results.Ok(note);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Drop a note
        app.MapDelete($"{NotesPath}/{{noteId:guid}}", async (
            Guid noteId,
            HttpContext context,
            IUserManager userManager,
            IAdminNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // The reviewer dropping it, taken from the caller rather than from what they sent
            var reviewerId = await userManager.RequireUserIdAsync(context);

            // Drop it
            await noteService.DeleteAsync(reviewerId, noteId, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Settle a note
        app.MapPut($"{NotesPath}/{{noteId:guid}}/resolution", async (
            Guid noteId,
            IAdminNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // Mark it settled as of now
            await noteService.SetResolvedAsync(noteId, resolved: true, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Put a note back to standing
        app.MapDelete($"{NotesPath}/{{noteId:guid}}/resolution", async (
            Guid noteId,
            IAdminNoteService noteService,
            CancellationToken cancellationToken) =>
        {
            // Clear the settled stamp
            await noteService.SetResolvedAsync(noteId, resolved: false, cancellationToken);

            // Nothing to return
            return Results.NoContent();
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}
