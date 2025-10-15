using MathComps.Infrastructure.Extensions;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for MathCompsDbContext to enable EF Core tools (migrations, etc.)
/// to work from the Infrastructure project.
/// </summary>
public class MathCompsDbContextFactory : IDesignTimeDbContextFactory<MathCompsDbContext>
{
    /// <inheritdoc/>
    public MathCompsDbContext CreateDbContext(string[] args)
    {
        // Build configuration that includes user secrets/env vars from which we'll get connection string
        var configuration = new ConfigurationBuilder()
            .AddUserSecrets<MathCompsDbContextFactory>()
            .AddEnvironmentVariables()
            .Build();

        // A temporary service provided so we can use AddMathCompsDbContext
        return new ServiceCollection()
            .AddMathCompsDbContext(configuration)
            .BuildServiceProvider()
            .GetRequiredService<MathCompsDbContext>();
    }
}
