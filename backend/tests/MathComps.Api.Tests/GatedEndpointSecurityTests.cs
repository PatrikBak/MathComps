using MathComps.Api.Constants;
using MathComps.Api.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that every route of a gated area is closed to everybody but the accounts its policy lets in, and
/// rate-limited. Each route opts in with its own call, so a route left without it serves whatever it reads
/// (students' emails, reference solutions, grades, the problems competitions are picked from) to anybody who asks,
/// and nothing else fails: the pages keep working for the accounts using them.
/// </summary>
public class GatedEndpointSecurityTests
{
    /// <summary>
    /// Every route of a gated area carries the area's policy and a rate limit, and none lets an anonymous caller
    /// through.
    /// </summary>
    /// <param name="area">The path every route of the area starts with.</param>
    /// <param name="policy">The policy closing the area.</param>
    [Theory]
    [InlineData("/admin", AuthorizationPolicies.Admin)]
    [InlineData("/problem-selection", AuthorizationPolicies.PreparesCompetitions)]
    public void Every_gated_route_requires_its_policy_and_is_rate_limited(string area, string policy)
    {
        // The area's routes as the API maps them
        var gatedRoutes = MapRoutes()
            .Where(route => route.RoutePattern.RawText?.StartsWith(area, StringComparison.Ordinal) == true)
            .ToList();

        // Found, so the checks below have routes to read
        Assert.NotEmpty(gatedRoutes);

        // Each one, checked on its own so a failure names the route
        foreach (var route in gatedRoutes)
        {
            // The route's name
            var name = route.DisplayName;

            // The area's accounts only
            Assert.True(
                route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                    .Any(authorize => authorize.Policy == policy),
                $"{name} does not require the {policy} policy.");

            // With nothing opening it back up
            Assert.True(route.Metadata.GetMetadata<IAllowAnonymous>() is null, $"{name} allows anonymous callers.");

            // And a limit on how often it is asked
            Assert.True(
                route.Metadata.GetMetadata<EnableRateLimitingAttribute>() is not null,
                $"{name} is not rate-limited.");
        }
    }

    /// <summary>
    /// Maps the API's routes without running it.
    /// </summary>
    /// <remarks>
    /// Building a route reads which of its handler's parameters are services, so every interface the
    /// infrastructure declares is registered, each with a factory nothing ever calls.
    /// </remarks>
    /// <returns>Every route the API maps.</returns>
    private static List<RouteEndpoint> MapRoutes()
    {
        // The builder of a bare host to map the routes onto
        var builder = WebApplication.CreateBuilder();

        // The health check among the routes needs its own services
        builder.Services.AddHealthChecks();

        // Every interface the infrastructure declares, standing in for the real services
        foreach (var service in typeof(MathCompsDbContext).Assembly.GetTypes().Where(type => type.IsInterface))
            builder.Services.AddScoped(service, _ => throw new NotSupportedException());

        // The bare host
        var app = builder.Build();

        // With the API's routes mapped onto it
        app.MapApiEndpoints();

        // Built into routes
        return
        [
            .. ((IEndpointRouteBuilder)app).DataSources
                .SelectMany(source => source.Endpoints)
                .OfType<RouteEndpoint>(),
        ];
    }
}
