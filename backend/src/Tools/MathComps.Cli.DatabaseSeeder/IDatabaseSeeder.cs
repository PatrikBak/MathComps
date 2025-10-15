namespace MathComps.Cli.DatabaseSeeder;

/// <summary>
/// The service to ensure our lovely DB is full of problems.
/// </summary>
public interface IDatabaseSeeder
{
    /// <summary>
    /// Seeds the database with problems from the parsed JSON dataset. The intended implemention
    /// wants this be idempotent, ensuring updates of all properties, unless we're skipping existing
    /// problems for performance.
    /// </summary>
    /// <param name="skipExistingProblems">If true, existing problems will be skipped without checking for updates.</param>
    Task SeedAsync(bool skipExistingProblems);
}
