using MathComps.Api.Constants;
using MathComps.Domain.Contracts.EditorUploads;
using MathComps.Infrastructure.Services.EditorUploads;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for the files people upload into the text editor.
/// </summary>
public static class FileEndpoints
{
    /// <summary>
    /// Base path the file routes derive from.
    /// </summary>
    private const string FilesPath = "/files";

    /// <summary>
    /// Maps the <c>/files</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        // Links to files the caller uploaded themselves
        app.MapPost($"{FilesPath}/links", (
            GetFileLinksRequest request,
            HttpContext context,
            IEditorUploadService editorUploads) =>
        {
            // A body naming no keys names no files
            if (request.Keys is not { } keys)
                throw new BadHttpRequestException("A request for links must name the files.");

            // The links to the caller's own files among them
            var links = editorUploads.LinksToOwnUploads(UploaderIdOf(context), keys);

            // Return the links by upload key
            return Results.Ok(links);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }

    /// <summary>
    /// The signed-in caller's Clerk user id, which names their folder of uploads.
    /// </summary>
    /// <param name="context">The HTTP context carrying the caller's claims.</param>
    /// <returns>The caller's Clerk user id.</returns>
    /// <exception cref="UserNotResolvedException">Thrown when the request carries no subject claim.</exception>
    private static string UploaderIdOf(HttpContext context) =>
        // The caller's subject claim
        context.User.FindFirst(ClerkClaims.Subject)?.Value ?? throw new UserNotResolvedException();
}
