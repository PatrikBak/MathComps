namespace MathComps.Cli.DatabaseSeeder.Services;

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
    /// <param name="years">An array of years to filter problems by. If empty, all years are included.</param>
    Task SeedAsync(bool skipExistingProblems, int[] years);
}
