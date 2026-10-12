using MathComps.Domain.Contracts.ConversationReview;

namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One of the defense conversations somebody held against a problem.
/// </summary>
/// <param name="Id"><inheritdoc cref="ConversationDetailDto.Id" path="/summary"/></param>
/// <param name="CreatedAt"><inheritdoc cref="ConversationDetailDto.CreatedAt" path="/summary"/></param>
public record AuthorConversationDto(Guid Id, DateTimeOffset CreatedAt);
