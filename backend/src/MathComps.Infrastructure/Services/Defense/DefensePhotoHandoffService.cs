using System.Security.Cryptography;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Implements <see cref="IDefensePhotoHandoffService"/> over the database, reading each photo through
/// <see cref="IDefensePhotoService"/> as the code's student. A code is <see cref="DefensePhotoHandoff.CodeLength"/>
/// random hex digits, and the row it finds holds the problem, so nothing a phone sends can point it anywhere.
/// </summary>
/// <param name="targetGuard">Says whether a student may argue what the target names.</param>
/// <param name="photoService">Reads and keeps a photo for a student's defense.</param>
/// <param name="photoFiles">The links to the kept photos.</param>
/// <param name="localization">The resolver of localized display names.</param>
/// <param name="dbContextFactory">The factory minting each operation's database context.</param>
/// <param name="defensePhotoHandoffSettings">How long a code works.</param>
public class DefensePhotoHandoffService(
    IDefenseTargetGuard targetGuard,
    IDefensePhotoService photoService,
    IDefensePhotoFiles photoFiles,
    IMetadataLocalizationService localization,
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IOptions<DefensePhotoHandoffSettings> defensePhotoHandoffSettings)
    : IDefensePhotoHandoffService
{
    /// <inheritdoc/>
    public async Task<DefensePhotoHandoffCodeDto> PointAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default)
    {
        // Refuse a request naming nothing to defend.
        DefenseInputs.EnsureTargetPresent(target);

        // Refuse a target the student may not argue, before anything points at it.
        await targetGuard.EnsureCanDefendAsync(userId, target, cancellationToken);

        // The operation's database context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The arm the target is held by: a handout environment's anchor row, or the problem's own id.
        var (handoutEnvironmentId, problemId) = target switch
        {
            // A handout environment, its anchor minted the first time anything hangs off it.
            HandoutEnvironmentTarget handout => (
                (Guid?)await DefenseTargets.UpsertHandoutEnvironmentAsync(dbContext, handout, cancellationToken),
                (Guid?)null),

            // A problem is already a row of the archive.
            ProblemTarget problem => (null, problem.ProblemId),

            // A target nothing here knows, which is a bug rather than a bad request.
            _ => throw new ArgumentOutOfRangeException(nameof(target), target, "Unknown defense target."),
        };

        // The instant the student's code is weighed against.
        var now = DateTimeOffset.UtcNow;

        // A new code and its end time, for a student whose code has run out or who has none.
        var freshCode = RandomNumberGenerator.GetHexString(DefensePhotoHandoff.CodeLength, lowercase: true);
        var freshExpiresAt = now + defensePhotoHandoffSettings.Value.CodeLifetime;

        // The student's handoff, made the first time they ask. A racing request may have just made it, so a conflict
        // leaves theirs alone.
        await dbContext.DefensePhotoHandoffs
            .Upsert(new DefensePhotoHandoff
            {
                UserId = userId,
                Code = freshCode,
                ExpiresAt = freshExpiresAt,
                HandoutEnvironmentId = handoutEnvironmentId,
                ProblemId = problemId,
            })
            .On(handoff => handoff.UserId)
            .NoUpdate()
            .RunAsync(cancellationToken);

        // Point the student's handoff at the target in one statement, every arm at once so it never holds more than
        // one, and give it a new code only where its own end time has passed. Two requests racing on a code that ran
        // out then renew it once, since the later one weighs the end time the earlier one wrote.
        await dbContext.DefensePhotoHandoffs
            .Where(handoff => handoff.UserId == userId)
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(handoff => handoff.HandoutEnvironmentId, handoutEnvironmentId)
                    .SetProperty(handoff => handoff.ProblemId, problemId)
                    .SetProperty(
                        handoff => handoff.Code,
                        handoff => handoff.ExpiresAt <= now ? freshCode : handoff.Code)
                    .SetProperty(
                        handoff => handoff.ExpiresAt,
                        handoff => handoff.ExpiresAt <= now ? freshExpiresAt : handoff.ExpiresAt),
                cancellationToken);

        // The code as it now stands
        return await dbContext.DefensePhotoHandoffs
            .AsNoTracking()
            .Where(handoff => handoff.UserId == userId)
            .Select(handoff => new DefensePhotoHandoffCodeDto(handoff.Code, handoff.ExpiresAt))
            .SingleAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<string?> FindStudentAsync(string code, CancellationToken cancellationToken = default)
    {
        // The operation's database context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The student of the handoff whose code still works, if any
        return await Live(dbContext, code)
            .Select(handoff => handoff.User.ExternalId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc/>
    public async Task<DefensePhotoHandoffTargetDto> CheckAsync(
        string code, Language language, CancellationToken cancellationToken = default)
    {
        // The operation's database context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The handoff the code finds, refused unless it still works.
        var handoff = await FindLiveAsync(dbContext, code, cancellationToken);

        // Where the handoff sends photos, named, and until when it works
        return new DefensePhotoHandoffTargetDto(
            await NameAsync(dbContext, handoff.Columns, language, cancellationToken), handoff.ExpiresAt);
    }

    /// <inheritdoc/>
    public async Task<DefensePhotoHandoffReadingDto> SendAsync(
        string code,
        DateTimeOffset capturedAt,
        Stream photo,
        Language language,
        CancellationToken cancellationToken = default)
    {
        // The operation's database context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The handoff the code finds, refused unless it still works. Its student and its problem as they stand now
        // are where the page goes, whatever happens to the handoff while the photo is read.
        var handoff = await FindLiveAsync(dbContext, code, cancellationToken);

        // The photo file, read whole only now that the code is known to work.
        using var file = new MemoryStream();
        await photo.CopyToAsync(file, cancellationToken);

        // Read the photo as the code's student, for the problem the handoff points at.
        var reading = await photoService.ReadAsync(
            handoff.UserId, handoff.Columns.Target, file.GetBuffer().AsMemory(0, (int)file.Length), cancellationToken);

        // Stage the page, waiting for a composer on the handoff's problem.
        dbContext.DefensePhotoHandoffPages.Add(new DefensePhotoHandoffPage
        {
            PhotoId = reading.PhotoId,
            HandoutEnvironmentId = handoff.HandoutEnvironmentId,
            ProblemId = handoff.Columns.ProblemId,
            CapturedAt = capturedAt.ToUniversalTime(),
        });

        // Save the page even once the phone has left, since the reading is paid for.
        await dbContext.SaveChangesAsync(CancellationToken.None);

        // The reading and the problem it went to, named
        return new DefensePhotoHandoffReadingDto(
            reading, await NameAsync(dbContext, handoff.Columns, language, cancellationToken));
    }

    /// <inheritdoc/>
    public async Task<DefensePhotoHandoffPagesDto> TakeAsync(
        Guid userId, DefenseTarget target, CancellationToken cancellationToken = default)
    {
        // Refuse a request naming nothing to defend.
        DefenseInputs.EnsureTargetPresent(target);

        // The operation's database context.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The instant the code is weighed against and the pages are taken at.
        var now = DateTimeOffset.UtcNow;

        // Whether the student's code still works.
        var hasLiveCode = await dbContext.DefensePhotoHandoffs
            .AnyAsync(handoff => handoff.UserId == userId && handoff.ExpiresAt > now, cancellationToken);

        // The student's pages sent to the target that no composer has taken yet.
        var waiting = dbContext.DefensePhotoHandoffPages
            .Where(DefenseTargets.PagesSentTo(target))
            .Where(page => page.Photo.UserId == userId && page.TakenAt == null);

        // None, which is what most asks find
        if (!await waiting.AnyAsync(cancellationToken))
            return new DefensePhotoHandoffPagesDto([], hasLiveCode);

        // One transaction for the lock, the read and the write, so the lock spans them.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // Lock the student's handoff, so two composers taking at once take one after the other, the second finding
        // the pages gone. Pages exist only once a handoff does, and nothing drops one.
        await dbContext.Database.ExecuteSqlAsync(
            $"SELECT 1 FROM defense_photo_handoffs WHERE user_id = {userId} FOR UPDATE", cancellationToken);

        // The pages still waiting now that nobody else can take them, in the order the phone captured them, and
        // pages captured at one instant in the order their readings were kept.
        var pages = await waiting
            .OrderBy(page => page.CapturedAt)
            .ThenBy(page => page.PhotoId)
            .Select(page => new { page.PhotoId, page.Photo.Text, page.CapturedAt })
            .ToListAsync(cancellationToken);

        // The pages read, which are the ones marked taken, so a page sent meanwhile waits for the next ask.
        List<Guid> photoIds = [.. pages.Select(page => page.PhotoId)];

        // Mark the read pages taken.
        await dbContext.DefensePhotoHandoffPages
            .Where(page => photoIds.Contains(page.PhotoId))
            .ExecuteUpdateAsync(setters => setters.SetProperty(page => page.TakenAt, now), cancellationToken);

        // Commit, releasing the student's handoff to the next take.
        await transaction.CommitAsync(cancellationToken);

        // The pages, each with its text and a link to its photo. Every photo a phone sends is read with its text kept.
        return new DefensePhotoHandoffPagesDto(
            [.. pages.Select(page => new DefensePhotoHandoffPageDto(
                page.PhotoId, page.Text!, page.CapturedAt, photoFiles.PhotoLinkFor(page.PhotoId)))],
            hasLiveCode);
    }

    /// <summary>
    /// Finds the handoff a code belongs to, as long as it still works.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="code">The code, as the phone holds it.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The handoff's student, end time and problem.</returns>
    /// <exception cref="DefensePhotoHandoffNotFoundException">Thrown when no handoff has the code, or its code has run
    /// out.</exception>
    private static async Task<LiveHandoff> FindLiveAsync(
        MathCompsDbContext dbContext, string code, CancellationToken cancellationToken) =>
        // The handoff with the code that still works, with what names its problem
        await Live(dbContext, code)
            .Select(handoff => new LiveHandoff(
                handoff.UserId,
                handoff.ExpiresAt,
                handoff.HandoutEnvironmentId,
                new NamedDefenseTargets.Columns(
                    handoff.HandoutEnvironment!.Handout.ContentId,
                    handoff.HandoutEnvironment!.ContentId,
                    handoff.ProblemId,
                    handoff.Problem!.Slug,
                    handoff.Problem!.Number,
                    handoff.Problem!.Round.Competition.Path,
                    handoff.Problem!.Round.Season.EditionNumber,
                    handoff.Problem!.Round.Season.StartYear)))
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new DefensePhotoHandoffNotFoundException();

    /// <summary>
    /// The handoff a code finds, as long as the code still works.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="code">The code, as the phone holds it.</param>
    /// <returns>The query finding the handoff, empty when no handoff has the code or its code has run out.</returns>
    private static IQueryable<DefensePhotoHandoff> Live(MathCompsDbContext dbContext, string code)
    {
        // The instant the code is weighed against.
        var now = DateTimeOffset.UtcNow;

        // The handoff with the code, as long as its end time is still ahead
        return dbContext.DefensePhotoHandoffs
            .AsNoTracking()
            .Where(handoff => handoff.Code == code && handoff.ExpiresAt > now);
    }

    /// <summary>
    /// Names the problem a handoff sends photos to.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="columns"><inheritdoc cref="NamedDefenseTargets.Columns" path="/summary"/></param>
    /// <param name="language">The language to name it in.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The problem, named.</returns>
    private async Task<NamedDefenseTarget> NameAsync(
        MathCompsDbContext dbContext,
        NamedDefenseTargets.Columns columns,
        Language language,
        CancellationToken cancellationToken)
    {
        // The proposal the problem is, if the selection holds it.
        var proposals = await NamedDefenseTargets.LoadProposalsAsync(dbContext, [columns], cancellationToken);

        // The problem, named in the language asked for
        return NamedDefenseTargets.Build(localization, language, columns, proposals);
    }

    /// <summary>
    /// A handoff whose code still works, as a phone's request finds it.
    /// </summary>
    /// <param name="UserId">The student whose photos the code sends.</param>
    /// <param name="ExpiresAt"><inheritdoc cref="DefensePhotoHandoff.ExpiresAt" path="/summary"/></param>
    /// <param name="HandoutEnvironmentId"><inheritdoc cref="DefensePhotoHandoff.HandoutEnvironmentId" path="/summary"/>
    /// </param>
    /// <param name="Columns"><inheritdoc cref="NamedDefenseTargets.Columns" path="/summary"/></param>
    private sealed record LiveHandoff(
        Guid UserId, DateTimeOffset ExpiresAt, Guid? HandoutEnvironmentId, NamedDefenseTargets.Columns Columns);
}
