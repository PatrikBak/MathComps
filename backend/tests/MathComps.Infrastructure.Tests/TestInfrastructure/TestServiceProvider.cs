using MathComps.Infrastructure.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Builds the service provider every Postgres-backed test runs against: the DbContext pointed at one
/// test database, the R2 settings naming the made-up account of <see cref="TestR2"/> and the links to its private
/// files, plus whatever the caller adds on top.
/// </summary>
internal static class TestServiceProvider
{
    /// <summary>
    /// Builds a provider whose DbContext talks to <paramref name="connectionString"/>.
    /// </summary>
    /// <param name="connectionString">The database the DbContext connects to.</param>
    /// <param name="configure">What the caller needs registered beyond the DbContext, applied last so it wins.</param>
    /// <returns>The built provider, which the caller owns and must dispose.</returns>
    public static ServiceProvider Build(string connectionString, Action<IServiceCollection>? configure = null)
    {
        // Create in-memory configuration with the test database connection string, the made-up R2 account, and the
        // links to its private files
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = connectionString,
                ["CloudflareR2:AccountId"] = TestR2.AccountId,
                ["CloudflareR2:AccessKeyId"] = TestR2.AccessKeyId,
                ["CloudflareR2:SecretAccessKey"] = TestR2.SecretAccessKey,
                ["CloudflareR2:PrivateBucketName"] = TestR2.PrivateBucketName,
                ["PrivateFileLinks:LinkLifetime"] = "12:00:00",
                ["PrivateFileLinks:MaxKeptLinks"] = "100",
            })
            .Build();

        // The infrastructure shared by every test.
        var services = new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddLogging()
            .AddMathCompsDbContext(configuration);

        // Then whatever this caller needs on top.
        configure?.Invoke(services);

        // Build the provider.
        return services.BuildServiceProvider();
    }
}
