using MathComps.Domain.Contracts.Users;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One reviewer's rating of a proposal.
/// </summary>
/// <param name="Rater">The reviewer who gave it.</param>
/// <param name="IsOwn">Whether the reviewer this was read for is the one who gave it.</param>
/// <param name="Beauty"><inheritdoc cref="ProposalRating.Beauty" path="/summary"/></param>
/// <param name="Difficulty"><inheritdoc cref="ProposalRating.Difficulty" path="/summary"/></param>
public record ProposalRatingDto(
    UserIdentityDto Rater,
    bool IsOwn,
    decimal? Beauty,
    decimal? Difficulty);
