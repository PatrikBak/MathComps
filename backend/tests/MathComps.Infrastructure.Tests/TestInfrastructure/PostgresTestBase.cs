using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

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
    /// <param name="overrides">
    /// What one test needs registered differently from the rest of its class, applied after
    /// <see cref="ConfigureServices"/> so it wins.
    /// </param>
    /// <returns>A configured service provider ready for dependency injection.</returns>
    protected ServiceProvider CreateServiceProvider(Action<IServiceCollection>? overrides = null)
    {
        // Create in-memory configuration with the test database connection string
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _connectionString
            })
            .Build();

        // The infrastructure shared by every test; a derived class adds its own service module via ConfigureServices.
        var services = new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddLogging()
            .AddMathCompsDbContext(configuration);

        // Let a derived class add or replace registrations (e.g. a fake for an external dependency).
        ConfigureServices(services);

        // And let one test differ from its class, e.g. in the options the service under test reads.
        overrides?.Invoke(services);

        // Build the provider.
        return services.BuildServiceProvider();
    }

    /// <summary>
    /// Hook for derived classes to add or override service registrations before the provider is built — e.g. to
    /// supply a fake for an external dependency the service under test needs. The base does nothing.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    protected virtual void ConfigureServices(IServiceCollection services)
    {
        // No extra registrations by default.
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
    /// <param name="overrides"><inheritdoc cref="CreateServiceProvider" path="/param[@name='overrides']"/></param>
    /// <returns>A task representing the asynchronous test operation.</returns>
    protected async Task RunTestAsync(
        Func<TService, Task> testAction, Action<IServiceCollection>? overrides = null)
    {
        // Get the service provider
        await using var serviceProvider = CreateServiceProvider(overrides);

        // Services are scoped to ensure they are disposed after the test
        await using var scope = serviceProvider.CreateAsyncScope();

        // Get the service
        var service = scope.ServiceProvider.GetRequiredService<TService>();

        // Execute the test action
        await testAction(service);
    }

    /// <summary>
    /// Runs a read against a fresh scope over the same database, handing the body a context so assertions can verify
    /// the rows the service under test committed.
    /// </summary>
    /// <param name="query">The query body, handed a fresh context.</param>
    /// <returns>A task representing the query.</returns>
    protected async Task QueryAsync(Func<MathCompsDbContext, Task> query)
    {
        // A new provider over the same connection string sees the committed rows.
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        await query(context);
    }

    /// <summary>
    /// Runs a read against a fresh scope over the same database, handing the body a context plus a resolved service
    /// (e.g. the metadata registry) so assertions can compare committed rows against that service's values.
    /// </summary>
    /// <typeparam name="TResolved">The companion service to resolve alongside the context.</typeparam>
    /// <param name="query">The query body, handed a fresh context and the resolved service.</param>
    /// <returns>A task representing the query.</returns>
    protected async Task QueryAsync<TResolved>(Func<MathCompsDbContext, TResolved, Task> query) where TResolved : notnull
    {
        // A new provider over the same connection string sees the committed rows.
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        var resolved = scope.ServiceProvider.GetRequiredService<TResolved>();
        await query(context, resolved);
    }

    /// <summary>
    /// Reads a single value from a fresh read scope against the same database — for assertions that need one figure
    /// (e.g. a row count or timestamp) read back after the service under test has committed.
    /// </summary>
    /// <typeparam name="TValue">The value type the query returns.</typeparam>
    /// <param name="query">The query body, handed a fresh context.</param>
    /// <returns>The value the query produced.</returns>
    protected async Task<TValue> QueryValueAsync<TValue>(Func<MathCompsDbContext, Task<TValue>> query)
    {
        // A new provider over the same connection string sees the committed rows.
        await using var provider = CreateServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();
        return await query(context);
    }
}
