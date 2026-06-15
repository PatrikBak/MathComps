using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Shared fixture that manages a single PostgreSQL container for the entire test collection.
/// The container starts once when the first test in the collection runs, and stops when all tests complete.
/// </summary>
public sealed class PostgresContainerFixture : IAsyncLifetime
{
    /// <summary>
    /// The Docker container running PostgreSQL for testing.
    /// </summary>
    private readonly IContainer _postgresContainer;

    /// <summary>
    /// The username for the database.
    /// </summary>
    private string DbUser { get; } = "postgres";

    /// <summary>
    /// The password for the database.
    /// </summary>
    private string DbPassword { get; } = "postgres";

    /// <summary>
    /// The port PostgreSQL listens on inside the container.
    /// </summary>
    private const int InternalPort = 5432;

    /// <summary>
    /// The mapped port on the host machine (assigned after container starts).
    /// </summary>
    private int MappedPort { get; set; }

    /// <summary>
    /// Initializes the fixture and builds the container configuration.
    /// </summary>
    public PostgresContainerFixture()
    {
        try
        {
            // Create PostgreSQL container with pgvector extension for vector similarity operations.
            _postgresContainer = new ContainerBuilder()
                // Use pgvector image with PostgreSQL 16 for embedding similarity
                .WithImage("pgvector/pgvector:pg16")
                // The required envs
                .WithEnvironment("POSTGRES_USER", DbUser)
                .WithEnvironment("POSTGRES_PASSWORD", DbPassword)
                .WithEnvironment("POSTGRES_DB", "postgres")
                // Bind to random available port (0) to avoid conflicts with other services
                .WithPortBinding(0, InternalPort)
                // Wait for PostgreSQL to be fully ready (not just the port)
                // pg_isready returns 0 when the server is accepting connections
                .WithWaitStrategy(
                    Wait.ForUnixContainer()
                        .UntilCommandIsCompleted("pg_isready", "-U", DbUser))
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
    /// Starts the PostgreSQL container. Called once before any tests in the collection run.
    /// </summary>
    public async Task InitializeAsync()
    {
        // Start the container
        await _postgresContainer.StartAsync();

        // Get the mapped port for connection strings
        MappedPort = _postgresContainer.GetMappedPublicPort(InternalPort);
    }

    /// <summary>
    /// Stops and disposes the PostgreSQL container. Called once after all tests in the collection complete.
    /// </summary>
    public async Task DisposeAsync()
    {
        await _postgresContainer.StopAsync();
        await _postgresContainer.DisposeAsync();
    }

    /// <summary>
    /// Gets a connection string for a test-specific database.
    /// Each test class should use a unique database name to ensure isolation.
    /// </summary>
    /// <param name="databaseName">The unique database name for the test class.</param>
    /// <returns>A connection string for the specified database.</returns>
    public string GetConnectionString(string databaseName) =>
        // Every test gets its own database, so its own Npgsql pool; pooled connections would be retained per
        // database and pile up past the server's max_connections across the run. Disable pooling so each
        // connection closes on dispose and the sequential suite never holds more than a handful at once.
        $"Host=localhost;Port={MappedPort};Database={databaseName};Username={DbUser};Password={DbPassword};"
        + "Pooling=false;";
}
