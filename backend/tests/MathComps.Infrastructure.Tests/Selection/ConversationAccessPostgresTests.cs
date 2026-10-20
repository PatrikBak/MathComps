using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Selection;

/// <summary>
/// Covers <see cref="ConversationAccess"/> on a conversation and on a note on it, by the rule
/// <see cref="IConversationAccess"/> states.
/// </summary>
/// <remarks>
/// The seed holds one conversation per case, each with a note on it, keyed by the case's name.
/// </remarks>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class ConversationAccessPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IConversationAccess>(fixture)
{
    /// <summary>
    /// The case of the reviewer's conversation about a proposal in MathComps' pool.
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
    /// The case of a former reviewer's conversation about a proposal in MathComps' pool, its author now on no
    /// organization's list.
    /// </summary>
    private const string FormerMember = "former member";

    /// <summary>
    /// The case of the commissioner's conversation about a proposal in the olympiad's pool.
    /// </summary>
    private const string Olympiad = "olympiad";

    /// <summary>
    /// The reviewer reading as a member of MathComps who is no admin.
    /// </summary>
    private const string ReviewerViewer = "reviewer";

    /// <summary>
    /// The reviewer reading as a member of MathComps who is an admin.
    /// </summary>
    private const string MemberAdminViewer = "member admin";

    /// <summary>
    /// An admin on no organization's list.
    /// </summary>
    private const string OutsideAdminViewer = "outside admin";

    /// <summary>
    /// The commissioner reading as a member of the olympiad who is no admin.
    /// </summary>
    private const string CommissionerViewer = "commissioner";

    /// <summary>
    /// A reviewer, on the MathComps organization's list.
    /// </summary>
    private readonly Guid _reviewerId = Guid.CreateVersion7();

    /// <summary>
    /// A former reviewer, now on no organization's list.
    /// </summary>
    private readonly Guid _formerMemberId = Guid.CreateVersion7();

    /// <summary>
    /// A member of the olympiad's commission, on its list alone.
    /// </summary>
    private readonly Guid _commissionerId = Guid.CreateVersion7();

    /// <summary>
    /// An admin whose address is on no organization's list.
    /// </summary>
    private readonly Guid _outsideAdminId = Guid.CreateVersion7();

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
    /// Each viewer reaches exactly the conversations open to them, and the notes on those. A member reaches the
    /// conversations about their organization's proposals the selection holds, whoever held them, and nothing about
    /// another organization's, and an admin on no organization's list nothing about any. A deleted proposal's
    /// conversations stay its organization's, reaching the admins among its members alone. An admin reaches every
    /// conversation about a problem no organization holds, and no member who is no admin does. Whatever is refused
    /// answers as though it were not there.
    /// </summary>
    /// <param name="viewer">Who reads.</param>
    /// <param name="conversation">The case.</param>
    /// <param name="reaches">Whether the viewer reaches it.</param>
    [Theory]
    [InlineData(ReviewerViewer, Pool, true)]
    [InlineData(ReviewerViewer, UnopenedGroup, true)]
    [InlineData(ReviewerViewer, Archive, false)]
    [InlineData(ReviewerViewer, Handout, false)]
    [InlineData(ReviewerViewer, OpenedGroup, false)]
    [InlineData(ReviewerViewer, DeletedProposal, false)]
    [InlineData(ReviewerViewer, FormerMember, true)]
    [InlineData(ReviewerViewer, Olympiad, false)]
    [InlineData(MemberAdminViewer, Pool, true)]
    [InlineData(MemberAdminViewer, Archive, true)]
    [InlineData(MemberAdminViewer, DeletedProposal, true)]
    [InlineData(MemberAdminViewer, Olympiad, false)]
    [InlineData(OutsideAdminViewer, Pool, false)]
    [InlineData(OutsideAdminViewer, UnopenedGroup, false)]
    [InlineData(OutsideAdminViewer, Olympiad, false)]
    [InlineData(OutsideAdminViewer, DeletedProposal, false)]
    [InlineData(OutsideAdminViewer, Archive, true)]
    [InlineData(OutsideAdminViewer, Handout, true)]
    [InlineData(OutsideAdminViewer, OpenedGroup, true)]
    [InlineData(CommissionerViewer, Olympiad, true)]
    [InlineData(CommissionerViewer, Pool, false)]
    public Task A_conversation_reaches_its_viewers_alone(string viewer, string conversation, bool reaches) =>
        RunTestAsync(async service =>
        {
            // The viewer, as the check is handed them
            var asked = ViewerOf(viewer);

            // The conversation, checked
            var conversationRefusal = await Record.ExceptionAsync(
                () => service.EnsureConversationAsync(_conversations[conversation], asked));

            // And the note on it, checked on its own
            var noteRefusal = await Record.ExceptionAsync(() => service.EnsureNoteAsync(_notes[conversation], asked));

            // Both reached
            if (reaches)
            {
                // The conversation
                Assert.Null(conversationRefusal);

                // And the note
                Assert.Null(noteRefusal);
            }

            // Or both refused as though they were not there
            else
            {
                // The conversation as a missing conversation
                Assert.IsType<DefenseSessionNotFoundException>(conversationRefusal);

                // And the note as a missing note, so the answer never tells that a note is there
                Assert.IsType<ReviewNoteNotFoundException>(noteRefusal);
            }
        });

    /// <summary>
    /// An id naming no conversation is refused to a viewer who is no admin as a conversation that is gone, and one
    /// naming no note as a note that is gone.
    /// </summary>
    [Fact]
    public Task An_id_naming_nothing_is_refused() => RunTestAsync(async service =>
    {
        // The reviewer, who is no admin
        var reviewer = ViewerOf(ReviewerViewer);

        // No conversation, refused
        await Assert.ThrowsAsync<DefenseSessionNotFoundException>(
            () => service.EnsureConversationAsync(Guid.CreateVersion7(), reviewer));

        // And no note
        await Assert.ThrowsAsync<ReviewNoteNotFoundException>(
            () => service.EnsureNoteAsync(Guid.CreateVersion7(), reviewer));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The instant every conversation and membership is dated from
        var now = DateTimeOffset.UtcNow;

        // The reviewer, the former reviewer, the commissioner and the admin on no list
        context.Users.AddRange(
            HostedSeed.NewUser(_reviewerId, "Reviewer"),
            HostedSeed.NewUser(_formerMemberId, "Former"),
            HostedSeed.NewUser(_commissionerId, "Commissioner"),
            HostedSeed.NewUser(_outsideAdminId, "Admin"));

        // The reviewer on the MathComps organization's list for a month
        SelectionSeed.NewMember(context, "reviewer@example.com", now.AddDays(-30));

        // The olympiad
        var olympiadId = SelectionSeed.NewOrganization(context, Olympiad);

        // The commissioner on the olympiad's list for a month
        SelectionSeed.NewMember(context, olympiadId, "commissioner@example.com", now.AddDays(-30));

        // The season every round sits in
        var season = SelectionSeed.NewSeason(context);

        // The pool
        var pool = SelectionSeed.NewProposalsRound(context, season);

        // A proposal in the pool
        var pooled = SelectionSeed.NewProposal(context, pool, 1, 1);

        // A deleted one
        var deleted = SelectionSeed.NewProposal(context, pool, 2, 2);
        context.Proposals.Local.Single(proposal => proposal.ProblemId == deleted).DeletedAt = now;

        // A proposal in the olympiad's pool, its number one MathComps' pool uses too
        var olympiadProposal = SelectionSeed.NewProposal(context, olympiadId, pool, 1, 3);

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
        SeedConversation(context, FormerMember, _formerMemberId, pooled, now.AddDays(-2));
        SeedConversation(context, Olympiad, _commissionerId, olympiadProposal, now.AddDays(-2));

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
    /// Builds a viewer the cases name.
    /// </summary>
    /// <param name="viewer">The viewer's name.</param>
    /// <returns>The viewer.</returns>
    private ConversationViewer ViewerOf(string viewer) => viewer switch
    {
        ReviewerViewer => new ConversationViewer(_reviewerId, IsAdmin: false),
        MemberAdminViewer => new ConversationViewer(_reviewerId, IsAdmin: true),
        OutsideAdminViewer => new ConversationViewer(_outsideAdminId, IsAdmin: true),
        CommissionerViewer => new ConversationViewer(_commissionerId, IsAdmin: false),
        _ => throw new ArgumentOutOfRangeException(nameof(viewer), viewer, "Unknown viewer."),
    };

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
