namespace MathComps.Domain.ApiDtos.ProblemQuery;

/// <summary>
/// Internal query options for filtering problems, including authenticated user context.
/// Wraps a <see cref="FilterQuery"/> with optional user ID for personalized data.
/// </summary>
/// <param name="Query">The base filter query from the API.</param>
/// <param name="UserId">Optional ID of the requesting user for personalized data (e.g. likes).</param>
public record ProblemFilterOptions(
    FilterQuery Query,
    Guid? UserId = null
);
