using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefensePhotoFiles"/> over the links to the private object store's files.
/// </summary>
/// <param name="fileLinks">The links to the private store's files.</param>
public class DefensePhotoFiles(IPrivateFileLinks fileLinks) : IDefensePhotoFiles
{
    /// <inheritdoc/>
    public IReadOnlyList<DefenseTurnPhotoDto> LinksFor(IEnumerable<DefensePhoto> photos) =>
        // Each page's link in page order, with its drawings' in reading order
        [.. photos
            .OrderBy(photo => photo.Position)
            .Select(photo => new DefenseTurnPhotoDto(
                photo.Id,
                fileLinks.LinkFor(IDefensePhotoFiles.PhotoKey(photo.Id)),
                [.. photo.Crops
                    .OrderBy(crop => crop.Position)
                    .Select(crop => new DefenseTurnCropDto(
                        crop.Id, fileLinks.LinkFor(IDefensePhotoFiles.CropKey(photo.Id, crop.Id))))]))];
}
