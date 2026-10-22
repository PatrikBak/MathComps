using System.Collections.Immutable;
using MathComps.Domain.Contracts.Comments;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// How far the reader has seen the discussions of everything the selection holds, each kind of subject's by the
/// subject's id. Every proposal and paper the selection holds has an entry, one nothing has been said in included.
/// </summary>
/// <param name="Proposals">How far the reader has seen each proposal's discussion, by the proposal's id.</param>
/// <param name="Papers">How far the reader has seen each paper's discussion, by the paper's id.</param>
public record SelectionDiscussionsSeenDto(
    ImmutableDictionary<string, CommentThreadSeenDto> Proposals,
    ImmutableDictionary<string, CommentThreadSeenDto> Papers);
