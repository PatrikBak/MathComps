using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The files of the photos students send with their defense messages: where each page and each drawing cut out of it
/// is kept, the links to them, and the drawings read back.
/// </summary>
public interface IDefensePhotoFiles
{
    /// <summary>
    /// The prefix every defense photo lives under in private storage.
    /// </summary>
    private const string KeyPrefix = "defense/photos";

    /// <summary>
    /// The key a photo's page lives under. Keys are built from the rows' ids alone, so a row is all it takes to find
    /// its file.
    /// </summary>
    /// <param name="photoId">The photo.</param>
    /// <returns>The object key.</returns>
    internal static string PhotoKey(Guid photoId) => $"{KeyPrefix}/{photoId}.jpg";

    /// <summary>
    /// The key one of a photo's drawings lives under, beside the photo it was cut out of.
    /// </summary>
    /// <param name="photoId">The photo the drawing was cut out of.</param>
    /// <param name="cropId">The drawing.</param>
    /// <returns>The object key.</returns>
    internal static string CropKey(Guid photoId, Guid cropId) => $"{KeyPrefix}/{photoId}/crops/{cropId}.jpg";

    /// <summary>
    /// Links to the pages a message went out with and to every drawing cut out of them.
    /// </summary>
    /// <param name="photos">The photos one message went out with, each with the drawings cut out of it.</param>
    /// <returns>The photos with their links in page order, each one's drawings in the order its reading lists
    /// them.</returns>
    IReadOnlyList<DefenseTurnPhotoDto> LinksFor(IEnumerable<DefensePhoto> photos);

    /// <summary>
    /// Reads every drawing cut out of the pages a message went out with, in the order <see cref="LinksFor"/> lists
    /// them. A drawing that can't be read, its file gone or the read failing, keeps its place as null, and the others
    /// are read all the same.
    /// </summary>
    /// <param name="photos">The message's photos, with the drawings cut out of them.</param>
    /// <param name="cancellationToken">Cancels the reads.</param>
    /// <returns>Each drawing's JPEG, or null for one that couldn't be read, in that order.</returns>
    Task<IReadOnlyList<byte[]?>> ReadCropsAsync(IEnumerable<DefensePhoto> photos, CancellationToken cancellationToken);
}
