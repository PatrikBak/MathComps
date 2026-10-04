namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to finalize a board into a cycle's rounds.
/// </summary>
/// <param name="CycleId">
/// The hosted group whose rounds take the board's papers, null when the request omitted it.
/// </param>
public record FinalizeBoardRequest(Guid? CycleId);
