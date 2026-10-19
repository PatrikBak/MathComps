using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to set the caller's whole rating of a proposal. Leaving out both scores takes the rating back.
/// </summary>
/// <param name="Beauty"><inheritdoc cref="ProposalRating.Beauty" path="/summary"/></param>
/// <param name="Difficulty"><inheritdoc cref="ProposalRating.Difficulty" path="/summary"/></param>
public record SetRatingRequest(decimal? Beauty, decimal? Difficulty);
