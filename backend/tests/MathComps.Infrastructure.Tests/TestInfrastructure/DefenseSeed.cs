using System.Net.Mime;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Storage;

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
        var photo = new DefensePhoto { UserId = userId, Text = "The page as read", CreatedAt = DateTimeOffset.UtcNow };

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

    /// <summary>
    /// Keeps a file for every drawing cut out of the photos where the reading keeps it, its bytes the drawing's id, so
    /// a test reads back which drawing a file is.
    /// </summary>
    /// <param name="store">The store to keep the files in.</param>
    /// <param name="photos">The photos, with their drawings.</param>
    /// <returns>A task that completes once every file is kept.</returns>
    public static async Task StoreCropFilesAsync(IPrivateObjectStore store, IEnumerable<DefensePhoto> photos)
    {
        // Each drawing of each photo gets its file
        foreach (var (photo, crop) in photos.SelectMany(photo => photo.Crops.Select(crop => (photo, crop))))
            await store.PutAsync(
                $"defense/photos/{photo.Id}/crops/{crop.Id}.jpg", crop.Id.ToByteArray(), MediaTypeNames.Image.Jpeg,
                CancellationToken.None);
    }
}
