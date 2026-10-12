using MathComps.Api.Constants;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoint for reading the notes written across every defense conversation, gated by the
/// <see cref="AuthorizationPolicies.Admin"/> policy.
/// </summary>
public static class AdminNoteEndpoints
{
    /// <summary>
    /// The path the notes feed is read from.
    /// </summary>
    private const string NotesPath = "/admin/defense/notes";

    /// <summary>
    /// Maps the notes feed onto the route builder.
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
                reviewerId, openOnly, pageNumber, EndpointHelpers.GetRequestLanguage(), cancellationToken);

            // Return it
            return Results.Ok(feed);
        })
        .RequireAuthorization(AuthorizationPolicies.Admin)
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}
