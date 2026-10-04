namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to put a proposal into a slot.
/// </summary>
/// <param name="ProposalId">The proposal going into the slot, null when the request omitted it.</param>
public record PlaceProposalRequest(Guid? ProposalId);
