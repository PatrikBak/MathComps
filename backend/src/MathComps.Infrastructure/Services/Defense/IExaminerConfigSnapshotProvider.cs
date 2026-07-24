namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Provides the examiner engine's config snapshot, serialized once for every new session to record.
/// </summary>
public interface IExaminerConfigSnapshotProvider
{
    /// <summary>
    /// The examiner's current config, serialized to JSON with each step's prompt template text included.
    /// </summary>
    string Json { get; }
}
