namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to put a proposal into a slot.
/// </summary>
/// <param name="ProposalId">The proposal going into the slot, null when the request sent null.</param>
public record PlaceProposalRequest(Guid? ProposalId);
