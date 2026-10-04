namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to comment on a proposal.
/// </summary>
/// <param name="Content">What the comment says (markdown), null when the request omitted it.</param>
public record AddProposalCommentRequest(string? Content);
