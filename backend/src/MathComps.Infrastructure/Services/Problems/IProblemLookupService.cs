using MathComps.Domain.Contracts.ProblemQuery;

namespace MathComps.Infrastructure.Services.Problems;

/// <summary>
/// Service for looking up problem information from the database.
/// Provides common problem lookup operations needed across multiple CLI tools and services.
/// </summary>
/// <remarks>
/// The two lookups deliberately disagree about an embargoed round. Reading a problem is an archive read, so
/// <see cref="GetProblemLookupDataAsync"/> refuses one whose round has not opened. Resolving a slug to an id is
/// not: it serves the like, mark and list-membership writes, and the offline tools, all of which are entitled to
/// address a problem nobody can read yet. So <see cref="GetProblemIdBySlugAsync"/> answers for every problem.
/// </remarks>
public interface IProblemLookupService
{
    /// <summary>
    /// Retrieves the database ID for a problem given its slug identifier.
    /// Enables translation from user-friendly slugs to internal database keys.
    /// </summary>
    /// <param name="problemSlug">URL-safe problem identifier (will be normalized to lowercase).</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>Problem's database ID if found, null if not found.</returns>
    Task<Guid?> GetProblemIdBySlugAsync(string problemSlug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves the database ID for a problem given its slug, failing when no such problem exists.
    /// </summary>
    /// <param name="problemSlug">URL-safe problem identifier (will be normalized to lowercase).</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>The problem's database ID.</returns>
    /// <exception cref="ProblemNotFoundException">When no problem matches the slug.</exception>
    async Task<Guid> GetRequiredProblemIdBySlugAsync(string problemSlug, CancellationToken cancellationToken = default) =>
        // Turn a lookup miss into a not-found failure
        await GetProblemIdBySlugAsync(problemSlug, cancellationToken)
            ?? throw new ProblemNotFoundException(problemSlug);

    /// <summary>
    /// Retrieves problem metadata from a problem slug (which is unique per problem), for a problem the archive may
    /// serve. A problem whose round has not opened yet answers as though it did not exist.
    /// </summary>
    /// <param name="problemSlug">URL-safe problem identifier (will be normalized to lowercase).</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>Problem lookup result naming the season and the competition's path, or null if not found.</returns>
    Task<ProblemLookupResult?> GetProblemLookupDataAsync(string problemSlug, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a problem slug matches no problem.
/// </summary>
/// <param name="slug">The slug that matched no problem.</param>
public sealed class ProblemNotFoundException(string slug) : Exception($"Problem '{slug}' not found");
