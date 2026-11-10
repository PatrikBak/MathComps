using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefensePhotoFiles"/> over the private object store's files and the links to them.
/// </summary>
/// <param name="fileLinks">The links to the private store's files.</param>
/// <param name="objectReader">The reader of the private store's files.</param>
public class DefensePhotoFiles(IPrivateFileLinks fileLinks, IObjectReader objectReader) : IDefensePhotoFiles
{
    /// <inheritdoc/>
    public string PhotoLinkFor(Guid photoId) =>
        // The link to the page, under the key its id builds
        fileLinks.LinkFor(IDefensePhotoFiles.PhotoKey(photoId));

    /// <inheritdoc/>
    public IReadOnlyList<DefenseTurnPhotoDto> LinksFor(IEnumerable<DefensePhoto> photos) =>
        // Each page's link in page order, with its drawings' in reading order
        [.. InPageOrder(photos)
            .Select(page => new DefenseTurnPhotoDto(
                page.Photo.Id,
                PhotoLinkFor(page.Photo.Id),
                [.. page.Crops
                    .Select(crop => new DefenseTurnCropDto(
                        crop.Id, fileLinks.LinkFor(IDefensePhotoFiles.CropKey(page.Photo.Id, crop.Id))))]))];

    /// <inheritdoc/>
    public async Task<IReadOnlyList<byte[]>> ReadCropsAsync(
        IEnumerable<DefensePhoto> photos, CancellationToken cancellationToken)
    {
        // Every drawing's key, the pages in page order and each page's drawings in reading order
        var keys = InPageOrder(photos)
            .SelectMany(page => page.Crops.Select(crop => IDefensePhotoFiles.CropKey(page.Photo.Id, crop.Id)))
            .ToList();

        // Read them all at once, each landing in its key's place
        var crops = await Task.WhenAll(keys.Select(key => objectReader.ReadBytesAsync(key, cancellationToken)));

        // Hand back the drawings, every one of which has to have its file
        return [.. crops.Select((crop, index) =>
            crop ?? throw new InvalidOperationException($"The drawing kept under {keys[index]} has no file."))];
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
