using System.Text.RegularExpressions;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Shared.Cli;

namespace MathComps.Api.Tests;

/// <summary>
/// Guards that the addresses the backend builds into the site are the web's own: the localized path of each page,
/// the query names a page reads, and the names the grading board gives the levels.
/// </summary>
/// <remarks>
/// Both ends spell these out, since the web routes by them and a mail has to link in from outside. Drift is the
/// failure that matters: a link would open a page that is not there, or one that ignores what it was asked to
/// open, with nothing red on either side.
/// </remarks>
public class SiteLinksParityTests
{
    /// <summary>
    /// The address the links start with here.
    /// </summary>
    private const string SiteUrl = "https://mathcomps.test";

    /// <summary>
    /// A student's id in the links built here.
    /// </summary>
    private static readonly Guid _studentId = Guid.Parse("01994f6e-0000-7000-8000-000000000002");

    /// <summary>
    /// A problem's id in the links built here.
    /// </summary>
    private static readonly Guid _problemId = Guid.Parse("01994f6e-0000-7000-8000-000000000001");

    /// <summary>
    /// Every language.
    /// </summary>
    public static TheoryData<Language> Languages
    {
        get
        {
            // The rows, filled below
            var languages = new TheoryData<Language>();

            // Each language
            foreach (var language in Enum.GetValues<Language>())
                languages.Add(language);

            // A row per language
            return languages;
        }
    }

    /// <summary>
    /// Each page the backend links to sits where the web's routing puts it in the language, under the language's
    /// prefix, which the web always shows.
    /// </summary>
    /// <param name="language">The language the pages open in.</param>
    [Theory]
    [MemberData(nameof(Languages))]
    public void Each_page_sits_where_the_web_routes_it(Language language)
    {
        // The backend's addresses in the language
        var links = new SiteLinks(SiteUrl, language);

        // Every page path the web shows starts with the language
        Assert.Equal("always", ReadTsString(I18nPath, "localePrefix"));

        // The language's home
        Assert.Equal(Prefix(language), PathOf(links.Home));

        // The page about the project
        Assert.Equal(WebPath(language, "/about"), PathOf(links.About));

        // The page on privacy and terms
        Assert.Equal(WebPath(language, "/privacy"), PathOf(links.Privacy));

        // A competition's page
        Assert.Equal(
            WebPath(language, "/mathilding/[slug]").Replace("[slug]", "round-slug"),
            PathOf(links.StudentThread("round-slug", _problemId)));

        // A group's grading board
        Assert.Equal(
            WebPath(language, "/admin/grading/[slug]").Replace("[slug]", "group-slug"),
            PathOf(links.GraderThread("group-slug", HostedCompetitionCategory.Advanced, _studentId, _problemId)));
    }

    /// <summary>
    /// A link into a conversation asks for it by the query names the page reads: the competition's page by the
    /// problem, the board by the level, the student, the problem and the conversation's tab.
    /// </summary>
    [Fact]
    public void A_link_into_a_conversation_asks_by_the_names_the_page_reads()
    {
        // The backend's addresses in English
        var links = new SiteLinks(SiteUrl, Language.EN);

        // The competition's page, asked for the problem's conversation
        Assert.Equal(
            [(ReadTsString(CompetitionRoutesPath, "FEEDBACK_PARAM"), _problemId.ToString())],
            QueryOf(links.StudentThread("round-slug", _problemId)));

        // The board, asked for the level, the student's grade on the problem, and the conversation's tab
        Assert.Equal(
            [
                (ReadTsString(GradingUrlPath, "CATEGORY_PARAM"), "advanced"),
                (ReadTsString(GradingUrlPath, "STUDENT_PARAM"), _studentId.ToString()),
                (ReadTsString(GradingUrlPath, "PROBLEM_PARAM"), _problemId.ToString()),
                (ReadTsString(GradingUrlPath, "TAB_PARAM"), ReadTsString(GradingUrlPath, "FEEDBACK_TAB")),
            ],
            QueryOf(links.GraderThread("group-slug", HostedCompetitionCategory.Advanced, _studentId, _problemId)));
    }

