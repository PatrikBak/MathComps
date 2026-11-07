using System.Net.Mime;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Defense;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers what the photo reading routes read off a request. A reading handed the wrong target is gated and billed as
/// the wrong defense, and nothing on the site looks broken.
/// </summary>
public class DefensePhotoEndpointsTests
{
    /// <summary>
    /// The subject every caller here signs in under.
    /// </summary>
    private const string CallerSubject = "ext-student";

    /// <summary>
    /// The account the caller resolves to.
    /// </summary>
    private static readonly Guid _callerId = Guid.CreateVersion7();

    /// <summary>
    /// The photo file every request carries.
    /// </summary>
    private static readonly byte[] _photo = [1, 2, 3, 4];

    /// <summary>
    /// Each reading route hands the service the caller, the photo file its body carries, and the target its address
    /// names.
    /// </summary>
    [Fact]
    public async Task A_reading_hands_the_service_the_photo_and_the_target_its_address_names()
    {
        // The API's routes, mapped, with the caller resolving to an account
        var mapped = MappedApi.Build().WithCaller(CallerSubject, _callerId);

        // The photo service, answering every reading with a stand-in
        var photoService = Mock.Get(mapped.Services.GetRequiredService<IDefensePhotoService>());
        photoService
            .Setup(service => service.ReadAsync(
                It.IsAny<Guid>(), It.IsAny<DefenseTarget>(), It.IsAny<ReadOnlyMemory<byte>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DefensePhotoReadingDto(Guid.CreateVersion7(), "text", []));

        // A problem a reading can be for
        var problemId = Guid.CreateVersion7();

        // Each reading route, with how a request addresses its target and the target it should name
        (string Pattern, Action<HttpRequest> Address, DefenseTarget Target)[] routes =
        [
            ("/defense/photos",
                request => request.QueryString = new QueryString("?handoutContentId=handout&environmentId=env-1"),
                new HandoutEnvironmentTarget("handout", "env-1")),
            ("/defense/photos/problems/{problemId:guid}",
                request => request.RouteValues["problemId"] = problemId.ToString(),
                new ProblemTarget(problemId)),
        ];

        // Each route in turn
        foreach (var (pattern, address, target) in routes)
        {
            // Nothing asked of the service yet
            photoService.Invocations.Clear();

            // A request carrying the photo, addressed to the target
            var request = TestRequests.WithBody(
                TestCallers.SignedIn(CallerSubject, isAdmin: false), mapped.Services, _photo,
                MediaTypeNames.Image.Jpeg);
            address(request.Request);

            // Sent through the route
            await mapped.Route(HttpMethods.Post, pattern).RequestDelegate!(request);

            // Which asked for one reading
            var asked = Assert.Single(photoService.Invocations);

            // For the caller
            Assert.Equal(_callerId, asked.Arguments[0]);

            // About the target the address names
            Assert.Equal(target, asked.Arguments[1]);

            // Of the photo the body carries
            Assert.Equal(_photo, ((ReadOnlyMemory<byte>)asked.Arguments[2]).ToArray());
        }
    }
}
