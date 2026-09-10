using MathComps.Infrastructure.Services.Competitions;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Tests <see cref="HostedEntryRules.EnsureEntitled"/> as the pure rule it is: which readers reach a round's
/// problems, read off the round's embargo, the competition's window, and whatever the reader spent into it.
/// </summary>
/// <remarks>
/// Where that entry comes from is a query each consumer writes for itself, covered against a real database
/// where it is written: <see cref="HostedCompetitionServicePostgresTests"/> for the area serving a
/// competition's problems, and <see cref="Defense.DefenseTargetGuardPostgresTests"/> for the conversation
/// opened about one.
/// </remarks>
public class HostedEntryRulesEntitlementTests
{
    /// <summary>
    /// The instant every case below is read against.
    /// </summary>
    private static readonly DateTimeOffset _now = new(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// An embargo that has not lifted.
    /// </summary>
    private static readonly DateTimeOffset _embargoed = _now.AddDays(30);

    /// <summary>
    /// An embargo already behind us.
    /// </summary>
    private static readonly DateTimeOffset _lifted = _now.AddDays(-1);

    /// <summary>
    /// When a competition still taking entries closes.
    /// </summary>
    private static readonly DateTimeOffset _closesLater = _now.AddDays(60);

    /// <summary>
    /// An ordinary student, held to every gate a competition is entered through.
    /// </summary>
    private static readonly HostedReader _student = new(Guid.CreateVersion7(), BypassesGates: false);

    /// <summary>
    /// A reader with no account at all.
    /// </summary>
    private static readonly HostedReader _visitor = new(UserId: null, BypassesGates: false);

    /// <summary>
    /// A student the site lets past a competition's gates.
    /// </summary>
    private static readonly HostedReader _timingGranted = new(Guid.CreateVersion7(), BypassesGates: true);

    /// <summary>
    /// An embargoed set stays out of reach of a student who spent nothing on it, which is the whole point
    /// of an embargo.
    /// </summary>
    [Fact]
    public void An_embargoed_round_is_refused_without_an_entry() =>
        // Nothing spent, nothing to read
        AssertRefused(_student, new RoundAccess(_embargoed, _closesLater, HoldsEntry: false));

    /// <summary>
    /// An entry is what opens a round still under embargo.
    /// </summary>
    [Fact]
    public void An_entry_opens_an_embargoed_round() =>
        // An entry, which is what opens an embargoed round to a student
        HostedEntryRules.EnsureEntitled(
            _student, new RoundAccess(_embargoed, _closesLater, HoldsEntry: true), _now);

    /// <summary>
    /// Once the instant has passed nothing is held back from an account, so no entry is asked of one.
    /// </summary>
    [Fact]
    public void A_lifted_embargo_asks_an_account_for_nothing() =>
        // Out of embargo, and the competition still running
        HostedEntryRules.EnsureEntitled(
            _student, new RoundAccess(_lifted, _closesLater, HoldsEntry: false), _now);

    /// <summary>
    /// A round with no instant on it was never embargoed, which is separate from one whose instant has been and
    /// gone: the date is absent rather than in the past.
    /// </summary>
    [Fact]
    public void A_round_that_was_never_embargoed_asks_an_account_for_nothing() =>
        // Nothing to compare against, so nothing is held back
        HostedEntryRules.EnsureEntitled(
            _student, new RoundAccess(VisibleSince: null, _closesLater, HoldsEntry: false), _now);

    /// <summary>
    /// A lifted embargo opens a round to every account, and a reader with none needs the competition to be over
    /// as well: its problems are there to be competed for while it runs, and competing takes an account.
    /// </summary>
    [Fact]
    public void A_visitor_is_refused_a_competition_still_running() =>
        // Nothing embargoed about it, and still nobody's to read without an account
        AssertRefused(_visitor, new RoundAccess(_lifted, _closesLater, HoldsEntry: false));

    /// <summary>
    /// A reader with no account is let through once the competition has closed, there being nothing left to
    /// spend an entry on, which is what opens a competition's problems to a reader with no account.
    /// </summary>
    [Fact]
    public void A_visitor_reads_a_competition_that_has_closed() =>
        // Out of embargo and out of time, which is the pair that opens it to anybody
        HostedEntryRules.EnsureEntitled(
            _visitor, new RoundAccess(_lifted, _now.AddDays(-1), HoldsEntry: false), _now);

    /// <summary>
    /// A competition that never closes never opens to a reader with no account, whatever its embargo says. That
    /// is the practice group: no embargo on its rounds, and no closing instant to make them public.
    /// </summary>
    [Fact]
    public void A_visitor_is_refused_a_competition_that_never_closes() =>
        // No window to outlast, and reading it takes an account they do not have
        AssertRefused(_visitor, new RoundAccess(VisibleSince: null, ClosesAt: null, HoldsEntry: false));

    /// <summary>
    /// An embargo refuses a reader with no account outright. They cannot hold an entry, so the embargo is the
    /// end of it rather than something an entry could answer.
    /// </summary>
    [Fact]
    public void A_visitor_is_refused_an_embargoed_round() =>
        // Embargoed, and nothing they could have spent on it
        AssertRefused(_visitor, new RoundAccess(_embargoed, _closesLater, HoldsEntry: false));

    /// <summary>
    /// The grant is what the whole feature turns on: a granted student reaches an embargoed round holding no
    /// entry.
    /// </summary>
    [Fact]
    public void A_granted_student_reads_an_embargoed_round_without_an_entry() =>
        // The case the grant exists for
        HostedEntryRules.EnsureEntitled(
            _timingGranted, new RoundAccess(_embargoed, _closesLater, HoldsEntry: false), _now);

    /// <summary>
    /// The grant is read before anything about the round is, so it holds whatever the embargo, the window and
    /// the entry say.
    /// </summary>
    /// <param name="isEmbargoed">Whether the round's embargo still stands.</param>
    /// <param name="hasClosed">Whether the competition it runs in is over.</param>
    /// <param name="holdsEntry">Whether the student spent an entry into it.</param>
    [Theory]
    // Every combination of what the round says about itself.
    [InlineData(true, true, true)]
    [InlineData(true, true, false)]
    [InlineData(true, false, true)]
    [InlineData(true, false, false)]
    [InlineData(false, true, true)]
    [InlineData(false, true, false)]
    [InlineData(false, false, true)]
    [InlineData(false, false, false)]
    public void A_granted_student_is_refused_nothing(bool isEmbargoed, bool hasClosed, bool holdsEntry) =>
        // Whatever the round says, the grant was read first
        HostedEntryRules.EnsureEntitled(
            _timingGranted,
            new RoundAccess(
                isEmbargoed ? _embargoed : _lifted,
                hasClosed ? _now.AddDays(-1) : _closesLater,
                holdsEntry),
            _now);

    /// <summary>
    /// A competition is over on the closing instant itself, which is what opens it to a reader with no account.
    /// The board reads its own phases off the same comparison, so a rule that held the competition open one tick
    /// longer would draw a closed card over an address the API still refuses.
    /// </summary>
    [Fact]
    public void A_competition_closes_on_the_instant()
    {
        // A visitor at a competition closing one second from now, which is still running
        AssertRefused(_visitor, new RoundAccess(_lifted, _now.AddSeconds(1), HoldsEntry: false));

        // And the same competition read at the instant it closes
        HostedEntryRules.EnsureEntitled(
            _visitor, new RoundAccess(_lifted, _now, HoldsEntry: false), _now);
    }

    /// <summary>
    /// An embargo lifting exactly on the instant read against opens the round rather than holding it one tick
    /// longer, which is the boundary the archive and this rule have to agree on.
    /// </summary>
    [Fact]
    public void An_embargo_lifts_on_the_instant()
    {
        // A round opening one second from now, to a student holding nothing
        AssertRefused(_student, new RoundAccess(_now.AddSeconds(1), _closesLater, HoldsEntry: false));

        // And the same round read at the instant it opens
        HostedEntryRules.EnsureEntitled(
            _student, new RoundAccess(_now, _closesLater, HoldsEntry: false), _now);
    }

    /// <summary>
    /// Asserts the rule turns one reader away from one round.
    /// </summary>
    /// <param name="reader">The reader asking.</param>
    /// <param name="access">What the round says about being reached.</param>
    private static void AssertRefused(HostedReader reader, RoundAccess access) =>
        Assert.Throws<HostedEntryRequiredException>(
            () => HostedEntryRules.EnsureEntitled(reader, access, _now));
}
