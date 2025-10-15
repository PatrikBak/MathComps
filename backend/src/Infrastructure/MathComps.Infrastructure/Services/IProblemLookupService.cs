using MathComps.Domain.ApiDtos.ProblemQuery;

namespace MathComps.Infrastructure.Services;

/// <summary>
/// Service for looking up problem information from the database.
/// Provides common problem lookup operations needed across multiple CLI tools and services.
/// </summary>
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
    /// Retrieves problem metadata from a problem slug (which is unique per problem).
    /// </summary>
    /// <param name="problemSlug">URL-safe problem identifier (will be normalized to lowercase).</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>Problem lookup result containing slugs for competition, category, round, and season, or null if not found.</returns>
    Task<ProblemLookupResult?> GetProblemLookupDataAsync(string problemSlug, CancellationToken cancellationToken = default);
}
