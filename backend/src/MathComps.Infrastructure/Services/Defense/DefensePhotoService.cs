using System.Diagnostics;
using System.Net.Mime;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefensePhotoService"/> over the photo reader, the private object store, the photos' files and
/// the database. A reading passes through no <see cref="IDefenseUserTurnGate"/>, so one student's photos are read side
/// by side. The cost is that readings in flight together each weigh the ceiling against the same total, so a day can
/// end that many readings past it. Once the model has answered, the reading is paid for, so storing it and recording
/// its spend run to the end even when the student has left. The files are stored before their rows, so no row names a
/// file that isn't there.
/// </summary>
/// <param name="targetGuard">Says whether a student may argue what the target names.</param>
/// <param name="photoReader">Reads a photo into its text and its drawings.</param>
/// <param name="objectStore">Where the photos and their drawings are kept.</param>
/// <param name="photoFiles">The photos' files and the links to them.</param>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="defenseLimits">The caps on a defense.</param>
public class DefensePhotoService(
    IDefenseTargetGuard targetGuard,
    IPhotoReader photoReader,
    IPrivateObjectStore objectStore,
    IDefensePhotoFiles photoFiles,
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<DefenseLimits> defenseLimits)
    : IDefensePhotoService
{
    /// <summary>
    /// The caps on a defense.
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

        // Read the page, keeping the upload when the reading fails.
        var reading = await ReadKeepingFailedUploadAsync(userId, photo, cancellationToken);

        // Stop the clock before the storing.
        stopwatch.Stop();

        // The photo's row, with the page's text as the reading gave it.
        var stored = new DefensePhoto
        {
            UserId = userId,
            Text = reading.Value.Text,
            CreatedAt = DateTimeOffset.UtcNow,
        };

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
                IDefensePhotoFiles.PhotoKey(stored.Id), reading.Value.Page, MediaTypeNames.Image.Jpeg,
                CancellationToken.None),
            .. crops.Select(crop => objectStore.PutAsync(
                IDefensePhotoFiles.CropKey(stored.Id, crop.Row.Id), crop.Image, MediaTypeNames.Image.Jpeg,
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

        // The page's text, with the kept photo, a link to its page and its drawings.
        return new DefensePhotoReadingDto(
            stored.Id,
            photoFiles.PhotoLinkFor(stored.Id),
            reading.Value.Text,
            [.. crops.Select(crop => new DefensePhotoCropDto(crop.Row.Id, crop.Row.Label))]);
    }

    /// <summary>
    /// Reads the page. A reading that fails for any reason but the student leaving keeps the upload as it came in, and
    /// its failure goes on unchanged but for the log detail it carries: the key the upload is kept under, or why it
    /// couldn't be kept.
    /// </summary>
    /// <param name="userId">The student uploading the photo.</param>
    /// <param name="photo">The photo file's bytes.</param>
    /// <param name="cancellationToken">A token to cancel the reading.</param>
    /// <returns><inheritdoc cref="IPhotoReader.ReadAsync" path="/returns"/></returns>
    private async Task<ChatCallResult<PhotoReading>> ReadKeepingFailedUploadAsync(
        Guid userId, ReadOnlyMemory<byte> photo, CancellationToken cancellationToken)
    {
        // Read the page, catching any failure that isn't the student leaving.
        try
        {
            // The reading.
            return await photoReader.ReadAsync(photo, cancellationToken);
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        {
            // Where the upload is kept.
            var key = IDefensePhotoFiles.FailedUploadKey(userId, Guid.CreateVersion7());

            // Keep the upload as it came in, even if the student leaves meanwhile.
            try
            {
                // Store the upload.
                await objectStore.PutAsync(
                    key, photo.ToArray(), MediaTypeNames.Application.Octet, CancellationToken.None);

                // The failure's log line names where the upload is kept.
                exception.LogDetail = $"the upload is kept at {key}";
            }
            catch (Exception keepFailure)
            {
                // The store failed, so the failure's log line says the upload wasn't kept, and why.
                exception.LogDetail = $"keeping the upload at {key} failed: {keepFailure.Message}";
            }

            // The reading's own failure goes on, so an unreadable photo is refused as one.
            throw;
        }
    }
}
