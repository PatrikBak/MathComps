using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.GradeMessages;
using MathComps.Infrastructure.Services.Localization;

namespace MathComps.Infrastructure.Tests.GradeMessages;

/// <summary>
/// Unit tests for the grade-conversation mail as it is written: that nothing a user typed can write HTML into the
/// mail, and the whole mail as it looks.
/// </summary>
public class GradeMessageMailTests
{
    /// <summary>
    /// The address the links start with in these tests.
    /// </summary>
    private const string SiteUrl = "https://mathcomps.test/";

    /// <summary>
    /// The year every mail here goes out in.
    /// </summary>
    private const int Year = 2026;

    /// <summary>
    /// Nothing a user chose can write HTML into the mail: a username full of markup is shown as the text it is,
    /// encoded once wherever it stands, and the link keeps its query intact.
    /// </summary>
    [Fact]
    public void A_username_cannot_write_html_into_the_mail()
    {
        // A mail greeting, and naming as the student, somebody whose username is markup
        var mail = GradeMessageMail.Render(
            SiteUrl,
            Year,
            new GradeMessageMailContent(Language.EN, "<b>x</b>",
            [
                new GradeThreadNews(
                    CompetitionName: "September",
                    CategoryName: "Advanced",
                    SeasonStartYear: 2026,
                    ProblemNumber: 3,
                    Student: new GradeThreadStudent("<b>x</b>"),
                    MessageCount: 1,
                    Link: "https://mathcomps.test/thread?a=1&b=2"),
            ]));

        // The markup shown as text, encoded no more than once
        Assert.DoesNotContain("<b>x</b>", mail.Html);
        Assert.Contains("&lt;b&gt;x&lt;/b&gt;", mail.Html);
        Assert.DoesNotContain("&amp;lt;", mail.Html);

        // The link's ampersands escaped
        Assert.Contains("?a=1&amp;b=2", mail.Html);
    }

    /// <summary>
    /// The shapes of mail a snapshot is kept of.
    /// </summary>
    public enum MailScenario
    {
        /// <summary>
        /// One conversation holding one new message.
        /// </summary>
        OneMessage,

        /// <summary>
        /// One conversation, to a recipient with no name.
        /// </summary>
        NoName,

        /// <summary>
        /// Conversations across three rounds, listed as their news came in, counts reaching every plural form:
        /// two rounds of this school year, and the first of them run the school year before too.
        /// </summary>
        ManyThreads,

        /// <summary>
        /// A grader's mail: three students' conversations, two of them about one problem, one student's account
        /// deleted.
        /// </summary>
        ToGrader,
    }

    /// <summary>
    /// Every scenario in every language.
    /// </summary>
    public static TheoryData<MailScenario, Language> Scenarios
    {
        get
        {
            // The rows, filled below
            var scenarios = new TheoryData<MailScenario, Language>();

            // Each scenario paired with each language
            foreach (var scenario in Enum.GetValues<MailScenario>())
                foreach (var language in Enum.GetValues<Language>())
                    scenarios.Add(scenario, language);

            // Every pair
            return scenarios;
        }
    }

    /// <summary>
    /// The mail as it renders, one snapshot per scenario and language. The snapshots in Snapshots/ open in a
    /// browser, and a change to the mail shows up as their diff.
    /// </summary>
    /// <param name="scenario">The shape of the mail.</param>
    /// <param name="language">The language the mail is written in.</param>
    /// <returns>The comparison with the committed snapshot.</returns>
    [Theory]
    [MemberData(nameof(Scenarios))]
    public Task The_mail_as_it_renders(MailScenario scenario, Language language)
    {
        // The mail the scenario describes
        var mail = GradeMessageMail.Render(SiteUrl, Year, ScenarioContent(scenario, language));

        // The document against its snapshot
        return Verify(mail.Html, "html").UseDirectory("Snapshots").UseParameters(scenario, language);
    }

