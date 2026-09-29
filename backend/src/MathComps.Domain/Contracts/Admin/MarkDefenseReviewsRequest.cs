namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request to mark several conversations read as of now.
/// </summary>
/// <param name="SessionIds">The conversations to mark, null when the request omitted them.</param>
public record MarkDefenseReviewsRequest(IReadOnlyList<Guid>? SessionIds);
