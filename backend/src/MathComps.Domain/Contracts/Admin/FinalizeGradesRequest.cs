namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A request to make several entrants' grades on one problem final.
/// </summary>
/// <param name="UserIds">The entrants, null when the request omitted them.</param>
public record FinalizeGradesRequest(IReadOnlyList<Guid>? UserIds);
