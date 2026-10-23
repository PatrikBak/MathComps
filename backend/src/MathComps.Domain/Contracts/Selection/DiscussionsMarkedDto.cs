using System.Collections.Immutable;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The discussions a mark landed on, each kind of subject's by the subject's id, each with the moment it is now seen at
/// least up to.
/// </summary>
/// <param name="Proposals">
/// The moment up to which the caller has seen every comment posted in each proposal's discussion marked, by the
/// proposal's id.
/// </param>
/// <param name="Papers">
/// The moment up to which the caller has seen every comment posted in each paper's discussion marked, by the paper's
/// id.
/// </param>
public record DiscussionsMarkedDto(
    ImmutableDictionary<string, DateTimeOffset> Proposals, ImmutableDictionary<string, DateTimeOffset> Papers);
