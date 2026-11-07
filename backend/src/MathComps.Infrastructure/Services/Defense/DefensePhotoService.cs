using System.Diagnostics;
using System.Net.Mime;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefensePhotoService"/> over the photo reader, the private object store and the database. A
/// reading passes through no <see cref="IDefenseUserTurnGate"/>, so one student's photos are read side by side. The
/// cost is that readings in flight together each weigh the ceiling against the same total, so a day can end that many
/// readings past it. Once the
/// model has answered, the reading is paid for, so storing it and recording its spend run to the end even when the
/// student has left. The files are stored before their rows, so no row names a file that isn't there.
/// </summary>
/// <param name="targetGuard">Says whether a student may argue what the target names.</param>
/// <param name="photoReader">Reads a photo into its text and its drawings.</param>
/// <param name="objectStore">Where the photos and their drawings are kept.</param>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="defenseLimits">The input, message, and spend caps.</param>
public class DefensePhotoService(
    IDefenseTargetGuard targetGuard,
    IPhotoReader photoReader,
    IPrivateObjectStore objectStore,
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<DefenseLimits> defenseLimits)
    : IDefensePhotoService
{
    /// <summary>
    /// The prefix every defense photo lives under in private storage.
    /// </summary>
    private const string KeyPrefix = "defense/photos";

    /// <summary>
    /// The input, message, and spend caps.
    /// </summary>
    private readonly DefenseLimits _limits = defenseLimits.Value;

    /// <inheritdoc/>
    public async Task<DefensePhotoReadingDto> ReadAsync(
        Guid userId, DefenseTarget target, ReadOnlyMemory<byte> photo, CancellationToken cancellationToken = default)
    {
        // Refuse a target the student may not argue, and learn whether an entry of theirs exempts it from the ceiling.
        var holdsHostedEntry = await targetGuard.EnsureCanDefendAsync(userId, target, cancellationToken);

        // The operation's database context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Refuse the reading if the student is already over their spend ceiling and no entry puts them outside it.
        if (!holdsHostedEntry)
            await DefenseSpendLedger.EnsureUnderCeilingAsync(
                dbContext, userId, _limits.DailySpendCeilingPerUser, cancellationToken);

        // Time the reading.
        var stopwatch = Stopwatch.StartNew();

        // Read the page.
        var reading = await photoReader.ReadAsync(photo, cancellationToken);

        // Stop the clock before the storing.
        stopwatch.Stop();

        // The photo's row.
        var stored = new DefensePhoto { UserId = userId, CreatedAt = DateTimeOffset.UtcNow };

        // A row for each drawing, in the order the reading lists them, beside the drawing's image.
        var crops = reading.Value.Crops
            .Select((crop, position) => (
                Row: new DefensePhotoCrop { PhotoId = stored.Id, Label = crop.Label, Position = position },
                crop.Image))
            .ToList();

        // Store the page and every drawing where their rows say, even once the student has left.
        await Task.WhenAll(
        [
            objectStore.PutAsync(
                PhotoKey(stored.Id), reading.Value.Page, MediaTypeNames.Image.Jpeg,
                CancellationToken.None),
            .. crops.Select(crop => objectStore.PutAsync(
                CropKey(stored.Id, crop.Row.Id), crop.Image, MediaTypeNames.Image.Jpeg,
                CancellationToken.None)),
        ]);

        // Stage the photo's row.
        dbContext.DefensePhotos.Add(stored);

        // Stage the drawings' rows.
        dbContext.DefensePhotoCrops.AddRange(crops.Select(crop => crop.Row));

        // Record what the reading cost and how long it ran.
        DefenseSpendLedger.RecordReading(
            dbContext, userId, reading.Usage, (int)stopwatch.ElapsedMilliseconds, !holdsHostedEntry, stored.Id,
            stored.CreatedAt);

        // Commit the rows and the spend together.
        await dbContext.SaveChangesAsync(CancellationToken.None);

        // The page's text, with the kept photo and drawings.
        return new DefensePhotoReadingDto(
            stored.Id,
            reading.Value.Text,
            [.. crops.Select(crop => new DefensePhotoCropDto(crop.Row.Id, crop.Row.Label))]);
    }

    /// <summary>
    /// The key a photo's page lives under. Keys are built from the rows' ids alone, so a row is all it takes to find
    /// its file.
    /// </summary>
    /// <param name="photoId">The photo.</param>
    /// <returns>The object key.</returns>
    private static string PhotoKey(Guid photoId) => $"{KeyPrefix}/{photoId}.jpg";

    /// <summary>
    /// The key one of a photo's drawings lives under, beside the photo it was cut out of.
    /// </summary>
    /// <param name="photoId">The photo the drawing was cut out of.</param>
    /// <param name="cropId">The drawing.</param>
    /// <returns>The object key.</returns>
    private static string CropKey(Guid photoId, Guid cropId) => $"{KeyPrefix}/{photoId}/crops/{cropId}.jpg";
}
