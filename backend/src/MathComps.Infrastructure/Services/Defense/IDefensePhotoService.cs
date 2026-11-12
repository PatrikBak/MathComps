using System.Collections.Immutable;
using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Photos;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Reads the photos students take of their handwritten work for a defense conversation, keeps each photo, its text
/// and its drawings, and hands a student links to the photos they have yet to send. A reading is held to the same
/// spend ceiling as a turn, weighed before the model is called.
/// </summary>
public interface IDefensePhotoService
{
    /// <summary>
    /// Reads one photo of a page for a defense of a target, keeps the page, its text and its drawings, and records
    /// what the reading cost. A reading that fails for any reason but the caller cancelling it keeps the photo file as
    /// it came in, and the exception it fails with names where.
    /// </summary>
    /// <param name="userId">The student uploading the photo.</param>
    /// <param name="target">What the student is defending.</param>
    /// <param name="photo"><inheritdoc cref="IPhotoReader.ReadAsync" path="/param[@name='photo']"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The page's text, with the kept photo, a link to its page and its drawings.</returns>
    /// <exception cref="UnreadablePhotoException">Thrown when the photo is not an image that can be read, or would
    /// decode too large.</exception>
    /// <exception cref="DefenseSpendLimitException">Thrown when the student's day's allowance is spent and they are not
    /// competing on the target.</exception>
    Task<DefensePhotoReadingDto> ReadAsync(
        Guid userId, DefenseTarget target, ReadOnlyMemory<byte> photo, CancellationToken cancellationToken = default);

    /// <summary>
    /// Links to the student's own photos among those named that no message carries yet. Any other photo is left out,
    /// and so is every photo past the most one call gets links to.
    /// </summary>
    /// <param name="userId">The student.</param>
    /// <param name="photoIds">The photos.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Each such photo's link to its page, by its id.</returns>
    Task<ImmutableDictionary<Guid, string>> LinksToUnsentPhotosAsync(
        Guid userId, IEnumerable<Guid> photoIds, CancellationToken cancellationToken = default);
}
