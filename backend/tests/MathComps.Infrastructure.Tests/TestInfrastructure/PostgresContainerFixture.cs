using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Shared fixture that manages a single PostgreSQL container for the entire test collection.
/// The container starts once when the first test in the collection runs, and stops when all tests complete.
/// It also migrates one template database up front, which every test copies to get its schema.
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
    /// The database holding the migrated schema that every test database is copied from.
    /// </summary>
    private const string TemplateDatabase = "mathcomps_template";

    /// <summary>
    /// The database the server always has, connected to for statements that cannot run inside the database
    /// they are about.
    /// </summary>
    private const string MaintenanceDatabase = "postgres";

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
    /// Starts the PostgreSQL container and migrates the template database. Called once before any tests in the
    /// collection run.
    /// </summary>
    public async Task InitializeAsync()
    {
        // Start the container
        await _postgresContainer.StartAsync();

        // Get the mapped port for connection strings
        MappedPort = _postgresContainer.GetMappedPublicPort(InternalPort);

        // Make the database the schema is going to live in
        await ExecuteOnMaintenanceDatabaseAsync($"CREATE DATABASE \"{TemplateDatabase}\"");

        // Reach it through the same DI the tests use
        await using var serviceProvider = TestServiceProvider.Build(GetConnectionString(TemplateDatabase));
        await using var scope = serviceProvider.CreateAsyncScope();

        // Run every migration, the one time the whole suite runs them
        await scope.ServiceProvider.GetRequiredService<MathCompsDbContext>().Database.MigrateAsync();
    }

    /// <summary>
    /// Copies the migrated template into a fresh database, which Postgres does as a file copy. Nothing may hold
    /// a connection to the template while this runs, which holds because the migrating context is disposed and
    /// the connection string is unpooled.
    /// </summary>
    /// <param name="databaseName">The database to create.</param>
    /// <returns>A task representing the copy.</returns>
    public Task CreateDatabaseFromTemplateAsync(string databaseName)
        => ExecuteOnMaintenanceDatabaseAsync($"CREATE DATABASE \"{databaseName}\" TEMPLATE \"{TemplateDatabase}\"");

    /// <summary>
    /// Stops and disposes the PostgreSQL container. Called once after all tests in the collection complete.
    /// </summary>
    public async Task DisposeAsync()
    {
        await _postgresContainer.StopAsync();
        await _postgresContainer.DisposeAsync();
    }

    /// <summary>
    /// Gets a connection string for one database in the container.
    /// </summary>
    /// <param name="databaseName">The database to connect to.</param>
    /// <returns>A connection string for the specified database.</returns>
    public string GetConnectionString(string databaseName) =>
        // Every test gets its own database, so its own Npgsql pool; pooled connections would be retained per
        // database and pile up past the server's max_connections across the run. Disable pooling so each
        // connection closes on dispose and the sequential suite never holds more than a handful at once.
        $"Host=localhost;Port={MappedPort};Database={databaseName};Username={DbUser};Password={DbPassword};"
        + "Pooling=false;";

    /// <summary>
    /// Runs one statement against the <see cref="MaintenanceDatabase"/>.
    /// </summary>
    /// <param name="sql">The statement to run.</param>
    /// <returns>A task representing the statement.</returns>
    private async Task ExecuteOnMaintenanceDatabaseAsync(string sql)
    {
        // Open a connection outside any test's database
        await using var connection = new NpgsqlConnection(GetConnectionString(MaintenanceDatabase));
        await connection.OpenAsync();

        // Then run the statement
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
