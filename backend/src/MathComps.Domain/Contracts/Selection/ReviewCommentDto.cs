using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One reviewer's comment under a proposal.
/// </summary>
/// <param name="Id">The comment's identifier.</param>
/// <param name="Author"><inheritdoc cref="CommentAuthorDto.Name" path="/summary"/></param>
/// <param name="Content"><inheritdoc cref="Comment.Content" path="/summary"/></param>
/// <param name="CreatedAt"><inheritdoc cref="Comment.CreatedAt" path="/summary"/></param>
public record ReviewCommentDto(Guid Id, string? Author, string Content, DateTimeOffset CreatedAt);
