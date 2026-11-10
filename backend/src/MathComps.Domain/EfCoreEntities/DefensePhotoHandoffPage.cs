namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// A photo a student sent from their phone through their <see cref="DefensePhotoHandoff"/> to one problem, for a
/// composer on it to take: that problem, when the phone captured the photo, and when a composer took it.
/// </summary>
/// <remarks>
/// The problem is held as arms, of which exactly one is set, as on the handoff. Its student is its photo's
/// <see cref="DefensePhoto.UserId"/>.
/// </remarks>
public class DefensePhotoHandoffPage
{
    /// <summary>
    /// The photo; also this row's primary key, since a photo is sent once.
    /// </summary>
    public required Guid PhotoId { get; set; }

    /// <summary>
    /// Navigation to the photo.
    /// </summary>
    public DefensePhoto Photo { get; set; } = null!;

    /// <summary>
    /// The handout environment the page went to. Null when it went to an archive problem.
    /// </summary>
    public Guid? HandoutEnvironmentId { get; set; }

    /// <summary>
    /// Navigation to the handout environment.
    /// </summary>
    public HandoutEnvironment? HandoutEnvironment { get; set; }

    /// <summary>
    /// The archive problem the page went to. Null when it went to a handout environment.
    /// </summary>
    public Guid? ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem? Problem { get; set; }

    /// <summary>
    /// When the phone says it captured the photo, which puts the pages a composer takes together in order.
    /// </summary>
    public required DateTimeOffset CapturedAt { get; set; }

    /// <summary>
    /// When a composer took the page, null while it waits.
    /// </summary>
    public DateTimeOffset? TakenAt { get; set; }
}
