namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The moment the discussions a mark named were marked as seen up to.
/// </summary>
/// <param name="SeenUpTo">
/// The moment up to which the caller has seen every comment posted in the discussions marked.
/// </param>
public record DiscussionsMarkedDto(DateTimeOffset SeenUpTo);
