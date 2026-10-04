using MathComps.Domain.Contracts.Comments;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One conversation with the examiner about a proposal.
/// </summary>
/// <param name="Id">The conversation's identifier.</param>
/// <param name="ProposalId">The proposal it was about.</param>
/// <param name="Author"><inheritdoc cref="CommentAuthorDto.Name" path="/summary"/></param>
/// <param name="StartedAt"><inheritdoc cref="DefenseSession.CreatedAt" path="/summary"/></param>
/// <param name="SavedStatement">The statement as it stood when the conversation started.</param>
/// <param name="Turns">Everything said, in order.</param>
public record ReviewConversationDto(
    Guid Id,
    Guid ProposalId,
    string? Author,
    DateTimeOffset StartedAt,
    string SavedStatement,
    IReadOnlyList<DefenseTurnDto> Turns);
