using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Storage;
using Microsoft.Extensions.Logging;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefensePhotoFiles"/> over the private object store's files and the links to them. A drawing
/// that can't be read is logged as an error.
/// </summary>
/// <param name="fileLinks">The links to the private store's files.</param>
/// <param name="objectReader">The reader of the private store's files.</param>
/// <param name="logger">The logger.</param>
public class DefensePhotoFiles(
    IPrivateFileLinks fileLinks,
    IObjectReader objectReader,
    ILogger<DefensePhotoFiles> logger)
    : IDefensePhotoFiles
{
    /// <inheritdoc/>
    public IReadOnlyList<DefenseTurnPhotoDto> LinksFor(IEnumerable<DefensePhoto> photos) =>
        // Each page's link in page order, with its drawings' in reading order
        [.. InPageOrder(photos)
            .Select(page => new DefenseTurnPhotoDto(
                page.Photo.Id,
                fileLinks.LinkFor(IDefensePhotoFiles.PhotoKey(page.Photo.Id)),
                [.. page.Crops
                    .Select(crop => new DefenseTurnCropDto(
                        crop.Id, fileLinks.LinkFor(IDefensePhotoFiles.CropKey(page.Photo.Id, crop.Id))))]))];

    /// <inheritdoc/>
    public async Task<IReadOnlyList<byte[]?>> ReadCropsAsync(
        IEnumerable<DefensePhoto> photos, CancellationToken cancellationToken)
    {
        // Every drawing's key, the pages in page order and each page's drawings in reading order
        var keys = InPageOrder(photos)
            .SelectMany(page => page.Crops.Select(crop => IDefensePhotoFiles.CropKey(page.Photo.Id, crop.Id)));

        // Read them all at once, each landing in its key's place
        return await Task.WhenAll(keys.Select(key => ReadCropAsync(key, cancellationToken)));
    }

    /// <summary>
    /// Reads the file of one drawing, logging a drawing that can't be read, whether its file is gone or the read
    /// fails. A read the caller cancels still throws.
    /// </summary>
    /// <param name="key">The key the drawing is kept under.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The drawing's JPEG, or null when it couldn't be read.</returns>
    private async Task<byte[]?> ReadCropAsync(string key, CancellationToken cancellationToken)
    {
        // Read the drawing, any failure but the caller's cancel leaving its place empty
        try
        {
            // The drawing's file
            var crop = await objectReader.ReadBytesAsync(key, cancellationToken);

            // A drawing whose file is gone is logged as lost
            if (crop is null)
                logger.LogError("The drawing kept under {Key} has no file, so its place is left empty", key);

            // The drawing, or nothing for one without a file
            return crop;
        }
        catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
        {
            // The read that failed, with what broke it
            logger.LogError(
                exception, "Reading the drawing kept under {Key} failed, so its place is left empty", key);

            // Nothing read for the drawing
            return null;
        }
    }

    /// <summary>
    /// Puts a message's pages in page order, each with its drawings in the order its reading lists them: the one order
    /// the pages are shown in and the drawings numbered in.
    /// </summary>
    /// <param name="photos">The message's photos, with the drawings cut out of them.</param>
    /// <returns>Each page with its drawings, in order.</returns>
    private static IEnumerable<(DefensePhoto Photo, IEnumerable<DefensePhotoCrop> Crops)> InPageOrder(
        IEnumerable<DefensePhoto> photos) =>
        // The pages by place, the drawings by place within each
        photos
            .OrderBy(photo => photo.Position)
            .Select(photo => (photo, photo.Crops.OrderBy(crop => crop.Position).AsEnumerable()));
}
