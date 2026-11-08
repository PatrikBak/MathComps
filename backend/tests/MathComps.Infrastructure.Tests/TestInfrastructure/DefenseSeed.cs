using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Seeds what the defense feature has already billed, and the photos students have read for it.
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

    /// <summary>
    /// Builds a photo a student has read that no message carries yet, with drawings cut out of it.
    /// </summary>
    /// <param name="userId"><inheritdoc cref="DefensePhoto.UserId" path="/summary"/></param>
    /// <param name="drawings">How many drawings were cut out of the photo.</param>
    /// <returns>The photo, carrying its drawings in reading order.</returns>
    public static DefensePhoto NewPhoto(Guid userId, int drawings)
    {
        // An unsent photo of the student's
        var photo = new DefensePhoto { UserId = userId, CreatedAt = DateTimeOffset.UtcNow };

        // Its drawings, in reading order
        photo.Crops =
        [
            .. Enumerable.Range(0, drawings).Select(position => new DefensePhotoCrop
            {
                PhotoId = photo.Id,
                Label = $"Figure {position + 1}",
                Position = position,
            }),
        ];

        // Hand back the photo with its drawings
        return photo;
    }
}
