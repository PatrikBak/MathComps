namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The whole problem selection: its proposals, the boards still in play, the cycles a board can be finalized into,
/// and the conversations reviewers held with the examiner about the proposals.
/// </summary>
/// <param name="Proposals">
/// Every proposal still in the selection, the set-aside ones included, lowest number first.
/// </param>
/// <param name="Boards">Every draft board and every finalized one whose cycle has not opened, oldest first.</param>
/// <param name="Cycles">The cycles a board can be finalized into, soonest first.</param>
/// <param name="Conversations">Every conversation held about a proposal in the selection, newest first.</param>
public record SelectionDto(
    IReadOnlyList<ProposalDto> Proposals,
    IReadOnlyList<SelectionBoardDto> Boards,
    IReadOnlyList<SelectionCycleDto> Cycles,
    IReadOnlyList<ReviewConversationDto> Conversations);
