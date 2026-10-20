using MathComps.Api.Authorization;
using MathComps.Domain.Contracts.Selection;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Services.Users;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// Covers the problem selection's routes against the organization each one's address names. The policy lets a member
/// of any organization in through their own address, so a route acting on another organization's selection would hand
/// them that selection.
/// </summary>
public class ProblemSelectionEndpointsTests
{
    /// <summary>
    /// The subject every caller here signs in under.
    /// </summary>
    private const string CallerSubject = "ext-member";

    /// <summary>
    /// The slug of the organization the requests go through, which is not MathComps.
    /// </summary>
    private const string OlympiadSlug = "olympiad";

    /// <summary>
    /// Every route of the selection hands its service the organization its address names, so a member let in through
    /// their own organization's address reads and changes that organization's selection alone.
    /// </summary>
    [Fact]
    public async Task Every_route_hands_its_service_the_organization_its_address_names()
    {
        // The API's routes, mapped
        var mapped = MappedApi.Build();

        // The caller resolving to an account, which the reads and the rating ask for
        Mock.Get(mapped.Services.GetRequiredService<IUserManager>())
            .Setup(manager => manager.GetUserIdAsync(CallerSubject, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.CreateVersion7());

        // The services the selection's routes act through
        Mock[] services =
        [
            Mock.Get(mapped.Services.GetRequiredService<IProblemSelectionService>()),
            Mock.Get(mapped.Services.GetRequiredService<ISelectionBoardService>()),
            Mock.Get(mapped.Services.GetRequiredService<IBoardFinalizationService>()),
            Mock.Get(mapped.Services.GetRequiredService<IProposalService>()),
        ];

        // Every route under one organization's address
        var routes = mapped.Routes
            .Where(route =>
                route.RoutePattern.RawText?.StartsWith("/problem-selection/{organization}", StringComparison.Ordinal)
                == true)
            .ToList();

        // Found, so the checks below have routes to read
        Assert.NotEmpty(routes);

        // Each one, checked on its own so a failure names the route
        foreach (var route in routes)
        {
            // Nothing asked of the services yet
            foreach (var service in services)
                service.Invocations.Clear();

            // A member's request, its body readable by every write of the selection
            var request = TestRequests.WithJsonBody(
                TestCallers.SignedIn(CallerSubject, isAdmin: false),
                mapped.Services,
                new
                {
                    proposalId = Guid.CreateVersion7(),
                    direction = SlotDirection.Up,
                    isSetAside = true,
                    category = "elementary",
                    isRecommended = true,
                    beauty = 3,
                    difficulty = 3,
                    cycleId = Guid.CreateVersion7(),
                });

            // Through the olympiad's address, every other value its pattern holds filled
            foreach (var parameter in route.RoutePattern.Parameters)
                request.Request.RouteValues[parameter.Name] = parameter.Name switch
                {
                    OrganizationMemberRequirement.OrganizationRouteValue => OlympiadSlug,
                    "index" => "0",
                    _ => Guid.CreateVersion7().ToString(),
                };

            // Sent through the route
            await route.RequestDelegate!(request);

            // Which asked one service once
            var asked = Assert.Single(services.SelectMany(service => service.Invocations));

            // Of the olympiad's selection
            Assert.True(
                Equals(asked.Arguments[0], OlympiadSlug),
                $"{route.DisplayName} handed its service {asked.Arguments[0]}.");
        }
    }
}
