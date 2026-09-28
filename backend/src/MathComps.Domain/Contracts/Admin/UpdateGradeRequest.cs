namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// A change to one entrant's grade on one problem, carrying only what changed.
/// </summary>
/// <param name="Mark">The new mark, or null when this change does not set it.</param>
/// <param name="Help">
/// The new <see cref="EfCoreEntities.HostedGrade.Help"/>, or null when this change does not set it.
/// </param>
/// <param name="InternalComment">The new comment for graders, or null when this change does not set it.</param>
/// <param name="IsFinal">Whether it is now final, or null when this change does not set it.</param>
public record UpdateGradeRequest(GradeMarkChange? Mark, int? Help, string? InternalComment, bool? IsFinal);
