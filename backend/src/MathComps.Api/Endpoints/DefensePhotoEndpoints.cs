using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints for the photos students take of their handwritten work, reading one for a defense of a handout
/// environment or of a problem. A reading's request body is the photo file itself. Every route needs an account.
/// </summary>
public static class DefensePhotoEndpoints
{
    /// <summary>
    /// Base path for the photo routes.
    /// </summary>
    private const string PhotosPath = "/defense/photos";

    /// <summary>
    /// Maps the <c>/defense/photos</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapDefensePhotoEndpoints(this IEndpointRouteBuilder app)
    {
        // Read a photo for a defense of one handout environment
        app.MapPost(PhotosPath, (
            string handoutContentId,
            string environmentId,
            HttpContext context,
            IUserManager userManager,
            IDefensePhotoService photoService) =>
            // Read the request's photo against the environment
            ReadAsync(new HandoutEnvironmentTarget(handoutContentId, environmentId), context, userManager, photoService))
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Read a photo for a defense of one problem
        app.MapPost($"{PhotosPath}/problems/{{problemId:guid}}", (
            Guid problemId,
            HttpContext context,
            IUserManager userManager,
            IDefensePhotoService photoService) =>
            // Read the request's photo against the problem
            ReadAsync(new ProblemTarget(problemId), context, userManager, photoService))
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }

    /// <summary>
    /// Reads the photo a request's body carries for a defense of a target.
    /// </summary>
    /// <param name="target">What the student is defending.</param>
    /// <param name="context">The request, its body the photo file.</param>
    /// <param name="userManager">Resolves the calling user.</param>
    /// <param name="photoService">Reads and keeps the photo.</param>
    /// <returns>The reading, created at the kept photo's address.</returns>
    private static async Task<IResult> ReadAsync(
        DefenseTarget target, HttpContext context, IUserManager userManager, IDefensePhotoService photoService)
    {
        // Resolve the calling user
        var userId = await userManager.RequireUserIdAsync(context);

        // The photo file, read whole out of the body
        using var photo = new MemoryStream();
        await context.Request.Body.CopyToAsync(photo, context.RequestAborted);

        // Read the photo
        var reading = await photoService.ReadAsync(
            userId, target, photo.GetBuffer().AsMemory(0, (int)photo.Length), context.RequestAborted);

        // Return the reading at the kept photo's location
        return Results.Created($"{PhotosPath}/{reading.PhotoId}", reading);
    }
}
