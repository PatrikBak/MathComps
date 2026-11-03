namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request to mark several conversations read as of now.
/// </summary>
/// <param name="SessionIds">The conversations to mark, null when the request sent null.</param>
public record MarkDefenseReviewsRequest(IReadOnlyList<Guid>? SessionIds);
