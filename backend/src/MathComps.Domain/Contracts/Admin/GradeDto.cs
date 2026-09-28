namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Where one entrant's grade on one problem currently stands.
/// </summary>
/// <param name="Mark"><inheritdoc cref="EfCoreEntities.HostedGrade.Mark" path="/summary"/></param>
/// <param name="Help"><inheritdoc cref="EfCoreEntities.HostedGrade.Help" path="/summary"/></param>
/// <param name="InternalComment">
/// <inheritdoc cref="EfCoreEntities.HostedGrade.InternalComment" path="/summary"/>
/// </param>
/// <param name="IsFinal"><inheritdoc cref="EfCoreEntities.HostedGrade.IsFinal" path="/summary"/></param>
/// <param name="UpdatedAt">When it last changed.</param>
/// <param name="UpdatedBy">The grader who changed it last.</param>
public record GradeDto(
    int? Mark,
    int Help,
    string InternalComment,
    bool IsFinal,
    DateTimeOffset UpdatedAt,
    UserIdentityDto UpdatedBy);
