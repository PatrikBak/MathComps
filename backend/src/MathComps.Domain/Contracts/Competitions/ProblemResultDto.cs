using System.Text.Json.Serialization;

namespace MathComps.Domain.Contracts.Competitions;

/// <summary>
/// A student's own result on one problem of a competition whose results are out.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NoConversationResultDto), typeDiscriminator: "none")]
[JsonDerivedType(typeof(PendingResultDto), typeDiscriminator: "pending")]
[JsonDerivedType(typeof(FinalResultDto), typeDiscriminator: "final")]
public abstract record ProblemResultDto;

/// <inheritdoc cref="NoConversationCellDto" path="/summary"/>
public sealed record NoConversationResultDto : ProblemResultDto;

/// <inheritdoc cref="PendingCellDto" path="/summary"/>
public sealed record PendingResultDto : ProblemResultDto;

/// <summary>
/// A problem whose grade is final, which opens the conversation about it to the student.
/// </summary>
/// <param name="Mark">The mark the work earns on its competition's scale, however much the examiner helped.</param>
/// <param name="Help"><inheritdoc cref="EfCoreEntities.HostedGrade.Help" path="/summary"/></param>
/// <param name="Conversation"><inheritdoc cref="GradeConversationDto" path="/summary"/></param>
public sealed record FinalResultDto(int Mark, int Help, GradeConversationDto Conversation) : ProblemResultDto;
