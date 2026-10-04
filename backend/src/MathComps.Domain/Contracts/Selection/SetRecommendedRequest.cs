using MathComps.Domain.Contracts.Competitions;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to recommend a proposal for one category, or take the recommendation back.
/// </summary>
/// <param name="Category">The category the recommendation is for, null when the request omitted it.</param>
/// <param name="IsRecommended">
/// Whether the proposal should be recommended for the category, null when the request omitted it.
/// </param>
public record SetRecommendedRequest(HostedCompetitionCategory? Category, bool? IsRecommended);
