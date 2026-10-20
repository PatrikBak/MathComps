using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Tests.TestInfrastructure;

namespace MathComps.Infrastructure.Tests.ConversationReview;

/// <summary>
/// The conversations notes are written about: one shaped like a real conversation with a reply to write against, a
/// second whose reply a note about the first may not reach, one with nothing behind it, one against an archive
/// problem and one against a proposal.
/// </summary>
public static class ReviewNoteSeed
{
    /// <summary>
    /// The student holding the seeded conversations.
    /// </summary>
    private static readonly Guid _studentId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// The reviewer writing the notes.
    /// </summary>
    public static readonly Guid ReviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f1");

    /// <summary>
    /// A second reviewer, so a note can be reached for by somebody who didn't write it.
    /// </summary>
    public static readonly Guid OtherReviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f2");

    /// <summary>
    /// The conversation every note is written about.
    /// </summary>
    public static readonly Guid SessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    /// <summary>
    /// A second conversation, so a note can be pointed at a reply from the wrong one.
    /// </summary>
    private static readonly Guid _otherSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a2");

    /// <summary>
    /// A conversation held against nothing at all, which nothing can open.
    /// </summary>
    public static readonly Guid UntargetedSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a3");

    /// <summary>
    /// A conversation held against an archive problem, which the feed names from the taxonomy rather than from
    /// handout content.
    /// </summary>
    public static readonly Guid ArchiveSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a4");

    /// <summary>
    /// A conversation held against a proposal, which the feed names by the proposal rather than by a competition.
    /// </summary>
    public static readonly Guid ProposalSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a5");

    /// <summary>
    /// The archive problem that conversation was held against.
    /// </summary>
    private static readonly Guid _archiveProblemId = Guid.Parse("00000000-0000-0000-0000-0000000000d1");

    /// <summary>
    /// How the archive addresses that problem.
    /// </summary>
    public const string ArchiveProblemSlug = "76-mathcomps-advanced-september-2";

    /// <summary>
    /// The competition it was set in, which has to be one the taxonomy knows for its names to resolve.
    /// </summary>
    private const string ArchiveCompetitionPath = "mathcomps-advanced-september";

    /// <summary>
    /// The reply the notes are written against.
    /// </summary>
    public static readonly Guid ReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b2");

    /// <summary>
    /// A reply from the other conversation, which a note about this one may not reach.
    /// </summary>
    public static readonly Guid OtherSessionReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b3");

    /// <summary>
    /// Where the reply sits, which a rewind cuts back past.
    /// </summary>
    public const int ReplySequence = 2;

