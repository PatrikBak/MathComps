using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;

namespace MathComps.Infrastructure.Tests.ConversationReview;

/// <summary>
/// The defense conversations the review suites start from: two students' handout conversations, one against an
/// archive problem and one against nothing at all, the drafts behind a reply, a report and a verdict, along with the
/// builders a suite adds more conversations with.
/// </summary>
public static class ConversationReviewSeed
{
    /// <summary>
    /// The student who holds most of the seeded conversations.
    /// </summary>
    public static readonly Guid StudentId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// A second student, so filtering by who held a conversation has something to leave out.
    /// </summary>
    public static readonly Guid OtherStudentId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// The reviewer reading the queue.
    /// </summary>
    public static readonly Guid ReviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f1");

    /// <summary>
    /// A second reviewer, so one reading a conversation has somebody else's queue to leave alone.
    /// </summary>
    public static readonly Guid OtherReviewerId = Guid.Parse("00000000-0000-0000-0000-0000000000f2");

    /// <summary>
    /// The settings the competition conversation ran on, shared with nothing else so that the grouping by
    /// version still has exactly one pair to find.
    /// </summary>
    private const string ArchiveExaminerConfig =
        /*lang=json,strict*/ """{"generate":{"model":"gemini-3.6-flash","promptText":"be strict"}}""";

    /// <summary>
    /// The archive problem one of the conversations was held against.
    /// </summary>
    private static readonly Guid _archiveProblemId = Guid.Parse("00000000-0000-0000-0000-0000000000d1");

    /// <summary>
    /// The conversation held against that problem.
    /// </summary>
    public static readonly Guid ArchiveSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a5");

    /// <summary>
    /// The slug addressing the archive problem, which is what the queue is narrowed to it by.
    /// </summary>
    public const string ArchiveProblemSlug = "76-mathcomps-advanced-september-2";

    /// <summary>
    /// The node the archive problem's competition sits at. Registered in the taxonomy, since naming the
    /// competition is the whole of what this arm adds.
    /// </summary>
    private const string ArchiveCompetitionPath = "mathcomps-advanced-september";

    /// <summary>
    /// The handout environment two of the conversations were held against.
    /// </summary>
    private static readonly Guid _sharedEnvironmentId = Guid.Parse("00000000-0000-0000-0000-0000000000e1");

    /// <summary>
    /// A second handout environment, so the queue names more than one across its conversations.
    /// </summary>
    private static readonly Guid _otherEnvironmentId = Guid.Parse("00000000-0000-0000-0000-0000000000e2");

    /// <summary>
    /// The oldest conversation against the shared environment.
    /// </summary>
    public static readonly Guid OldestSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    /// <summary>
    /// The newer conversation against the shared environment, held by the other student.
    /// </summary>
    public static readonly Guid NewerSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a2");

    /// <summary>
    /// The only conversation against the second environment, and the most recently active of them all. Opened long
    /// before every other one and carried on yesterday, so where it lands says which end of its turns the queue reads.
    /// </summary>
    public static readonly Guid NewestSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a3");

    /// <summary>
    /// A conversation held against nothing at all, which every read is meant to leave out.
    /// </summary>
    public static readonly Guid TargetlessSessionId = Guid.Parse("00000000-0000-0000-0000-0000000000a4");

    /// <summary>
    /// The turn the oldest conversation opens on, which belongs to no other conversation.
    /// </summary>
    public static readonly Guid OldestOpenerId = Guid.Parse("00000000-0000-0000-0000-0000000000b1");

    /// <summary>
    /// The turn the newest conversation opens on, which nothing in it precedes.
    /// </summary>
    public static readonly Guid NewestOpenerId = Guid.Parse("00000000-0000-0000-0000-0000000000b2");

    /// <summary>
    /// The reply the newest conversation ends on, which a note and the student's report are written against.
    /// </summary>
    public static readonly Guid NewestReplyId = Guid.Parse("00000000-0000-0000-0000-0000000000b3");

    /// <summary>
    /// The handout every seeded environment belongs to.
    /// </summary>
    public const string HandoutContentId = "handout-one";

    /// <summary>
    /// Examiner settings holding a model, so a conversation's snapshot has something to read back off it.
    /// </summary>
    public const string ExaminerConfig =
        /*lang=json,strict*/ """{"generate":{"model":"gemini-3.6-flash","promptText":"be fair"}}""";

    /// <summary>
    /// The same settings written differently, which the database reads as the same json and so the same version.
    /// </summary>
    private const string EquivalentExaminerConfig =
        /*lang=json,strict*/ """{ "generate" : { "promptText" : "be fair", "model" : "gemini-3.6-flash" } }""";

    /// <summary>
    /// How long every seeded model call took.
    /// </summary>
    public const int CallDurationMs = 900;

