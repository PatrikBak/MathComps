using MathComps.Api.Constants;
using MathComps.Api.Extensions;
using MathComps.Domain.Contracts.EditorUploads;
using MathComps.Infrastructure.Services.EditorUploads;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for the files people upload into the text editor. An upload's request body is the file itself,
/// its <c>Content-Type</c> the file's media type.
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
        // Upload one file into the caller's own folder
        app.MapPost(FilesPath, async (HttpContext context, IEditorUploadService editorUploads) =>
        {
            // The file's media type, without parameters such as a charset
            var mediaType = context.Request.GetTypedHeaders().ContentType?.MediaType.Value
                ?? throw new BadHttpRequestException("An upload must name its file's media type.");

            // The caller's Clerk id, which names their folder of uploads
            var uploaderId = context.User.ClerkId ?? throw new UserNotResolvedException();

            // Store the file the body carries
            var upload = await editorUploads.UploadAsync(
                uploaderId, mediaType, context.Request.Body, context.RequestAborted);

            // Return the key the text names the file by
            return Results.Ok(upload);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Links to files the caller uploaded themselves
        app.MapPost($"{FilesPath}/links", (
            GetFileLinksRequest request,
            HttpContext context,
            IEditorUploadService editorUploads) =>
        {
            // A body naming no keys names no files
            if (request.Keys is not { } keys)
                throw new BadHttpRequestException("A request for links must name the files.");

            // The caller's Clerk id, which names their folder of uploads
            var uploaderId = context.User.ClerkId ?? throw new UserNotResolvedException();

            // The links to the caller's own files among them
            var links = editorUploads.LinksToOwnUploads(uploaderId, keys);

            // Return the links by upload key
            return Results.Ok(links);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}
