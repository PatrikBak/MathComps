using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Base class for integration tests using a disposable PostgreSQL container.
/// Provides shared infrastructure for database setup, migration, and cleanup.
/// </summary>
public abstract class PostgresTestBase<TService> : IAsyncLifetime where TService : class
{
    /// <summary>
    /// The Docker container running PostgreSQL for testing.
    /// </summary>
    private readonly IContainer _postgresContainer;

    /// <summary>
    /// The connection string for the PostgreSQL container.
    /// </summary>
    private string? _connectionString;

    /// <summary>
    /// The name of the database for testing, unique for each test class.
    /// </summary>
    private readonly string _dbName = $"mathcomps_test_{Guid.NewGuid():N}";

    /// <summary>
    /// The username for the database.
    /// </summary>
    private readonly string _dbUser = "postgres";

    /// <summary>
    /// The password for the database.
    /// </summary>
    private readonly string _dbPassword = "postgres";

    /// <summary>
    /// The port for the database.
    /// </summary>
    private readonly int _dbPort = 5432;

    /// <summary>
    /// Initializes a new instance of the <see cref="PostgresTestBase{TService}"/> class.
    /// Sets up the PostgreSQL container for testing.
    /// </summary>
    protected PostgresTestBase()
    {
        try
        {
            // Create PostgreSQL container with pgvector extension for vector similarity operations.
            _postgresContainer = new ContainerBuilder()
                // Use pgvector image with PostgreSQL 16 for embedding similarity
                .WithImage("pgvector/pgvector:pg16")
                // The required envs
                .WithEnvironment("POSTGRES_USER", _dbUser)
                .WithEnvironment("POSTGRES_PASSWORD", _dbPassword)
                .WithEnvironment("POSTGRES_DB", _dbName)
                // Bind to random available port (0) to avoid conflicts with other services
                .WithPortBinding(0, _dbPort)
                // Wait for DB to be ready before proceeding
                .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(_dbPort))
                .Build();
        }
        catch (DockerUnavailableException)
        {
            // We need Docker!
            throw new InvalidOperationException(
                """
                Docker Desktop is required to run Postgres integration tests
                  - Install Docker Desktop (Windows/Mac) or Docker Engine (Linux)
                  - Start Docker and ensure 'docker info' works
                  - On Windows, enable WSL 2 backend in Docker Desktop settings
                """
            );
        }
    }

    /// <summary>
    /// Initializes the test environment by starting the PostgreSQL container and seeding test data.
    /// This method is called before each test class execution to ensure a clean, isolated database state.
    /// </summary>
    /// <returns>A task representing the asynchronous initialization operation.</returns>
    public virtual async Task InitializeAsync()
    {
        // Start the container
        await _postgresContainer.StartAsync();

        // Ask Docker which random port it picked
        var mappedPort = _postgresContainer.GetMappedPublicPort(_dbPort);

        // Build connection string with the RANDOM port
        _connectionString = $"Host=localhost;" +
                            $"Port={mappedPort};" +
                            $"Database={_dbName};" +
                            $"Username={_dbUser};" +
                            $"Password={_dbPassword};";

        // Create the DB context using the service provider
        await using var serviceProvider = CreateServiceProvider();
        await using var scope = serviceProvider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<MathCompsDbContext>();

        // Ensure we start with a completely clean database state for each test run
        await context.Database.EnsureDeletedAsync();
        await context.Database.MigrateAsync();

        // Seed the database with test data
        await SeedDataAsync(context);
    }

    /// <summary>
    /// Cleans up the test environment by stopping and disposing of the PostgreSQL container.
    /// This method is called after all tests in the class have completed to free up resources.
    /// </summary>
    /// <returns>A task representing the asynchronous cleanup operation.</returns>
    public virtual async Task DisposeAsync()
    {
        // Stop and dispose the container to free up resources
        await (_postgresContainer?.StopAsync() ?? Task.CompletedTask);
        await (_postgresContainer?.DisposeAsync() ?? ValueTask.CompletedTask);
    }

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
