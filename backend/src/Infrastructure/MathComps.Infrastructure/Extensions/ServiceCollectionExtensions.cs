using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;

namespace MathComps.Infrastructure.Extensions;

/// <summary>
/// Extension methods for configuring MathComps database context with proper Npgsql settings.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Configures MathCompsDbContext with PostgreSQL using DbContextFactory.
    /// </summary>
    /// <param name="services">The service collection to add the DbContext to.</param>
    /// <param name="configuration">The application configuration containing connection string.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddMathCompsDbContext(this IServiceCollection services, IConfiguration configuration)
    {
        // Grab the connection string from the configuration
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        // Important to have it
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Missing connection string 'ConnectionStrings:DefaultConnection'. Provide via user secrets for development or environment variable 'ConnectionStrings__DefaultConnection' in production.");

        // Add Npgsql with all mapped enums using DbContextFactory
        // (see https://www.npgsql.org/efcore/mapping/enum.html?tabs=with-connection-string%2Cwith-datasource)
        services.AddDbContextFactory<MathCompsDbContext>(options =>
            options.UseNpgsql(connectionString,
                options => options.MapEnum<TagType>("tag_type")
            )
        );

        // Builder pattern
        return services;
    }
}
