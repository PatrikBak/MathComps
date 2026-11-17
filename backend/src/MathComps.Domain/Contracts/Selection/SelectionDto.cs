using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// The whole problem selection: the categories it picks problems for and the ones its reader leads, its proposals,
/// its boards, the cycles a board can be finalized into, and the conversations reviewers held with the examiner about
/// the proposals.
/// </summary>
/// <param name="Categories">The categories the selection picks problems for, in the order they run.</param>
/// <param name="LeadCategories">
/// The <see cref="OrganizationCategory.Name"/> of each category the reader leads, in the order they run.
/// </param>
/// <param name="Proposals">
/// Every proposal in the selection, the set-aside ones included, lowest number first.
/// </param>
/// <param name="Boards">Every board, drafts and finalized ones alike, oldest first.</param>
/// <param name="Cycles">The cycles a board can be finalized into, soonest first.</param>
/// <param name="Conversations">
/// Every conversation about a proposal in the selection, newest first: each one started before students were given
/// the proposal, and after that only the ones the organization's members start.
/// </param>
/// <param name="NeedsEveryLanguage">
/// <inheritdoc cref="Organization.NeedsEveryLanguage" path="/summary"/>
/// </param>
public record SelectionDto(
    IReadOnlyList<SelectionCategoryDto> Categories,
    IReadOnlyList<string> LeadCategories,
    IReadOnlyList<ProposalDto> Proposals,
    IReadOnlyList<SelectionBoardDto> Boards,
    IReadOnlyList<SelectionCycleDto> Cycles,
    IReadOnlyList<ReviewConversationDto> Conversations,
    bool NeedsEveryLanguage);
