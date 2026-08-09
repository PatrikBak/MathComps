namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request to mark several conversations read, or to put several back to unread.
/// </summary>
/// <param name="SessionIds">The conversations to mark, null when the request omitted them.</param>
/// <param name="Read">
/// True to stamp them as read as of now, false to take this reviewer's stamps back. Null when the request named
/// neither outcome.
/// </param>
public record MarkDefenseReviewsRequest(IReadOnlyList<Guid>? SessionIds, bool? Read);
