using MathComps.Infrastructure.Options;
using MathComps.Shared.Io;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IExaminerConfigSnapshotProvider"/> by reading every prompt template and note once at
/// construction and serializing the result. Registered as a singleton, so the snapshot is read from disk once per
/// process rather than on every session.
/// </summary>
/// <param name="settings">The examiner engine's bound settings.</param>
public class ExaminerConfigSnapshotProvider(IOptions<ExaminerSettings> settings) : IExaminerConfigSnapshotProvider
{
    /// <inheritdoc/>
    public string Json { get; } = BuildSnapshot(settings.Value).ToJson(writeIndented: false);

    /// <summary>
    /// Builds the snapshot from the bound settings, reading every prompt template and note.
    /// </summary>
    /// <param name="settings">The examiner engine's bound settings.</param>
    /// <returns>The snapshot ready to serialize.</returns>
    private static ExaminerConfigSnapshot BuildSnapshot(ExaminerSettings settings) => new(
        BuildStepSnapshot(settings.Generate),
        BuildStepSnapshot(settings.MathCheck),
        BuildStepSnapshot(settings.LeakCheck),
        BuildStepSnapshot(settings.LanguageCheck),
        BuildNotesSnapshot(settings.Notes),
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
            step.Prompt, promptText, step.Model, step.FallbackModels, step.ReasoningEffort, step.MaxOutputTokens);
    }

    /// <summary>
    /// Builds the notes' snapshot, reading every one of them. Each is keyed by its
    /// <see cref="ExaminerNotesSettings"/> property name in camelCase.
    /// </summary>
    /// <param name="notes">The bound paths, one per note.</param>
    /// <returns>The notes' snapshot, keyed by name.</returns>
    private static IReadOnlyDictionary<string, ExaminerNoteConfigSnapshot> BuildNotesSnapshot(
        ExaminerNotesSettings notes) => new Dictionary<string, ExaminerNoteConfigSnapshot>
        {
            ["revision"] = BuildNoteSnapshot(notes.Revision),
            ["wrongClaim"] = BuildNoteSnapshot(notes.WrongClaim),
            ["leak"] = BuildNoteSnapshot(notes.Leak),
            ["withheldClose"] = BuildNoteSnapshot(notes.WithheldClose),
            ["languageSwitch"] = BuildNoteSnapshot(notes.LanguageSwitch),
            ["safeHold"] = BuildNoteSnapshot(notes.SafeHold),
            ["authorHints"] = BuildNoteSnapshot(notes.AuthorHints),
        };

    /// <summary>
    /// Builds one note's snapshot, reading the same file the engine reads it from.
    /// </summary>
    /// <param name="path">The note's path.</param>
    /// <returns>The note's snapshot.</returns>
    private static ExaminerNoteConfigSnapshot BuildNoteSnapshot(string path) =>
        new(path, FileUtilities.ReadAppFile(path));
}
