using MathComps.Infrastructure.Options;
using MathComps.Shared.Io;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IExaminerConfigSnapshotProvider"/> by reading each step's prompt template once at
/// construction and serializing the result — a singleton, so the snapshot is read from disk once per process
/// rather than on every session.
/// </summary>
/// <param name="settings">The examiner engine's bound settings.</param>
public class ExaminerConfigSnapshotProvider(IOptions<ExaminerSettings> settings) : IExaminerConfigSnapshotProvider
{
    /// <inheritdoc/>
    public string Json { get; } = BuildSnapshot(settings.Value).ToJson(writeIndented: false);

    /// <summary>
    /// Builds the snapshot from the bound settings, reading each step's prompt template.
    /// </summary>
    /// <param name="settings">The examiner engine's bound settings.</param>
    /// <returns>The snapshot ready to serialize.</returns>
    private static ExaminerConfigSnapshot BuildSnapshot(ExaminerSettings settings) => new(
        BuildStepSnapshot(settings.Generate),
        BuildStepSnapshot(settings.MathCheck),
        BuildStepSnapshot(settings.LeakCheck),
        BuildStepSnapshot(settings.LanguageCheck),
        settings.MaxRevisions);

    /// <summary>
    /// Builds one step's snapshot, reading its prompt template.
    /// </summary>
    /// <param name="step">The step's bound settings.</param>
    /// <returns>The step's snapshot.</returns>
    private static ChatStepConfigSnapshot BuildStepSnapshot(ChatStepSettings step)
    {
        // Read the same file the engine runs on, so the snapshot matches what actually ran.
        var promptText = FileUtilities.ReadAppFile(step.Prompt);

        // Carry the rest of the step's config alongside the prompt text, unchanged.
        return new ChatStepConfigSnapshot(
            step.Prompt, promptText, step.Model, step.ReasoningEffort, step.MaxOutputTokens);
    }
}
