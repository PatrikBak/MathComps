using MathComps.Api.Constants;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Users;

namespace MathComps.Api.Endpoints;

/// <summary>
/// Maps the endpoints handing a student's phone photos over to a defense composer open on another device. The
/// composer's routes need the student's account, and the phone's take none: the code is the only thing letting a phone
/// in, so it travels as the request's credential, in the <c>Authorization</c> header under <see cref="CodeScheme"/>,
/// which the request log never records and error reports file as filtered.
/// </summary>
public static class DefensePhotoHandoffEndpoints
{
    /// <summary>
    /// The scheme a phone sends its code under in the <c>Authorization</c> header.
    /// </summary>
    private const string CodeScheme = "PhotoHandoff";

    /// <summary>
    /// Base path for the handoff routes.
    /// </summary>
    private const string HandoffPath = $"{DefensePhotoEndpoints.PhotosPath}/handoff";

    /// <summary>
    /// Maps the <c>/defense/photos/handoff</c> endpoints onto the route builder.
    /// </summary>
    /// <param name="app">The route builder to register the endpoints on.</param>
    public static void MapDefensePhotoHandoffEndpoints(this IEndpointRouteBuilder app)
    {
        // Point the student's code at the problem their composer is on, making one if none works
        app.MapPost(HandoffPath, async (
            DefensePhotoHandoffRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefensePhotoHandoffService handoffService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Point the student's code at the problem
            var code = await handoffService.PointAsync(userId, request.Target, context.RequestAborted);

            // Return it
            return Results.Ok(code);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);

        // Take the pages the student's phone sent to the problem their composer is on, asked every few seconds
        app.MapPost($"{HandoffPath}/pages", async (
            DefensePhotoHandoffRequest request,
            HttpContext context,
            IUserManager userManager,
            IDefensePhotoHandoffService handoffService) =>
        {
            // Resolve the calling user
            var userId = await userManager.RequireUserIdAsync(context);

            // Take what waits for the problem
            var pages = await handoffService.TakeAsync(userId, request.Target, context.RequestAborted);

            // Return it
            return Results.Ok(pages);
        })
        .RequireAuthorization()
        .RequireRateLimiting(RateLimiterPolicies.AccountPollRateLimit);

        // Tell a phone where its code sends photos now, asked every few seconds with no account
        app.MapGet(HandoffPath, async (
            HttpContext context,
            IDefensePhotoHandoffService handoffService,
            IDefenseLimitsProvider limitsProvider) =>
        {
            // The phone's code
            var code = EndpointHelpers.GetAuthorizationCredential(context.Request, CodeScheme);

            // Where the code sends photos, named in the request's language
            var handoff = await handoffService.CheckAsync(
                code, EndpointHelpers.GetRequestLanguage(), context.RequestAborted);

            // Return it with the longest side a photo keeps once read
            return Results.Ok(new DefensePhotoHandoffCheckDto(handoff, limitsProvider.Limits.PhotoLongEdge));
        })
        .RequireRateLimiting(RateLimiterPolicies.AddressPollRateLimit);

        // Read a photo a phone sends by its code, the body being the photo file and the query its capture time
        app.MapPost($"{HandoffPath}/photos", async (
            DateTimeOffset capturedAt,
            HttpContext context,
            IDefensePhotoHandoffService handoffService) =>
        {
            // The phone's code
            var code = EndpointHelpers.GetAuthorizationCredential(context.Request, CodeScheme);

            // Read the photo as the code's student, the body only once the code is found to work
            var sent = await handoffService.SendAsync(
                code, capturedAt, context.Request.Body, EndpointHelpers.GetRequestLanguage(), context.RequestAborted);

            // Return the reading at the kept photo's location, as the composer's own reading routes do
            return Results.Created($"{DefensePhotoEndpoints.PhotosPath}/{sent.Reading.PhotoId}", sent);
        })
        .RequireRateLimiting(RateLimiterPolicies.ApiRateLimit);
    }
}
