using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Mail;

namespace MathComps.Infrastructure.Services.GradeMessages;

/// <summary>
/// The mail telling somebody that new messages are waiting in their grade conversations: which conversations, how
/// many new messages each holds, a link into each, and, in a grader's mail, the student who wrote them. It never
/// quotes a message, since messages carry LaTeX that a mail would show raw.
/// </summary>
public static class GradeMessageMail
{
    /// <summary>
    /// Renders the mail in the site's <see cref="MailLayout"/>.
    /// </summary>
    /// <param name="siteUrl"><inheritdoc cref="Options.SiteSettings.Url" path="/summary"/></param>
    /// <param name="year"><inheritdoc cref="MailLayout.Render" path="/param[@name='year']"/></param>
    /// <param name="content">What the mail says.</param>
    /// <returns>The subject and the HTML document.</returns>
    public static RenderedMail Render(string siteUrl, int year, GradeMessageMailContent content)
    {
        // The recipient's language
        var language = content.Language;

        // The mail's lines in the recipient's language
        var copy = new LocalizedCopy(language, "gradeMessageMail");

        // The subject line
        var subject = copy.Format("subject");

        // The opening line, by name where the recipient has one
        var greeting = content.RecipientName is { } name
            ? copy.Format("greeting", new { name })
            : copy.Format("greetingWithoutName");

        // The greeting and what the mail is about
        var lead = $"{greeting} {copy.Format("intro")}";

        // The conversations grouped by competition, level and school year, in the order each group first appears
        var competitions = content.Threads
            .GroupBy(thread => copy.Format("competition", new
            {
                competition = thread.CompetitionName,
                category = thread.CategoryName,
                season = SchoolYearName(thread.SeasonStartYear),
            }))
            .Select((competition, index) => RenderCompetition(copy, competition.Key, competition, isFirst: index == 0));

        // How to stop these mails
        var optOut = MailLayout.Encode(copy.Format("optOut"));

        // The body: the lead, the conversations, and how to stop these mails, every inserted text encoded
        var rows = $"""
            <tr>
            <td style="padding: 0 0 24px; font-size: 17px; line-height: 1.55;">{MailLayout.Encode(lead)}</td>
            </tr>
            <tr>
            <td style="padding: 0 0 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            {string.Concat(competitions)}</table>
            </td>
            </tr>
            <tr>
            <td style="padding: 0 0 24px; font-size: 13px; line-height: 1.6;">{optOut}</td>
            </tr>
            """;

        // The body in the site's frame, the lead standing in as the inbox's preview
        return MailLayout.Render(new SiteLinks(siteUrl, language), year, subject, preview: lead, rows);
    }

    /// <summary>
    /// Renders one competition's rows: its name, then a row per conversation in it.
    /// </summary>
    /// <param name="copy">The mail's lines in the recipient's language.</param>
    /// <param name="name">The heading naming the competition, its level and its school year.</param>
    /// <param name="threads">The competition's conversations, in the order given.</param>
    /// <param name="isFirst">Whether the competition opens the list, with none above to stand apart from.</param>
    /// <returns>The rows' HTML.</returns>
    private static string RenderCompetition(
        LocalizedCopy copy, string name, IEnumerable<GradeThreadNews> threads, bool isFirst)
    {
        // The room above the name, none at the top of the list
        var spaceAbove = isFirst ? 0 : 24;

        // The name as the document carries it
        var heading = MailLayout.Encode(name);

        // The name, then each conversation
        return $"""
            <tr>
            <td colspan="2"
            style="padding: {spaceAbove}px 0 6px; font-size: 15px; line-height: 1.5; font-weight: 700;">{heading}</td>
            </tr>
            {string.Concat(threads.Select(thread => RenderThread(copy, thread)))}
            """;
    }

    /// <summary>
    /// Renders one conversation's row: the problem, linking into the conversation, and how many new messages it
    /// holds, which a grader's mail puts after the name of the student who wrote them.
    /// </summary>
    /// <param name="copy">The mail's lines in the recipient's language.</param>
    /// <param name="thread">The conversation.</param>
    /// <returns>The row's HTML.</returns>
    private static string RenderThread(LocalizedCopy copy, GradeThreadNews thread)
    {
        // The problem the conversation is about
        var problem = copy.Format("problem", new { number = thread.ProblemNumber });

        // How many new messages
        var messages = copy.Format("messages", new { count = thread.MessageCount });

        // The count, which a grader's mail puts after the student's name
        var news = thread.Student is { } student
            // A grader's mail: the student who wrote the messages, a deleted account under the site's stand-in name
            ? copy.Format("messagesFrom", new
            {
                student = student.Username ?? copy.Format("unnamedStudent"),
                messages,
            })
            // The student's own mail: the count alone
            : messages;

        // The row, every inserted text encoded
        return $"""
            <tr>
            <td valign="top"
            style="padding: 6px 20px 6px 0; white-space: nowrap; font-size: 15px; line-height: 1.5; font-weight: 600;"><a
            href="{MailLayout.Encode(thread.Link)}"
            style="color: inherit; text-decoration: underline;">{MailLayout.Encode(problem)}</a></td>
            <td valign="top" width="100%"
            style="padding: 6px 0; font-size: 15px; line-height: 1.5;">{MailLayout.Encode(news)}</td>
            </tr>

            """;
    }

    /// <summary>
    /// Names a school year by the two calendar years it spans.
    /// </summary>
    /// <param name="startYear">The calendar year the school year starts in.</param>
    /// <returns>The school year's name, like 2026/27.</returns>
    private static string SchoolYearName(int startYear) =>
        // Both years, the second shortened to its last two digits
        $"{startYear}/{(startYear + 1) % 100:D2}";
}

/// <summary>
/// What a mail about new messages in grade conversations says.
/// </summary>
/// <param name="Language">The language the recipient is written to in.</param>
/// <param name="RecipientName">The recipient's <see cref="Domain.EfCoreEntities.User.Username"/>, or null while
/// they have yet to choose one.</param>
/// <param name="Threads">Each conversation holding something new, in the order the mail lists them.</param>
public sealed record GradeMessageMailContent(
    Language Language, string? RecipientName, IReadOnlyList<GradeThreadNews> Threads);

/// <summary>
/// What is new in one grade conversation.
/// </summary>
/// <param name="CompetitionName">The competition's short name.</param>
/// <param name="CategoryName">The name of the level the competition ran at.</param>
/// <param name="SeasonStartYear"><inheritdoc cref="Domain.EfCoreEntities.Season.StartYear" path="/summary"/></param>
/// <param name="ProblemNumber"><inheritdoc cref="Domain.EfCoreEntities.Problem.Number" path="/summary"/></param>
/// <param name="Student">The student who wrote the new messages, named in a grader's mail; null in the student's
/// own.</param>
/// <param name="MessageCount">How many new messages there are.</param>
/// <param name="Link">The address opening the conversation.</param>
public sealed record GradeThreadNews(
    string CompetitionName,
    string CategoryName,
    int SeasonStartYear,
    int ProblemNumber,
    GradeThreadStudent? Student,
    int MessageCount,
    string Link);

/// <summary>
/// The student a grader's mail names beside a conversation's news.
/// </summary>
/// <param name="Username">The student's <see cref="Domain.EfCoreEntities.User.Username"/>, or null for a deleted
/// account.</param>
public sealed record GradeThreadStudent(string? Username);
