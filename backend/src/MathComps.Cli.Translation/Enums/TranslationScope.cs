namespace MathComps.Cli.Translation.Enums;

/// <summary>
/// Defines the scope of translation for problems.
/// </summary>
public enum TranslationScope
{
    /// <summary>
    /// Translate both problem statements and solutions.
    /// </summary>
    Both,

    /// <summary>
    /// Translate only problem statements, skip solutions.
    /// </summary>
    StatementsOnly,

    /// <summary>
    /// Translate only problem solutions, skip statements.
    /// </summary>
    SolutionsOnly
}
