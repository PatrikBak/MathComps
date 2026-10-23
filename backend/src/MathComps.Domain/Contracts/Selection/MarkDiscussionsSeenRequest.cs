using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to mark the discussions of some of what the selection holds as seen by the caller, each up to its own
/// moment.
/// </summary>
/// <param name="Proposals">
/// The moment up to which the caller has seen every comment posted in each proposal's discussion, by the proposal's id;
/// null when the request omitted them.
/// </param>
/// <param name="Papers">
/// The moment up to which the caller has seen every comment posted in each paper's discussion, by the paper's id; null
/// when the request omitted them.
/// </param>
public record MarkDiscussionsSeenRequest(
    ImmutableDictionary<Guid, DateTimeOffset>? Proposals, ImmutableDictionary<Guid, DateTimeOffset>? Papers);
