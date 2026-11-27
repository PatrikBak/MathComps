using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to recommend a proposal for one paper with no category, or take the recommendation back.
/// </summary>
/// <param name="PaperId">
/// The paper the recommendation is for, by its <see cref="SelectionPaper.Id"/>; null when the request sent null.
/// </param>
/// <param name="IsRecommended">
/// Whether the proposal should be recommended for the paper, null when the request sent null.
/// </param>
public record SetPaperRecommendedRequest(Guid? PaperId, bool? IsRecommended);