    /// <summary>
    /// When the seed was written, which every seeded time is measured back from.
    /// </summary>
    public static readonly DateTimeOffset Now = DateTimeOffset.UtcNow;

    /// <summary>
    /// How long each of the seeded drafts took, in the order they were drafted. Distinct per draft, so a projection
    /// that carried one draft's time onto the rest would show.
    /// </summary>
    public static readonly int[] AttemptDurationsMs = [2_400, 1_600];

    /// <summary>
    /// Writes the seed into a database.
    /// </summary>
    /// <param name="context">The context the seed is written through.</param>
    /// <returns>A task representing the write.</returns>
    public static async Task SeedAsync(MathCompsDbContext context)
    {
        // Two students, so the queue has more than one person's conversations in it, and two reviewers, so their
        // read marks have each other to stay out of.
        context.Users.AddRange(
            new User { Id = StudentId, ExternalId = "ext-student", Username = "Student" },
            new User { Id = OtherStudentId, ExternalId = "ext-other", Username = "Other" },
            new User { Id = ReviewerId, ExternalId = "ext-reviewer", Username = "Reviewer" },
            new User { Id = OtherReviewerId, ExternalId = "ext-reviewer-2", Username = "Second reviewer" });

        // One handout holding both environments.
        var handoutId = Guid.CreateVersion7();
        context.Handouts.Add(new Handout { Id = handoutId, ContentId = HandoutContentId });

        // The two environments the conversations were held against.
        context.HandoutEnvironments.AddRange(
            new HandoutEnvironment { Id = _sharedEnvironmentId, HandoutId = handoutId, ContentId = "problem-one" },
            new HandoutEnvironment { Id = _otherEnvironmentId, HandoutId = handoutId, ContentId = "problem-two" });

        // The competition the archive problem was set in, and the season it ran in.
        var competitionId = Guid.CreateVersion7();
        var seasonId = Guid.CreateVersion7();
        var roundId = Guid.CreateVersion7();
        context.Competitions.Add(new Competition
        {
            Id = competitionId,
            Slug = "1",
            Path = ArchiveCompetitionPath,
            SortPath = ArchiveCompetitionPath,
            SortOrder = 1,
        });
        context.Seasons.Add(new Season { Id = seasonId, StartYear = 2026, EditionNumber = 76 });
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = competitionId,
            SeasonId = seasonId,
            Date = new DateOnly(2026, 9, 28),
        });

        // And the problem itself, which the queue names by where it comes from rather than by an id.
        context.Problems.Add(new Problem
        {
            Id = _archiveProblemId,
            RoundId = roundId,
            Number = 2,
            Slug = ArchiveProblemSlug,
        });

        // Five conversations: two against the shared environment, one against the other, one against an
        // archive problem, and one against nothing.
        // The one held by the other student runs on the same settings written differently, so the version grouping has
        // something to prove; the targetless one runs on the settings two others share, so leaving it out of the
        // grouping is a fact of its own rather than a side effect of it standing alone.
        context.DefenseSessions.AddRange(
            NewSession(OldestSessionId, StudentId, ExaminerConfig, DefenseTargetKind.Handout),
            NewSession(NewerSessionId, OtherStudentId, EquivalentExaminerConfig, DefenseTargetKind.Handout),
            NewSession(NewestSessionId, StudentId, examinerConfig: "{}", DefenseTargetKind.Handout),
            NewSession(ArchiveSessionId, StudentId, ArchiveExaminerConfig, DefenseTargetKind.Problem),
            NewSession(TargetlessSessionId, StudentId, ExaminerConfig, DefenseTargetKind.Handout));

        // Their turns, staggered so the queue has a clear order to put them in. The newest conversation opened
        // twenty days ago and was carried on yesterday, so when it last moved and when it opened disagree and only
        // one of the two puts it at the head of the queue.
        context.DefenseTurns.AddRange(
            NewTurn(OldestSessionId, TranscriptRole.Examiner, "the opener", 0, Now.AddDays(-10), OldestOpenerId),
            NewTurn(OldestSessionId, TranscriptRole.Candidate, "my oldest defense", 1, Now.AddDays(-10)),
            NewTurn(NewerSessionId, TranscriptRole.Examiner, "the opener", 0, Now.AddDays(-5)),
            NewTurn(NewerSessionId, TranscriptRole.Candidate, "my newer defense", 1, Now.AddDays(-5)),
            NewTurn(NewestSessionId, TranscriptRole.Examiner, "the opener", 0, Now.AddDays(-20), NewestOpenerId),
            NewTurn(NewestSessionId, TranscriptRole.Candidate, "my newest defense", 1, Now.AddDays(-1)),
            NewTurn(NewestSessionId, TranscriptRole.Examiner, "her reply", 2, Now.AddDays(-1), NewestReplyId),
            NewTurn(ArchiveSessionId, TranscriptRole.Examiner, "the opener", 0, Now.AddDays(-3)),
            NewTurn(ArchiveSessionId, TranscriptRole.Candidate, "my competition defense", 1, Now.AddDays(-3)),
            NewTurn(TargetlessSessionId, TranscriptRole.Examiner, "the opener", 0, Now.AddDays(-2)),
            NewTurn(TargetlessSessionId, TranscriptRole.Candidate, "my untargeted defense", 1, Now.AddDays(-2)));

        // The drafts behind the newest conversation's last reply: one the leak-check sent back, and the one that
        // went out. They hang off that reply alone, so the conversations held before the drafts were kept have
        // somewhere to read back empty from. Written in the reverse of the order they were drafted, so a read that
        // takes the database's own order for the run's order has something to get wrong.
        context.DefenseTurnAttempts.AddRange(
            NewAttempt(NewestSessionId, NewestReplyId, attemptIndex: 1, "her reply", AttemptDurationsMs[1]),
            NewAttempt(NewestSessionId, NewestReplyId, attemptIndex: 0, "her leaky draft", AttemptDurationsMs[0],
                leaks: true));

        // Which handout problem each of those conversations was held against, the targetless one deliberately
        // naming nothing.
        context.HandoutEnvironmentDefenses.AddRange(
            NewTarget(OldestSessionId, _sharedEnvironmentId),
            NewTarget(NewerSessionId, _sharedEnvironmentId),
            NewTarget(NewestSessionId, _otherEnvironmentId));

        // And the archive problem the competition conversation was held against.
        context.ProblemDefenses.Add(new ProblemDefense
        {
            DefenseSessionId = ArchiveSessionId,
            ProblemId = _archiveProblemId,
        });

        // What the student made of the newest conversation's last reply, so one of them carries a complaint.
        context.DefenseTurnReports.Add(new DefenseTurnReport
        {
            SessionId = NewestSessionId,
            TurnId = NewestReplyId,
            Categories = [DefenseReportCategory.GaveAway],
            Comment = "she just told me",
            CreatedAt = Now,
            UpdatedAt = Now,
        });

        // And their verdict on a different one, so the complaint and the verdict never sit on the same conversation.
        context.DefenseSessionFeedbacks.Add(new DefenseSessionFeedback
        {
            SessionId = OldestSessionId,
            Outcome = DefenseOutcome.FoundTheMistake,
            Comment = null,
            CreatedAt = Now,
            UpdatedAt = Now,
        });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Builds one seeded conversation, held against a handout environment.
    /// </summary>
    /// <param name="sessionId">The conversation's identifier.</param>
    /// <param name="userId">Who held it.</param>
    /// <param name="examinerConfig">The settings it ran on.</param>
    /// <param name="targetKind">Which kind of problem it was held against.</param>
    /// <returns>The conversation, ready to add.</returns>
    public static DefenseSession NewSession(
        Guid sessionId, Guid userId, string examinerConfig, DefenseTargetKind targetKind) => new()
        {
            Id = sessionId,
            UserId = userId,
            TargetKind = targetKind,
            ProblemStatement = "a problem",
            ProblemReference = "a reference",
            ExaminerConfig = examinerConfig,
            CreatedAt = Now.AddDays(-30),
        };

    /// <summary>
    /// Builds one note about a conversation as a whole, stamped when the test says rather than now, so a set of them
    /// has an order that doesn't depend on how fast they were written.
    /// </summary>
    /// <param name="authorId">The reviewer who wrote it.</param>
    /// <param name="sessionId">The conversation it is about.</param>
    /// <param name="content">What it says.</param>
    /// <param name="writtenAt">When it was written.</param>
    /// <returns>The note, ready to add.</returns>
    public static AdminNote NewNote(
        Guid authorId, Guid sessionId, string content, DateTimeOffset writtenAt) => new()
        {
            AuthorId = authorId,
            SessionId = sessionId,
            TurnId = null,
            Content = content,
            Category = null,
            ResolvedAt = null,
            CreatedAt = writtenAt,
            UpdatedAt = writtenAt,
        };

    /// <summary>
    /// Builds one seeded turn.
    /// </summary>
    /// <param name="sessionId">The conversation the turn belongs to.</param>
    /// <param name="role">Who authored the turn.</param>
    /// <param name="content">The turn's text.</param>
    /// <param name="sequence">The turn's position in the conversation.</param>
    /// <param name="createdAt">When the turn was recorded.</param>
    /// <param name="turnId">The turn's identifier, minted when the test doesn't need to name it.</param>
    /// <returns>The turn, ready to add.</returns>
    public static DefenseTurn NewTurn(
        Guid sessionId, TranscriptRole role, string content, int sequence, DateTimeOffset createdAt,
        Guid? turnId = null) => new()
        {
            Id = turnId ?? Guid.CreateVersion7(),
            SessionId = sessionId,
            Role = role,
            Content = content,
            Sequence = sequence,
            CreatedAt = createdAt,
        };

    /// <summary>
    /// Builds one seeded draft, carrying the calls that wrote and judged it.
    /// </summary>
    /// <param name="sessionId">The conversation the draft was made in.</param>
    /// <param name="turnId">The reply it was drafted for.</param>
    /// <param name="attemptIndex">Its place in that reply's run.</param>
    /// <param name="reply">The drafted text.</param>
    /// <param name="durationMs">How long the draft took end to end.</param>
    /// <param name="mathHolds"><inheritdoc cref="DefenseTurnAttempt.MathHolds" path="/summary"/></param>
    /// <param name="leaks"><inheritdoc cref="DefenseTurnAttempt.Leaks" path="/summary"/></param>
    /// <param name="withholdsClose">Whether the draft asked on over a solution that was already complete.</param>
    /// <param name="switchesLanguage"><inheritdoc cref="DefenseTurnAttempt.SwitchesLanguage" path="/summary"/></param>
    /// <param name="gendersTheReader"><inheritdoc cref="DefenseTurnAttempt.GendersTheReader" path="/summary"/></param>
    /// <param name="takesOver"><inheritdoc cref="DefenseTurnAttempt.TakesOver" path="/summary"/></param>
    /// <param name="closesComplete">Whether the draft ended the examination on a solution that was already
    /// complete.</param>
    /// <returns>The draft, ready to add.</returns>
    public static DefenseTurnAttempt NewAttempt(
        Guid sessionId, Guid turnId, int attemptIndex, string reply, int durationMs = 0, bool mathHolds = true,
        bool leaks = false, bool withholdsClose = false, bool switchesLanguage = false, bool gendersTheReader = false,
        bool takesOver = false, bool closesComplete = false)
    {
        // The draft and every verdict passed on it, clean but for the flaws the test names.
        var attempt = new DefenseTurnAttempt
        {
            SessionId = sessionId,
            TurnId = turnId,
            AttemptIndex = attemptIndex,
            Reply = reply,
            RevisionNote = attemptIndex == 0 ? "" : "REVISION REQUIRED — you gave away the counterexample.",
            MathHolds = mathHolds,
            MathCorrection = mathHolds ? "" : "the sum is even",
            MathCloses = closesComplete,
            MathComplete = withholdsClose || closesComplete,
            MathOwed = "",
            Leaks = leaks,
            WhatLeaked = leaks ? "the counterexample" : "",
            Established = withholdsClose ? "the whole proof" : "",
            SwitchesLanguage = switchesLanguage,
            CandidateLanguage = "English",
            GendersTheReader = gendersTheReader,
            TakesOver = takesOver,
            CandidateWork = "",
            RestatedReferenceStep = takesOver ? "the reference's second step" : "",
            IsSafeFallback = false,
            CreatedAt = Now,
            DurationMs = durationMs,
        };

        // The calls behind it, keyed off the draft's own client-side id.
        attempt.Calls = [NewCall(attempt.Id, ExaminerStep.Generate), NewCall(attempt.Id, ExaminerStep.LeakCheck)];

        // Hand it back with them attached.
        return attempt;
    }

    /// <summary>
    /// Builds the link saying which handout environment a seeded conversation was held against.
    /// </summary>
    /// <param name="sessionId">The conversation.</param>
    /// <param name="handoutEnvironmentId">The handout environment it was held against.</param>
    /// <returns>The link, ready to add.</returns>
    private static HandoutEnvironmentDefense NewTarget(Guid sessionId, Guid handoutEnvironmentId) => new()
    {
        DefenseSessionId = sessionId,
        HandoutEnvironmentId = handoutEnvironmentId,
    };

    /// <summary>
    /// Builds one seeded model call.
    /// </summary>
    /// <param name="attemptId">The draft that made it.</param>
    /// <param name="step">The step it ran.</param>
    /// <returns>The call, ready to hang off a draft.</returns>
    private static DefenseAttemptCall NewCall(Guid attemptId, ExaminerStep step) => new()
    {
        AttemptId = attemptId,
        Step = step,
        Model = "fake/model",
        ReasoningEffort = "low",
        Cost = 0.01m,
        PromptTokens = 100,
        CompletionTokens = 20,
        ReasoningTokens = 5,
        CachedPromptTokens = 0,
        DurationMs = CallDurationMs,
    };
}
