using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="ProposalConversations"/>, which lets through only a conversation the reviewers held about a
/// proposal the selection still holds, and a note on one.
/// </summary>
/// <remarks>
/// The seed holds one conversation per case, each with a note on it, keyed by the case's name.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ProposalConversationsPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IProposalConversations>(fixture)
{
    /// <summary>
    /// The case of the reviewer's conversation about a proposal in the pool.
    /// </summary>
    private const string Pool = "pool";

    /// <summary>
    /// The case of the reviewer's conversation about a proposal taken by a group that has not opened.
    /// </summary>
    private const string UnopenedGroup = "unopened group";

    /// <summary>
    /// The case of the reviewer's conversation about an archive problem.
    /// </summary>
    private const string Archive = "archive";

    /// <summary>
    /// The case of the reviewer's conversation about a handout problem.
    /// </summary>
    private const string Handout = "handout";

    /// <summary>
    /// The case of the reviewer's conversation about a proposal taken by a group that has opened.
    /// </summary>
    private const string OpenedGroup = "opened group";

    /// <summary>
    /// The case of the reviewer's conversation about a deleted proposal.
    /// </summary>
    private const string DeletedProposal = "deleted proposal";

    /// <summary>
    /// The case of a student's conversation about a proposal in the pool, held while the problem sat somewhere
    /// students reach.
    /// </summary>
    private const string Student = "student";

    /// <summary>
    /// The case of the latecomer's conversation about a proposal in the pool, held before their address was on the
    /// MathComps organization's list.
    /// </summary>
    private const string BeforeMembership = "before membership";

    /// <summary>
    /// A reviewer, on the MathComps organization's list since well before any conversation.
    /// </summary>
    private readonly Guid _reviewerId = Guid.CreateVersion7();

    /// <summary>
    /// A reviewer on the MathComps organization's list only since after their conversation.
    /// </summary>
    private readonly Guid _latecomerId = Guid.CreateVersion7();

    /// <summary>
    /// A student, whose address was never on the MathComps organization's list.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// Each case's conversation, by the case's name.
    /// </summary>
    private readonly Dictionary<string, Guid> _conversations = [];

    /// <summary>
    /// The note on each case's conversation, by the case's name.
    /// </summary>
    private readonly Dictionary<string, Guid> _notes = [];

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services) =>
        // The service under test, with the rest of the selection.
        services.AddProblemSelectionServices();

    /// <summary>
    /// A reviewer's conversation about a proposal the selection holds is reached, and so is a note on it.
    /// </summary>
    /// <param name="conversation">The case.</param>
    [Theory]
    [InlineData(Pool)]
    [InlineData(UnopenedGroup)]
    public Task A_reviewers_conversation_about_a_proposal_is_reached(string conversation) =>
        RunTestAsync(async service =>
        {
            // The conversation and the note on it, checked
            var refusal = await Record.ExceptionAsync(async () =>
            {
                // The conversation
                await service.EnsureConversationAsync(_conversations[conversation]);

                // The note on it
                await service.EnsureNoteAsync(_notes[conversation]);
            });

            // Neither refused
            Assert.Null(refusal);
        });

    /// <summary>
    /// Every other conversation, and any note on it, is refused like a missing conversation: one about an archive
    /// problem or a handout problem, one about a proposal taken by a group that has opened or about a deleted one, a
    /// student's about a proposal in the pool, and a reviewer's held before their address was on the MathComps
    /// organization's list.
    /// </summary>
    /// <param name="conversation">The case.</param>
    [Theory]
    [InlineData(Archive)]
    [InlineData(Handout)]
    [InlineData(OpenedGroup)]
    [InlineData(DeletedProposal)]
    [InlineData(Student)]
    [InlineData(BeforeMembership)]
    public Task Any_other_conversation_is_refused(string conversation) => RunTestAsync(async service =>
    {
        // The conversation, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.EnsureConversationAsync(_conversations[conversation]));

        // And the note on it
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.EnsureNoteAsync(_notes[conversation]));
    });

    /// <summary>
    /// An id naming no conversation is refused like one outside the selection, and one naming no note as a note
    /// that is gone.
    /// </summary>
    [Fact]
    public Task An_id_naming_nothing_is_refused() => RunTestAsync(async service =>
    {
        // No conversation, refused
        await Assert.ThrowsAsync<SelectionTargetNotFoundException>(
            () => service.EnsureConversationAsync(Guid.CreateVersion7()));

        // And no note
        await Assert.ThrowsAsync<ReviewNoteNotFoundException>(
            () => service.EnsureNoteAsync(Guid.CreateVersion7()));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The instant every conversation and membership is dated from
        var now = DateTimeOffset.UtcNow;

        // The reviewer, the latecomer and the student
        context.Users.AddRange(
            HostedSeed.NewUser(_reviewerId, "Reviewer"),
            HostedSeed.NewUser(_latecomerId, "Latecomer"),
            HostedSeed.NewUser(_studentId, "Student"));

        // The reviewer on the MathComps organization's list for a month
        SelectionSeed.NewMember(context, "reviewer@example.com", now.AddDays(-30));

        // The latecomer on the MathComps organization's list only since yesterday
        SelectionSeed.NewMember(context, "latecomer@example.com", now.AddDays(-1));

        // The season every round sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool
        var pool = SelectionSeed.NewProposalsRound(context, season);

        // A proposal in the pool
        var pooled = SelectionSeed.NewProposal(context, pool, 1, 1);

        // A deleted one
        var deleted = SelectionSeed.NewProposal(context, pool, 2, 2);
        context.Proposals.Local.Single(proposal => proposal.ProblemId == deleted).DeletedAt = now;

        // A group that opens next week
        var october = SelectionSeed.NewGroup(context, season, "october", now.AddDays(7));

        // A proposal in October's first round
        var unopened = SelectionSeed.NewProposal(context, october.Rounds.First(), 100, 1);

        // A group that opened yesterday
        var september = SelectionSeed.NewGroup(context, season, "september", now.AddDays(-1));

        // A proposal in September's first round
        var opened = SelectionSeed.NewProposal(context, september.Rounds.First(), 200, 1);

        // A round of the archive
        var archiveRound = new Round
        {
            Id = Guid.CreateVersion7(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "imo").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 7, 15),
        };
        context.Rounds.Add(archiveRound);

        // A problem in the archive round, which no proposal files
        var archiveProblemId = Guid.CreateVersion7();
        context.Problems.Add(
            new Problem { Id = archiveProblemId, RoundId = archiveRound.Id, Number = 1, Slug = "imo-1" });

        // The conversations about problems, each by whoever the case names
        SeedConversation(context, Pool, _reviewerId, pooled, now.AddDays(-2));
        SeedConversation(context, UnopenedGroup, _reviewerId, unopened, now.AddDays(-2));
        SeedConversation(context, Archive, _reviewerId, archiveProblemId, now.AddDays(-2));
        SeedConversation(context, OpenedGroup, _reviewerId, opened, now.AddDays(-2));
        SeedConversation(context, DeletedProposal, _reviewerId, deleted, now.AddDays(-2));
        SeedConversation(context, Student, _studentId, pooled, now.AddDays(-2));
        SeedConversation(context, BeforeMembership, _latecomerId, pooled, now.AddDays(-2));

        // A handout problem
        var handout = new Handout { Id = Guid.CreateVersion7(), ContentId = "handout-one" };
        var environment = new HandoutEnvironment
        {
            Id = Guid.CreateVersion7(),
            HandoutId = handout.Id,
            ContentId = "problem-one",
        };
        context.Handouts.Add(handout);
        context.HandoutEnvironments.Add(environment);

        // And the reviewer's conversation about it
        var handoutSessionId = Guid.CreateVersion7();
        context.DefenseSessions.Add(new DefenseSession
        {
            Id = handoutSessionId,
            UserId = _reviewerId,
            TargetKind = DefenseTargetKind.Handout,
            ProblemStatement = "Statement",
            ProblemReference = "Reference",
            ExaminerConfig = "{}",
            CreatedAt = now.AddDays(-2),
        });

        // What it is about
        context.HandoutEnvironmentDefenses.Add(new HandoutEnvironmentDefense
        {
            DefenseSessionId = handoutSessionId,
            HandoutEnvironmentId = environment.Id,
        });

        // Kept by the case's name
        _conversations[Handout] = handoutSessionId;

        // A note on every conversation, by the reviewer
        foreach (var (name, sessionId) in _conversations)
        {
            // The note
            var note = new AdminNote
            {
                AuthorId = _reviewerId,
                SessionId = sessionId,
                TurnId = null,
                Content = "A note",
                Category = null,
                ResolvedAt = null,
                CreatedAt = now,
                UpdatedAt = now,
            };
            context.AdminNotes.Add(note);

            // Kept by the case's name
            _notes[name] = note.Id;
        }

        // Written
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks one case's conversation about a problem, kept by the case's name.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="name">The case.</param>
    /// <param name="userId">Who held the conversation.</param>
    /// <param name="problemId">The problem the conversation is about.</param>
    /// <param name="createdAt">When the conversation started.</param>
    private void SeedConversation(
        MathCompsDbContext context, string name, Guid userId, Guid problemId, DateTimeOffset createdAt)
    {
        // The conversation
        var sessionId = Guid.CreateVersion7();
        HostedSeed.NewConversation(context, sessionId, userId, problemId, createdAt);

        // Kept by the case's name
        _conversations[name] = sessionId;
    }
}
