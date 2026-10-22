using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to mark the discussions of some of what the selection holds as seen by the caller up to a moment.
/// </summary>
/// <param name="ProposalIds">The proposals whose discussions were seen, null when the request omitted them.</param>
/// <param name="PaperIds">The papers whose discussions were seen, null when the request omitted them.</param>
/// <param name="SeenUpTo">
/// The moment up to which the caller has seen every comment posted in the discussions named, null when the request
/// omitted it.
/// </param>
public record MarkDiscussionsSeenRequest(
    ImmutableList<Guid>? ProposalIds, ImmutableList<Guid>? PaperIds, DateTimeOffset? SeenUpTo);
