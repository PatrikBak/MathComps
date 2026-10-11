using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A summary of one conversation a reviewer held with the examiner about a proposal.
/// </summary>
/// <param name="Id">The conversation's identifier.</param>
/// <param name="ProposalId">The proposal it was about.</param>
/// <param name="AuthorId"><inheritdoc cref="DefenseSession.UserId" path="/summary"/></param>
/// <param name="Author"><inheritdoc cref="CommentAuthorDto.Name" path="/summary"/></param>
/// <param name="StartedAt"><inheritdoc cref="DefenseSession.CreatedAt" path="/summary"/></param>
/// <param name="MessageCount">How many messages were said in it.</param>
/// <param name="HasOlderStatement">
/// Whether it was argued against a statement the proposal no longer has in any language.
/// </param>
public record ReviewConversationDto(
    Guid Id,
    Guid ProposalId,
    Guid AuthorId,
    string? Author,
    DateTimeOffset StartedAt,
    int MessageCount,
    bool HasOlderStatement);