    /// <summary>
    /// Every level the backend names in a link to the board is one the board knows.
    /// </summary>
    [Fact]
    public void Every_level_is_one_the_board_knows()
    {
        // The levels the board knows, as the web lists them
        var webLevels = Regex.Match(
                File.ReadAllText(HostedTypesPath), @"HOSTED_COMPETITION_CATEGORIES = \[(?<levels>[^\]]*)\]")
            .Groups["levels"].Value
            .Split(',')
            .Select(level => level.Trim().Trim('\''))
            .ToHashSet();

        // The backend's addresses in English
        var links = new SiteLinks(SiteUrl, Language.EN);

        // The name each level goes by in a link
        var linkedLevels = Enum.GetValues<HostedCompetitionCategory>()
            .Select(category => QueryOf(links.GraderThread("group-slug", category, _studentId, _problemId))[0].Value)
            .ToList();

        // Every linked level one the board knows
        Assert.All(linkedLevels, level => Assert.Contains(level, webLevels));
    }

    /// <summary>
    /// The web's routing config.
    /// </summary>
    private static string I18nPath => RepoPaths.Resolve("web", "src", "i18n", "i18n.ts");

    /// <summary>
    /// The web's module naming a competition page's query parameters.
    /// </summary>
    private static string CompetitionRoutesPath => RepoPaths.Resolve(
        "web", "src", "components", "features", "hosted-competitions", "services", "hosted-competition-routes.ts");

    /// <summary>
    /// The web's module naming the grading board's query parameters.
    /// </summary>
    private static string GradingUrlPath => RepoPaths.Resolve(
        "web", "src", "components", "features", "admin", "grading-board", "model", "grading-url.ts");

    /// <summary>
    /// The web's module listing the levels a hosted competition runs at.
    /// </summary>
    private static string HostedTypesPath => RepoPaths.Resolve(
        "web", "src", "components", "features", "hosted-competitions", "model", "hosted-competition-types.ts");

    /// <summary>
    /// Reads the string one <c>const NAME = '…'</c> holds in a web module.
    /// </summary>
    /// <param name="path">The module.</param>
    /// <param name="name">The constant's name.</param>
    /// <returns>The string.</returns>
    private static string ReadTsString(string path, string name)
    {
        // The declaration, with whatever string it holds
        var match = Regex.Match(File.ReadAllText(path), $"const {name} = '(?<value>[^']*)'");

        // A name the web no longer declares is drift of the loudest kind
        Assert.True(match.Success, $"{Path.GetFileName(path)} declares no {name}.");

        // The string
        return match.Groups["value"].Value;
    }

    /// <summary>
    /// Reads where the web's routing puts one page in a language, with the language's prefix.
    /// </summary>
    /// <param name="language">The language.</param>
    /// <param name="route">The page's canonical route, which is its English path.</param>
    /// <returns>The path.</returns>
    private static string WebPath(Language language, string route)
    {
        // The page's line in the route translations, its Slovak and Czech paths beside the canonical one
        var match = Regex.Match(
            File.ReadAllText(I18nPath),
            $"'{Regex.Escape(route)}': \\{{ sk: '(?<sk>[^']*)', cs: '(?<cs>[^']*)' \\}}");

        // A route the web no longer translates is drift too
        Assert.True(match.Success, $"i18n.ts translates no {route}.");

        // The path in the language, under its prefix
        return Prefix(language) + language switch
        {
            Language.SK => match.Groups["sk"].Value,
            Language.CS => match.Groups["cs"].Value,
            Language.EN => route,
            _ => throw new ArgumentOutOfRangeException(nameof(language), language, "Unknown language")
        };
    }

    /// <summary>
    /// The path segment every page in a language sits under.
    /// </summary>
    /// <param name="language">The language.</param>
    /// <returns>The prefix, with its leading slash.</returns>
    private static string Prefix(Language language) =>
        // The language's code, as the web's locales spell it
        $"/{language.ToString().ToLowerInvariant()}";

    /// <summary>
    /// Reads the path of an address.
    /// </summary>
    /// <param name="address">The address.</param>
    /// <returns>Its path, unescaped.</returns>
    private static string PathOf(string address) =>
        // The path the site routes on
        Uri.UnescapeDataString(new Uri(address).AbsolutePath);

    /// <summary>
    /// Reads the query of an address.
    /// </summary>
    /// <param name="address">The address.</param>
    /// <returns>Each parameter's name and value, in order.</returns>
    private static List<(string Name, string Value)> QueryOf(string address) =>
        // Each name and value pair of the query
        [
            .. new Uri(address).Query.TrimStart('?')
                .Split('&')
                .Select(parameter => parameter.Split('=', 2))
                .Select(parts => (Uri.UnescapeDataString(parts[0]), Uri.UnescapeDataString(parts[1]))),
        ];
}
