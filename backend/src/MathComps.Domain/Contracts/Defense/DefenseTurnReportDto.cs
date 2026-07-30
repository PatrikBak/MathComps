using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// What a student holds against one examiner reply, as returned to the client.
/// </summary>
/// <param name="TurnId">The reported reply's identifier.</param>
/// <param name="Categories">Every way the reply went wrong.</param>
/// <param name="Comment">The student's own account of what went wrong, or null when they gave none.</param>
public record DefenseTurnReportDto(
    Guid TurnId, IReadOnlyList<DefenseReportCategory> Categories, string? Comment);
