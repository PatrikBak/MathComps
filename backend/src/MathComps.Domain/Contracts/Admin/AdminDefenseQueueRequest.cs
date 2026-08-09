namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request for one page of the review queue.
/// </summary>
/// <param name="Filter">
/// <inheritdoc cref="AdminDefenseQueueFilter" path="/summary"/> Null when the request omitted it, which names no
/// queue to read.
/// </param>
/// <param name="PageNumber">1-based page index to retrieve; values outside the range are clamped.</param>
public record AdminDefenseQueueRequest(AdminDefenseQueueFilter? Filter, int PageNumber);
