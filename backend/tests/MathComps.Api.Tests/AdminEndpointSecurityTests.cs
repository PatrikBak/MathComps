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
/// Guards that every route under <c>/admin</c> is closed to everybody but admins and rate-limited. Each route
/// opts in with its own call, so a route left without it serves whatever it reads (students' emails, reference
/// solutions, grades) to anybody who asks, and nothing else fails: the admin pages keep working for the admins
/// using them.
/// </summary>
public class AdminEndpointSecurityTests
{
    /// <summary>
    /// Every admin route carries the admin policy and a rate limit, and none lets an anonymous caller through.
    /// </summary>
    [Fact]
    public void Every_admin_route_requires_an_admin_and_is_rate_limited()
    {
        // The admin routes as the API maps them
        var adminRoutes = MapRoutes()
            .Where(route => route.RoutePattern.RawText?.StartsWith("/admin", StringComparison.Ordinal) == true)
            .ToList();

        // Found, so the checks below have routes to read
        Assert.NotEmpty(adminRoutes);

        // Each one, checked on its own so a failure names the route
        foreach (var route in adminRoutes)
        {
            // The route's name
            var name = route.DisplayName;

            // Admins only
            Assert.True(
                route.Metadata.GetOrderedMetadata<IAuthorizeData>()
                    .Any(authorize => authorize.Policy == AuthorizationPolicies.Admin),
                $"{name} does not require the admin policy.");

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
