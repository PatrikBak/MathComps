using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// EF Core-backed implementation of <see cref="IHostedGroupService"/>. The declaration runs inside one
/// transaction, so it is carried out whole or not at all even where raising a competition node has to flush a
/// generation before it can descend into the next.
/// </summary>
/// <param name="dbContextFactory">Creates the context the declaration runs on.</param>
/// <param name="tree">Raises the competition node and the season a manifest's round hangs off.</param>
/// <param name="metadata">
/// The registry: whether the taxonomy can place a path, and what names a node is addressed by.
/// </param>
public sealed class HostedGroupService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    ICompetitionTreeWriter tree,
    IMetadataLocalizationService metadata)
    : IHostedGroupService
{
    /// <inheritdoc/>
    public async Task<HostedGroupDeclarationOutcome> DeclareAsync(
        HostedGroupManifest manifest, bool dryRun = false, CancellationToken cancellationToken = default)
    {
        // Everything the document alone can be wrong about, before the database is opened at all.
        EnsureManifestComplete(manifest);

        // The calendar day the group opens on, read in the offset its author wrote rather than in UTC. A window
        // opening at local midnight sits on the previous day in UTC, so taking it off the normalised instant
        // below would date every round this raises a day before the competition it runs.
        var opensOn = DateOnly.FromDateTime(manifest.OpensAt.DateTime);

        // The instants as UTC from here on. An author writes them in their own offset, and the column stores an
        // instant rather than the offset it was written in.
        manifest = manifest with
        {
            OpensAt = manifest.OpensAt.ToUniversalTime(),
            ClosesAt = manifest.ClosesAt?.ToUniversalTime(),
        };

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Raising a node saves each generation before descending into the next, so the refusals below would
        // otherwise fire over rows already written. Nothing is committed until the very end, and a dry run never
        // commits at all.
        await using var transaction = await dbContext.Database.BeginTransactionAsync(cancellationToken);

        // The rounds the manifest names, and how many of them are still to be filled.
        var rounds = new List<Round>();
        var roundsAwaitingProblems = 0;

        // Each named round again, this time against what has actually landed.
        foreach (var reference in manifest.Rounds)
        {
            // Whether the taxonomy can place the path at all: it may be unregistered, half-named, or a container
            // carrying the competitions a round should hang off instead. Asked before the node is raised, since
            // the resolver's own complaint arrives as a fault nobody can act on. The registry answers for every
            // step of the path, so a gap carries the node it sits on and the clause saying which of the three.
            var unregistered = metadata.ValidateTaxonomyRegistration(reference.CompetitionPath);
            if (unregistered.Count > 0)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' cannot carry a round: "
                    + string.Join("; ", unregistered.Select(issue => $"'{issue.Path}' has {issue.Gaps}"))
                    + ".");

            // The node the round hangs off, raised when the database has not met it yet.
            var (competition, _, _) = await tree.ResolveNodeAsync(dbContext, reference.CompetitionPath);

            // The season the round sits in, raised the same way a draft raises one.
            var (season, _) = await tree.GetOrCreateSeasonAsync(dbContext, reference.SeasonYear);

            // The round itself, which a draft may have raised already.
            var round = await dbContext.Rounds
                .Include(candidate => candidate.Competition)
                .FirstOrDefaultAsync(
                    candidate => candidate.CompetitionId == competition.Id && candidate.SeasonId == season.Id,
                    cancellationToken);

            // Nothing there yet, so the manifest puts it there: a competition goes on the site the day its dates
            // are decided, and the problems land on it later. Its own dates are filled in below, which is where a
            // round the manifest raised on an earlier run has them refreshed too.
            if (round is null)
            {
                round = new Round
                {
                    CompetitionId = competition.Id,
                    SeasonId = season.Id,
                    Competition = competition,
                    Date = opensOn,
                };
                dbContext.Rounds.Add(round);
            }

            // What each of the round's problems is written in. Only the kinds a competition needs: the site
            // serves the statement and the examiner reasons from the solution.
            var written = await dbContext.Problems
                .Where(problem => problem.RoundId == round.Id)
                .Select(problem => new
                {
                    problem.Number,
                    Written = problem.Texts.Count(text =>
                        text.DocumentType == DocumentType.Statement
                        || text.DocumentType == DocumentType.Solution),
                })
                .ToListAsync(cancellationToken);

            // A problem is one statement and one solution per language, and a problem text is unique in its
            // problem, kind and language together, so anything short of that number is a gap rather than a repeat.
            var expected = Enum.GetValues<Language>().Length * 2;

            // The numbers of the round's problems missing a statement or a solution in some language.
            var incomplete = written
                .Where(problem => problem.Written < expected)
                .Select(problem => problem.Number)
                .ToList();

            // Nothing downstream has a fallback for a language a problem was never written in: the site would
            // serve a blank statement and the examiner would refuse the conversation, both mid-competition. An
            // empty round has no problem to be missing one, so it passes here on its own.
            if (incomplete.Count > 0)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' problem(s) {string.Join(", ", incomplete)} lack a statement "
                    + "or a solution in one of the site's languages.");

            // A round holding nothing has no draft behind it yet, so its dates are still this declaration's own to
            // write: it put the round there, and nothing has been published off it that moving them could take
            // back. The embargo below would otherwise disagree with every corrected manifest, freezing a group's
            // window the moment it was announced.
            if (written.Count == 0)
            {
                round.Date = opensOn;
                round.VisibleSince = manifest.ClosesAt ?? DateTimeOffset.MaxValue;
            }

            // Once problems land the draft owns the embargo, and it is what actually keeps them back, so a
            // manifest disagreeing with it would promise a closing date the problems don't keep. A group that
            // never closes promises no date at all, and its rounds may carry any embargo, one that never lifts
            // included.
            else if (manifest.ClosesAt is not null && round.VisibleSince != manifest.ClosesAt)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' opens at {Describe(round.VisibleSince)}, but the group closes "
                    + $"at {Describe(manifest.ClosesAt)}. Fix the draft's visibleSince.");

            // A round is either still waiting on its problems or holding exactly the number the group announces.
            // Anything between is a draft that landed short, and the card would go on promising the full paper.
            if (written.Count != 0 && written.Count != manifest.ProblemCount)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' holds {written.Count} problem(s), but the group announces "
                    + $"{manifest.ProblemCount}.");

            // The round stands, so keep it.
            rounds.Add(round);

            // One still waiting on its problems, which the outcome counts.
            if (written.Count == 0)
                roundsAwaitingProblems += 1;
        }

        // A hosted round is reached by name, so the taxonomy has to give its node one in every language the
        // site is read in. Missing, the competitions list throws for every visitor rather than for this author,
        // so the declaration is where it is caught.
        foreach (var reference in manifest.Rounds)
        {
            // The languages that give the node no URL name.
            var unnamed = metadata.LocalesMissingUrlSlug(reference.CompetitionPath);

            // A language short of one is a group nobody can declare.
            if (unnamed.Count > 0)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' has no urlSlug in {string.Join(", ", unnamed)}. "
                    + "Add one to each metadata file.");
        }

        // The group as it already stands, if this manifest has been applied before.
        var group = await dbContext.HostedGroups
            .FirstOrDefaultAsync(candidate => candidate.Slug == manifest.Slug, cancellationToken);

        // Whether this declaration is the one creating it.
        var created = group is null;

        // The group's key, or null when nothing stands under the slug yet.
        var groupId = group?.Id;

        // What the group already owes its students, read before anything moves. An entry was spent on the terms
        // and the rounds that stood when it was spent, so both stop being the manifest's to change freely.
        var entered = groupId is null
            // A group nobody has declared yet owes nothing.
            ? []
            // Every round an entry has been spent into, one row each.
            : await dbContext.HostedEntries
                .Where(entry => entry.Round.HostedGroupId == groupId)
                .Select(entry => new { entry.RoundId, entry.Round.Competition.Path })
                .Distinct()
                .ToListAsync(cancellationToken);

        // Re-running the same manifest stays free. Moving the window, the clock, the re-entry rule or the size
        // under a student already sitting it does not: a shortened clock expires one already running, a moved
        // window shuts a competition somebody is in, withdrawing re-entry strands whoever holds a second entry,
        // and a resized paper is not the one they entered.
        if (entered.Count > 0
            && (group!.OpensAt != manifest.OpensAt
                || group.ClosesAt != manifest.ClosesAt
                || group.ClockMinutes != manifest.ClockMinutes
                || group.AllowsReentry != manifest.AllowsReentry
                || group.ProblemCount != manifest.ProblemCount))
        {
            throw new HostedGroupManifestException(
                $"'{manifest.Slug}' has been entered, so its window, clock, re-entry rule and size can no longer "
                + "be changed.");
        }

        // The manifest's rounds that some other group already runs, by their competition path.
        var claimed = rounds
            .Where(round => round.HostedGroupId is { } owner && owner != groupId)
            .Select(round => round.Competition.Path)
            .ToList();

        // A round belongs to one group. Nothing above notices that it already belongs to another, so without this
        // a second manifest naming the same round would move it, and every clock running against the group it left
        // would silently start being read off the group it landed in.
        if (claimed.Count > 0)
            throw new HostedGroupManifestException(
                $"{string.Join(", ", claimed)} already belong(s) to another group.");

        // The rounds students have entered that the manifest has dropped, by their competition path.
        var stranded = entered
            .Where(spent => rounds.TrueForAll(round => round.Id != spent.RoundId))
            .Select(spent => spent.Path)
            .ToList();

        // A round the manifest no longer names is released below, and a released round's problems are closed
        // to everybody. Dropping one somebody spent an entry into would take back what they bought.
        if (stranded.Count > 0)
            throw new HostedGroupManifestException(
                $"The manifest drops {string.Join(", ", stranded)}, which students have already entered.");

        // Nothing under the slug yet, so the manifest puts it there.
        if (group is null)
        {
            // The group on the terms the manifest names.
            group = new HostedGroup
            {
                Slug = manifest.Slug,
                OpensAt = manifest.OpensAt,
                ClockMinutes = manifest.ClockMinutes,
                ClosesAt = manifest.ClosesAt,
                AllowsReentry = manifest.AllowsReentry,
                ProblemCount = manifest.ProblemCount,
            };
            dbContext.HostedGroups.Add(group);
        }

        // Already there, so the manifest brings it into line: it owns every field outright.
        else
        {
            // The window, the clock, the re-entry rule and the size, as the manifest now has them.
            group.OpensAt = manifest.OpensAt;
            group.ClockMinutes = manifest.ClockMinutes;
            group.ClosesAt = manifest.ClosesAt;
            group.AllowsReentry = manifest.AllowsReentry;
            group.ProblemCount = manifest.ProblemCount;
        }

        // Whatever the group runs today, which a corrected manifest may no longer name.
        var released = await dbContext.Rounds
            .Where(round => round.HostedGroupId == group.Id)
            .ToListAsync(cancellationToken);

        // A round the manifest has dropped is released rather than left claiming membership, so re-declaring a
        // corrected manifest is enough to fix a mistake.
        foreach (var round in released)
            round.HostedGroupId = null;

        // Set through the key rather than the navigation: a round the release above just cleared is the same
        // tracked row, and an explicitly nulled key wins over the fixup a navigation would rely on.
        foreach (var round in rounds)
            round.HostedGroupId = group.Id;

        // Every refusal above has fired by now, so a dry run already has its answer and leaves the database alone.
        if (!dryRun)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }

        // What it did, or would have done.
        return new HostedGroupDeclarationOutcome(
            group.Id, created, rounds.Count, manifest.ProblemCount, roundsAwaitingProblems);
    }

    /// <summary>
    /// Refuses a manifest that cannot be carried out whatever the database holds: a field the document left out,
    /// a window that closes before it opens, or a round naming a competition the site does not host.
    /// </summary>
    /// <remarks>
    /// A field the JSON never named arrives as a blank rather than as a complaint, so what a group cannot run
    /// without is checked by hand. Each of these would otherwise declare a group nobody could enter, or reach the
    /// database as a null and come back as something an author cannot act on.
    /// </remarks>
    /// <param name="manifest">The manifest to check.</param>
    /// <exception cref="HostedGroupManifestException">The document is wrong on its own terms.</exception>
    private static void EnsureManifestComplete(HostedGroupManifest manifest)
    {
        // The scalars a group cannot run without.
        if (string.IsNullOrWhiteSpace(manifest.Slug))
            throw new HostedGroupManifestException("The manifest carries no slug.");
        if (manifest.OpensAt == default)
            throw new HostedGroupManifestException("The manifest carries no opensAt.");
        if (manifest.ClockMinutes <= 0)
            throw new HostedGroupManifestException("The manifest gives the group no clock.");
        if (manifest.ProblemCount <= 0)
            throw new HostedGroupManifestException("The manifest gives the group no problems.");

        // A window that shuts at or before it opens, so the group is never open at all.
        if (manifest.ClosesAt is { } closesAt && closesAt <= manifest.OpensAt)
            throw new HostedGroupManifestException("The manifest closes the group before it opens.");

        // A group with no rounds runs nothing, which is a manifest somebody meant to finish.
        if (manifest.Rounds is null || manifest.Rounds.Count == 0)
            throw new HostedGroupManifestException("The manifest names no rounds.");

        // Each named round in turn: a path is the author's to fix without the database having a say in it.
        foreach (var reference in manifest.Rounds)
        {
            // A reference naming nothing addresses no round, and the walk in the declaration would read the
            // null as a path.
            if (string.IsNullOrWhiteSpace(reference.CompetitionPath))
                throw new HostedGroupManifestException("A round carries no competitionPath.");

            // Outside the hosted root, so the group would be claiming rounds of somebody else's competition.
            if (!TaxonomySlugs.IsAtOrUnder(reference.CompetitionPath, HostedTaxonomy.RootSlug))
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' is not under '{HostedTaxonomy.RootSlug}'.");

            // A blank year, which the declaration would otherwise raise as a season and lose to the sanity check
            // on the column, in a fault naming a constraint rather than the field the author left out.
            if (reference.SeasonYear <= 0)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' carries no seasonYear.");
        }
    }

    /// <summary>
    /// Says an instant the way a message can carry it, including the case of there not being one.
    /// </summary>
    /// <param name="instant">The instant, or null when there is none.</param>
    /// <returns>The instant in round-trip form, or a word for its absence.</returns>
    private static string Describe(DateTimeOffset? instant) =>
        instant?.ToString("O") ?? "never";
}
