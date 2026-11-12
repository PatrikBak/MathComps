namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// Extension methods for <see cref="IQueryable{T}"/> of <see cref="DefensePhoto"/>.
/// </summary>
public static class DefensePhotoQueryableExtensions
{
    /// <summary>
    /// Narrows to the named photos a student may still send: their own, and carried by no message yet.
    /// </summary>
    /// <param name="source">The source queryable of photos.</param>
    /// <param name="userId">The student.</param>
    /// <param name="photoIds">The photos named.</param>
    /// <returns>The queryable narrowed to the named photos of the student's that no message carries.</returns>
    public static IQueryable<DefensePhoto> WhereUnsentOf(
        this IQueryable<DefensePhoto> source, Guid userId, IReadOnlyCollection<Guid> photoIds) =>
        // The named ones of the student's that no message carries
        source.Where(photo => photoIds.Contains(photo.Id) && photo.UserId == userId && photo.TurnId == null);
}
