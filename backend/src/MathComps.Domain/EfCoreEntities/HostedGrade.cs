namespace MathComps.Domain.EfCoreEntities;

/// <summary>
/// One version of the grade a sat <see cref="HostedEntry"/> earns on one problem of its round. The grader records
/// the mark and how much of it came from the examiner, and any score is derived from those, so a change of formula
/// never forces a re-grade.
/// </summary>
/// <remarks>
/// Rows are only ever added. Every change writes a new one carrying the whole grade as it then stood, and the
/// newest row for an entry and a problem is the grade. So who moved a mark, and when, stays readable after
/// somebody else moves it again.
///
/// One grade per problem however many conversations the student held about it, since the conversations are
/// together the work one mark is given for.
/// </remarks>
public class HostedGrade
{
    /// <summary>
    /// A ceiling no mark may pass, set far above any competition's scale so that a new format needs no migration.
    /// </summary>
    public const int MaxMark = 100;

    /// <summary>
    /// Primary key (Guid v7).
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>
    /// The entry graded.
    /// </summary>
    public required Guid EntryId { get; set; }

    /// <summary>
    /// Navigation to the entry.
    /// </summary>
    public HostedEntry Entry { get; set; } = null!;

    /// <summary>
    /// The problem graded, one of the entry's round.
    /// </summary>
    public required Guid ProblemId { get; set; }

    /// <summary>
    /// Navigation to the problem.
    /// </summary>
    public Problem Problem { get; set; } = null!;

    /// <summary>
    /// The mark the work earns on its competition's scale, however much the examiner helped; null while no mark
    /// is given.
    /// </summary>
    public int? Mark { get; set; }

    /// <summary>
    /// The part of <see cref="Mark"/> that came from the examiner, 0 to the mark.
    /// </summary>
    public required int Help { get; set; }

    /// <summary>
    /// What the grader wrote for other graders, empty while nothing is written.
    /// </summary>
    public required string InternalComment { get; set; }

    /// <summary>
    /// Whether the grade is settled rather than a first pass, which only a grade with a mark can be.
    /// </summary>
    public required bool IsFinal { get; set; }

    /// <summary>
    /// The grader who wrote this version.
    /// </summary>
    public required Guid AuthorId { get; set; }

    /// <summary>
    /// Navigation to the grader.
    /// </summary>
    public User Author { get; set; } = null!;

    /// <summary>
    /// When this version was written, which is what orders the versions of one grade.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; set; }
}
