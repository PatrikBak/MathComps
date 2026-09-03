using MathComps.Infrastructure.Options;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Builds settings pointing at the shipped notes under <c>Prompts/Notes/</c>, so a test exercising the real engine
/// reads
/// the notes it actually ships with.
/// </summary>
internal static class ExaminerNotesFixture
{
    /// <summary>
    /// The shipped notes, as bound settings.
    /// </summary>
    /// <returns>The settings, one path per note.</returns>
    public static ExaminerNotesSettings Shipped() => new()
    {
        Revision = Note("revision.txt"),
        WrongClaim = Note("wrong-claim.txt"),
        Leak = Note("leak.txt"),
        WithheldClose = Note("withheld-close.txt"),
        LanguageSwitch = Note("language-switch.txt"),
        SafeHold = Note("safe-hold.txt"),
        AuthorHints = Note("author-hints.txt"),
    };

    /// <summary>
    /// One shipped note's path, relative to the run's base directory.
    /// </summary>
    /// <param name="name">The note's file name.</param>
    /// <returns>The note's path.</returns>
    private static string Note(string name) => Path.Combine("Prompts", "Notes", name);
}
