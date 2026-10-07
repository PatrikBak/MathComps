using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A summary of one conversation with the examiner about a proposal, whose full text is a
/// <see cref="ReviewTranscriptDto"/>.
/// </summary>
/// <param name="Id">The conversation's identifier.</param>
/// <param name="ProposalId">The proposal it was about.</param>
/// <param name="Author"><inheritdoc cref="CommentAuthorDto.Name" path="/summary"/></param>
/// <param name="StartedAt"><inheritdoc cref="DefenseSession.CreatedAt" path="/summary"/></param>
/// <param name="MessageCount">How many messages were said in it.</param>
/// <param name="HasOlderStatement">
/// Whether it was argued against a statement the proposal no longer has in any language.
/// </param>
public record ReviewConversationDto(
    Guid Id,
    Guid ProposalId,
    string? Author,
    DateTimeOffset StartedAt,
    int MessageCount,
    bool HasOlderStatement);
