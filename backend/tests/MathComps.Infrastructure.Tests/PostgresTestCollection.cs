namespace MathComps.Infrastructure.Tests;

/// <summary>
/// Defines a test collection that shares a single PostgreSQL container across all test classes.
/// All test classes decorated with [Collection(Name)] will share the same
/// <see cref="PostgresContainerFixture"/> instance.
/// </summary>
[CollectionDefinition(Name)]
public class PostgresTestCollection : ICollectionFixture<PostgresContainerFixture>
{
    /// <summary>
    /// The name of this test collection. Use this constant in [Collection] attributes.
    /// </summary>
    public const string Name = "PostgreSQL";
}
