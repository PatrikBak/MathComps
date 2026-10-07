using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.Services.Localization;

/// <summary>
/// The site's addresses in one language. The localized path segments and the query names are the web's own, so a
/// route renamed there has to be renamed here too.
/// </summary>
/// <param name="SiteUrl"><inheritdoc cref="Options.SiteSettings.Url" path="/summary"/></param>
/// <param name="Language">The language the pages open in.</param>
public sealed record SiteLinks(string SiteUrl, Language Language)
{
    /// <summary>
    /// The site's home page in the language, which every page in it sits under, with no trailing slash.
    /// </summary>
    public string Home =>
        // The address and the language's code, joined by exactly one slash
        $"{Root}/{Language.ToString().ToLowerInvariant()}";

    /// <summary>
    /// The site's logo, the same image in every language.
    /// </summary>
    public string Logo =>
        // The image the site serves from its root
        $"{Root}/logo-mathcomps.png";

    /// <summary>
    /// The page about the project.
    /// </summary>
    public string About
    {
        get
        {
            // The page's segment in the language
            var segment = Language switch
            {
                Language.SK => "o-projekte",
                Language.CS => "o-projektu",
                Language.EN => "about",
                _ => throw new ArgumentOutOfRangeException(nameof(Language), Language, "Unknown language")
            };

            // The page under the language's home
            return $"{Home}/{segment}";
        }
    }

    /// <summary>
    /// The page on privacy and terms.
    /// </summary>
    public string Privacy
    {
        get
        {
            // The page's segment in the language
            var segment = Language switch
            {
                Language.SK => "ochrana-sukromia",
                Language.CS => "ochrana-soukromi",
                Language.EN => "privacy",
                _ => throw new ArgumentOutOfRangeException(nameof(Language), Language, "Unknown language")
            };

            // The page under the language's home
            return $"{Home}/{segment}";
        }
    }

    /// <summary>
    /// The student's way into a grade conversation: their competition's page, opening the conversation about one
    /// problem.
    /// </summary>
    /// <param name="competitionSlug">What addresses the competition in the language.</param>
    /// <param name="problemId">The problem the conversation is about.</param>
    /// <returns>The address.</returns>
    public string StudentThread(string competitionSlug, Guid problemId) =>
        // The competition's page, asked to open the problem's conversation
        $"{Home}/{CompetitionsSegment}/{Uri.EscapeDataString(competitionSlug)}?feedback={problemId}";

    /// <summary>
    /// A grader's way into a grade conversation: the group's grading board, opening the student's grade on one
    /// problem at the conversation with them.
    /// </summary>
    /// <param name="groupSlug">What addresses the group the student entered.</param>
    /// <param name="category">The level the student competed at, which the board has to show to open them.</param>
    /// <param name="studentId">The student.</param>
    /// <param name="problemId">The problem.</param>
    /// <returns>The address.</returns>
    public string GraderThread(
        string groupSlug, HostedCompetitionCategory category, Guid studentId, Guid problemId)
    {
        // How the board names the level in its address
        var level = category switch
        {
            HostedCompetitionCategory.Elementary => "elementary",
            HostedCompetitionCategory.Intermediate => "intermediate",
            HostedCompetitionCategory.Advanced => "advanced",
            _ => throw new ArgumentOutOfRangeException(nameof(category), category, "Unknown category")
        };

        // The group's board, asked to open the student's grade on its conversation
        return $"{Home}/admin/{GradingSegment}/{Uri.EscapeDataString(groupSlug)}"
            + $"?category={level}&student={studentId}&problem={problemId}&tab=feedback";
    }

    /// <summary>
    /// The site's address with no trailing slash, which every address joins on.
    /// </summary>
    private string Root =>
        // However the address was configured, without the slash
        SiteUrl.TrimEnd('/');

    /// <summary>
    /// The path segment the competitions' pages sit under in the language.
    /// </summary>
    private string CompetitionsSegment => Language switch
    {
        Language.SK => "mathildovanie",
        Language.CS => "mathildovani",
        Language.EN => "mathilding",
        _ => throw new ArgumentOutOfRangeException(nameof(Language), Language, "Unknown language")
    };

    /// <summary>
    /// The path segment the grading boards sit under in the language, below the admin's own.
    /// </summary>
    private string GradingSegment => Language switch
    {
        Language.SK => "hodnotenie",
        Language.CS => "hodnoceni",
        Language.EN => "grading",
        _ => throw new ArgumentOutOfRangeException(nameof(Language), Language, "Unknown language")
    };
}