    /// <summary>
    /// Builds what a mail of one scenario says, each conversation linking where the mail would link it.
    /// </summary>
    /// <param name="scenario">The shape of the mail.</param>
    /// <param name="language">The language the mail is written in.</param>
    /// <returns>The mail's content.</returns>
    private static GradeMessageMailContent ScenarioContent(MailScenario scenario, Language language)
    {
        // What addresses each round's page in the language, the September one run the school year before included
        var (septemberSlug, octoberSlug, lastSeptemberSlug) = language switch
        {
            Language.SK => ("pokrocila-september-2026", "stredna-oktober-2026", "pokrocila-september-2025"),
            Language.CS => ("pokrocila-zari-2026", "stredni-rijen-2026", "pokrocila-zari-2025"),
            Language.EN => ("advanced-september-2026", "intermediate-october-2026", "advanced-september-2025"),
            _ => throw new ArgumentOutOfRangeException(nameof(language), language, "Unknown language")
        };

        // The site's addresses in the language
        var links = new SiteLinks(SiteUrl, language);

        // The student's way into a conversation about one problem of a round, each problem with an id of its own
        string SeptemberLink(int number) => links.StudentThread(septemberSlug, Problem(round: 1, number));
        string OctoberLink(int number) => links.StudentThread(octoberSlug, Problem(round: 2, number));
        string LastSeptemberLink(int number) => links.StudentThread(lastSeptemberSlug, Problem(round: 3, number));

        // A grader's way into one student's conversation about one problem of the September round
        string BoardLink(int student, int number) => links.GraderThread(
            "mathilding-2026-1", HostedCompetitionCategory.Advanced, Student(student), Problem(round: 1, number));

        // Two rounds and two levels as the competitions' pages name them in the language
        var (september, october, advanced, intermediate) = language switch
        {
            Language.SK => ("September", "Október", "Pokročilá", "Stredná"),
            Language.CS => ("Září", "Říjen", "Pokročilá", "Střední"),
            Language.EN => ("September", "October", "Advanced", "Intermediate"),
            _ => throw new ArgumentOutOfRangeException(nameof(language), language, "Unknown language")
        };

        // The scenario's recipient and conversations
        return scenario switch
        {
            MailScenario.OneMessage => new(language, "Pavel",
            [
                new GradeThreadNews(september, advanced, 2026, 3, null, 1, SeptemberLink(3)),
            ]),
            MailScenario.NoName => new(language, null,
            [
                new GradeThreadNews(september, advanced, 2026, 3, null, 2, SeptemberLink(3)),
            ]),
            MailScenario.ManyThreads => new(language, "Pavel",
            [
                new GradeThreadNews(september, advanced, 2026, 1, null, 1, SeptemberLink(1)),
                new GradeThreadNews(october, intermediate, 2026, 1, null, 12, OctoberLink(1)),
                new GradeThreadNews(september, advanced, 2026, 2, null, 3, SeptemberLink(2)),
                new GradeThreadNews(october, intermediate, 2026, 3, null, 21, OctoberLink(3)),
                new GradeThreadNews(september, advanced, 2025, 2, null, 1, LastSeptemberLink(2)),
                new GradeThreadNews(september, advanced, 2026, 4, null, 4, SeptemberLink(4)),
                new GradeThreadNews(october, intermediate, 2026, 6, null, 2, OctoberLink(6)),
            ]),
            MailScenario.ToGrader => new(language, "Patrik",
            [
                new GradeThreadNews(september, advanced, 2026, 3, new GradeThreadStudent("Jana"), 2, BoardLink(1, 3)),
                new GradeThreadNews(september, advanced, 2026, 3, new GradeThreadStudent("Marek"), 1, BoardLink(2, 3)),
                new GradeThreadNews(september, advanced, 2026, 5, new GradeThreadStudent(null), 4, BoardLink(3, 5)),
            ]),
            _ => throw new ArgumentOutOfRangeException(nameof(scenario), scenario, "Unknown scenario")
        };
    }

    /// <summary>
    /// Names one problem of the scenarios' rounds, the same one in every language.
    /// </summary>
    /// <param name="round">Which of the scenarios' rounds, as a single digit.</param>
    /// <param name="number">The problem's number within its round.</param>
    /// <returns>The problem's id.</returns>
    private static Guid Problem(int round, int number) =>
        // The round and the number spelled into the id
        Guid.Parse($"01994f6e-0000-7000-800{round}-{number:D12}");

    /// <summary>
    /// Names one student of the scenarios.
    /// </summary>
    /// <param name="number">Which student.</param>
    /// <returns>The student's id.</returns>
    private static Guid Student(int number) =>
        // The number spelled into the id
        Guid.Parse($"01994f6e-0000-7000-9000-{number:D12}");
}
