using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.ProblemQuery;

/// <summary>
/// Everything one filtering run needs: the query itself, plus the context only the caller can
/// resolve. Those two are all a <see cref="FilterQuery"/> is missing, so nothing else is restated here.
/// </summary>
/// <param name="Query"><inheritdoc cref="FilterQuery" path="/summary"/></param>
/// <param name="UserId">ID of the requesting user for personalized data (e.g. likes).</param>
/// <param name="Language">The language for localized display names.</param>
public record ProblemFilterOptions(
    FilterQuery Query,
    Guid? UserId,
    Language Language
);