    /// <summary>
    /// Writes the seed into a database.
    /// </summary>
    /// <param name="context">The context the seed is written through.</param>
    /// <returns>A task representing the write.</returns>
    public static async Task SeedAsync(MathCompsDbContext context)
    {
        // The student whose conversations are being reviewed, and the two reviewers reading them.
        context.Users.AddRange(
            new User { Id = _studentId, ExternalId = "ext-student", Username = "Student" },
            new User { Id = ReviewerId, ExternalId = "ext-reviewer", Username = "Reviewer" },
            new User { Id = OtherReviewerId, ExternalId = "ext-reviewer-2", Username = "Other reviewer" });

        // The handout and environment the conversations were held against, which the feed reads back.
        var handoutId = Guid.CreateVersion7();
        var environmentId = Guid.CreateVersion7();
        context.Handouts.Add(new Handout { Id = handoutId, ContentId = "handout-one" });
        context.HandoutEnvironments.Add(
            new HandoutEnvironment { Id = environmentId, HandoutId = handoutId, ContentId = "problem-one" });

        // The competition an archive problem was set in, and the season it ran in.
        var competitionId = Guid.CreateVersion7();
        var season = new Season { Id = Guid.CreateVersion7(), StartYear = 2026, EditionNumber = 76 };
        var roundId = Guid.CreateVersion7();
        context.Competitions.Add(new Competition
        {
            Id = competitionId,
            Slug = "1",
            Path = ArchiveCompetitionPath,
            SortPath = ArchiveCompetitionPath,
            SortOrder = 1,
        });
        context.Seasons.Add(season);
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = competitionId,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 9, 28),
        });

        // And the problem itself, which the feed names by where it comes from.
        context.Problems.Add(new Problem
        {
            Id = _archiveProblemId,
            RoundId = roundId,
            Number = 2,
            Slug = ArchiveProblemSlug,
        });

        // A problem parked among the proposals, quoted by a number its own row doesn't share.
        var proposedProblemId = SelectionSeed.NewProposal(
            context, SelectionSeed.NewProposalsRound(context, season), number: 21, position: 3);

        // The conversations, the first shaped like a real one: opener, the student, the reply.
        context.DefenseSessions.AddRange(
            NewSession(SessionId),
            NewSession(_otherSessionId),
            NewSession(UntargetedSessionId),
            NewSession(ArchiveSessionId, DefenseTargetKind.Problem),
            NewSession(ProposalSessionId, DefenseTargetKind.Problem));

        // The turns of the conversation under test.
        context.DefenseTurns.AddRange(
            NewTurn(Guid.CreateVersion7(), SessionId, TranscriptRole.Examiner, "the opener", 0),
            NewTurn(Guid.CreateVersion7(), SessionId, TranscriptRole.Candidate, "my defense", 1),
            NewTurn(ReplyId, SessionId, TranscriptRole.Examiner, "her reply", ReplySequence));

        // A lone reply in the other conversation, for the cross-conversation check.
        context.DefenseTurns.Add(
            NewTurn(OtherSessionReplyId, _otherSessionId, TranscriptRole.Examiner, "elsewhere", 0));

        // What the first two were held against, so the feed has an environment to name. The third is left standing
        // against nothing, which is the state the feed reads as unreachable.
        context.HandoutEnvironmentDefenses.AddRange(
            new HandoutEnvironmentDefense
            {
                DefenseSessionId = SessionId,
                HandoutEnvironmentId = environmentId,
            },
            new HandoutEnvironmentDefense
            {
                DefenseSessionId = _otherSessionId,
                HandoutEnvironmentId = environmentId,
            });

        // The problems the archive conversation and the proposal one were held against.
        context.ProblemDefenses.AddRange(
            new ProblemDefense { DefenseSessionId = ArchiveSessionId, ProblemId = _archiveProblemId },
            new ProblemDefense { DefenseSessionId = ProposalSessionId, ProblemId = proposedProblemId });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Builds one seeded conversation.
    /// </summary>
    /// <param name="sessionId">The conversation's identifier.</param>
    /// <param name="targetKind">Which kind of problem it was held against.</param>
    /// <returns>The conversation, ready to add.</returns>
    private static DefenseSession NewSession(
        Guid sessionId, DefenseTargetKind targetKind = DefenseTargetKind.Handout) => new()
        {
            Id = sessionId,
            UserId = _studentId,
            TargetKind = targetKind,
            ProblemStatement = "a problem",
            ProblemReference = "a reference",
            ExaminerConfig = "{}",
            CreatedAt = DateTimeOffset.UtcNow,
        };

    /// <summary>
    /// Builds one seeded turn.
    /// </summary>
    /// <param name="turnId">The turn's identifier.</param>
    /// <param name="sessionId">The conversation the turn belongs to.</param>
    /// <param name="role">Who authored the turn.</param>
    /// <param name="content">The turn's text.</param>
    /// <param name="sequence">The turn's position in the conversation.</param>
    /// <returns>The turn, ready to add.</returns>
    private static DefenseTurn NewTurn(
        Guid turnId, Guid sessionId, TranscriptRole role, string content, int sequence) => new()
        {
            Id = turnId,
            SessionId = sessionId,
            Role = role,
            Content = content,
            Sequence = sequence,
            CreatedAt = DateTimeOffset.UtcNow,
        };
}
