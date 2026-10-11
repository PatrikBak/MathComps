using MathComps.Api.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Api.Tests;

/// <summary>
/// The API's routes mapped onto a bare host that never runs, every service the infrastructure declares standing in
/// as a mock answering with defaults.
/// </summary>
/// <param name="Routes">Every route the API maps.</param>
/// <param name="Services">The services a request to one of the routes is handed.</param>
internal sealed record MappedApi(IReadOnlyList<RouteEndpoint> Routes, IServiceProvider Services)
{
    /// <summary>
    /// Maps the API's routes without running it.
    /// </summary>
    /// <remarks>
    /// Building a route reads which of its handler's parameters are services, and a request resolves them before
    /// anything else runs, so every non-generic interface the infrastructure declares is registered. A generic one
    /// takes no mock, and no handler asks for one.
    /// </remarks>
    /// <returns>The routes, and the services their requests are handed.</returns>
    public static MappedApi Build()
    {
        // The builder of a bare host to map the routes onto
        var builder = WebApplication.CreateBuilder();

        // The health check among the routes needs its own services
        builder.Services.AddHealthChecks();

        // Every non-generic interface the infrastructure declares, standing in for the real services
        foreach (var service in typeof(MathCompsDbContext).Assembly.GetTypes()
                     .Where(type => type is { IsInterface: true, IsGenericTypeDefinition: false }))
            builder.Services.AddScoped(service, _ => ((Mock)Activator.CreateInstance(
                typeof(Mock<>).MakeGenericType(service))!).Object);

        // The bare host
        var app = builder.Build();

        // With the API's routes mapped onto it
        app.MapApiEndpoints();

        // Built into routes, with one request's worth of services
        return new MappedApi(
            [
                .. ((IEndpointRouteBuilder)app).DataSources
                    .SelectMany(source => source.Endpoints)
                    .OfType<RouteEndpoint>(),
            ],
            app.Services.CreateScope().ServiceProvider);
    }

    /// <summary>
    /// Names a route by its method and its pattern, the way a request reaches it.
    /// </summary>
    /// <param name="route">The route.</param>
    /// <returns>Its method and pattern (e.g. <c>GET /admin/defense/sessions/{id:guid}</c>).</returns>
    public static string NameOf(RouteEndpoint route) =>
        // The one method it answers, then its pattern
        $"{route.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods.Single()} {route.RoutePattern.RawText}";
}
