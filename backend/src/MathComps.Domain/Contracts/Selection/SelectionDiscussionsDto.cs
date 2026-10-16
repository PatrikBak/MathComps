using System.Collections.Immutable;
using MathComps.Domain.Contracts.Comments;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The reviewers' discussions of everything the selection holds, each kind of subject's by the subject's id. Each
/// discussion is its top-level comments, oldest first, each carrying its replies, and one nothing has been said in is
/// left out.
/// </summary>
/// <param name="Proposals">The discussions of the proposals still in the selection, by the proposal's id.</param>
/// <param name="Papers">The discussions of the papers on the selection's boards, by the paper's id.</param>
public record SelectionDiscussionsDto(
    ImmutableDictionary<string, ImmutableList<CommentDto>> Proposals,
    ImmutableDictionary<string, ImmutableList<CommentDto>> Papers);
