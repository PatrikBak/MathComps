using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Base class for integration tests using a shared PostgreSQL container.
/// Each test class gets its own isolated database within the shared container,
/// ensuring test isolation while avoiding the overhead of container startup per test.
/// </summary>
/// <typeparam name="TService">The service type to resolve for test execution.</typeparam>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
[Collection(PostgresTestCollection.Name)]
public abstract class PostgresTestBase<TService>(PostgresContainerFixture fixture) : IAsyncLifetime where TService : class
{
    /// <summary>
    /// Unique database name for this test class to ensure isolation.
    /// </summary>
    private readonly string _dbName = $"mathcomps_test_{Guid.NewGuid():N}";

    /// <summary>
    /// The connection string for this test class's database.
    /// </summary>
    private string? _connectionString;

    /// <inheritdoc/>
    public virtual async Task InitializeAsync()
    {
        // Get connection string for our unique database
        _connectionString = fixture.GetConnectionString(_dbName);

        // Create the DB context using the service provider
        await using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();

        // Ensure we start with a fully migrated database
        await context.Database.MigrateAsync();

        // Seed the database with test data
        await SeedDataAsync(context);
    }

    /// <inheritdoc/>
    public virtual Task DisposeAsync() => Task.CompletedTask;

    /// <summary>
    /// Creates a service provider configured with the test database connection string.
    /// </summary>
    /// <returns>A configured service provider ready for dependency injection.</returns>
    protected ServiceProvider CreateServiceProvider()
    {
        // Create in-memory configuration with the test database connection string
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _connectionString
            })
            .Build();

        // Register all necessary services
        return new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddMathCompsDbContext(configuration)
            .AddInfrastructureServices()
            .BuildServiceProvider();
    }

    /// <summary>
    /// Seeds the test database with data specific to the derived test class.
    /// </summary>
    /// <param name="context">The database context to seed with test data.</param>
    /// <returns>A task representing the asynchronous seeding operation.</returns>
    protected abstract Task SeedDataAsync(MathCompsDbContext context);

    /// <summary>
    /// Executes a test action within a managed service scope.
    /// Creates a service provider, creates a scope, resolves the specified service,
    /// executes the test action, and ensures key resources are disposed.
    /// </summary>
    /// <param name="testAction">The test action to execute with the resolved service.</param>
    /// <returns>A task representing the asynchronous test operation.</returns>
    protected async Task RunTestAsync(Func<TService, Task> testAction)
    {
        // Get the service provider
        await using var serviceProvider = CreateServiceProvider();

        // Services are scoped to ensure they are disposed after the test
        await using var scope = serviceProvider.CreateAsyncScope();

        // Get the service
        var service = scope.ServiceProvider.GetRequiredService<TService>();

        // Execute the test action
        await testAction(service);
    }
}
