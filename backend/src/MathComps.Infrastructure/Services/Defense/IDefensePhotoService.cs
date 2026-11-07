using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Services.Photos;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Reads the photos students take of their handwritten work for a defense conversation, and keeps each photo and the
/// drawings cut out of it. A reading is held to the same spend ceiling as a turn, weighed before the model is called.
/// </summary>
public interface IDefensePhotoService
{
    /// <summary>
    /// Reads one photo of a page for a defense of a target, keeps the page and its drawings, and records what the
    /// reading cost.
    /// </summary>
    /// <param name="userId">The student uploading the photo.</param>
    /// <param name="target">What the student is defending.</param>
    /// <param name="photo"><inheritdoc cref="IPhotoReader.ReadAsync" path="/param[@name='photo']"/></param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The page's text, with the kept photo and drawings.</returns>
    /// <exception cref="UnreadablePhotoException">Thrown when the photo is not an image that can be read, or would
    /// decode too large.</exception>
    /// <exception cref="DefenseSpendLimitException">Thrown when the student's day's allowance is spent and no entry
    /// exempts the target.</exception>
    Task<DefensePhotoReadingDto> ReadAsync(
        Guid userId, DefenseTarget target, ReadOnlyMemory<byte> photo, CancellationToken cancellationToken = default);
}
