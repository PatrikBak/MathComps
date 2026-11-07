using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Seeds what the defense feature has already billed.
/// </summary>
public static class DefenseSeed
{
    /// <summary>
    /// Builds one turn's spend row of a given cost, with no tokens and no time behind it.
    /// </summary>
    /// <param name="userId"><inheritdoc cref="DefenseSpend.UserId" path="/summary"/></param>
    /// <param name="cost"><inheritdoc cref="DefenseSpend.Cost" path="/summary"/></param>
    /// <param name="countsAgainstCeiling"><inheritdoc cref="DefenseSpend.CountsAgainstCeiling" path="/summary"/></param>
    /// <param name="createdAt"><inheritdoc cref="DefenseSpend.CreatedAt" path="/summary"/></param>
    /// <returns>The row.</returns>
    public static DefenseSpend NewSpend(
        Guid userId, decimal cost, bool countsAgainstCeiling, DateTimeOffset createdAt) => new()
        {
            UserId = userId,
            Cost = cost,
            PromptTokens = 0,
            CompletionTokens = 0,
            ReasoningTokens = 0,
            CachedPromptTokens = 0,
            DurationMs = 0,
            Revisions = 0,
            CountsAgainstCeiling = countsAgainstCeiling,
            PhotoId = null,
            CreatedAt = createdAt,
        };
}
