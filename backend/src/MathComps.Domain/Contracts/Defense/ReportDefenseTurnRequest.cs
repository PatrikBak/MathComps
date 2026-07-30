using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Defense;

/// <summary>
/// A request to record what the student holds against one examiner reply. The conversation and the reply are
/// both identified by the URL route, so the body carries only what is held against it.
/// </summary>
/// <param name="Categories">
/// Every way the reply went wrong, at least one. Nullable because a body leaving it out arrives as nothing
/// whatever the declaration says, and saying so is what lets it be refused.
/// </param>
/// <param name="Comment">
/// The student's own account of what went wrong; absent when they gave none, which
/// <see cref="DefenseReportCategory.Other"/> doesn't allow.
/// </param>
public record ReportDefenseTurnRequest(
    IReadOnlyList<DefenseReportCategory>? Categories, string? Comment);
