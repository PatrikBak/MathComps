using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// EF Core-backed implementation of <see cref="IHostedGroupService"/>. Everything a manifest changes lands in
/// one save at the end, so it is carried out whole or not at all.
/// </summary>
/// <param name="dbContextFactory">Creates the context the declaration runs on.</param>
public sealed class HostedGroupService(IDbContextFactory<MathCompsDbContext> dbContextFactory)
    : IHostedGroupService
{
    /// <inheritdoc/>
    public async Task<HostedGroupDeclarationOutcome> DeclareAsync(
        HostedGroupManifest manifest, bool dryRun = false, CancellationToken cancellationToken = default)
    {
        // Everything the document alone can be wrong about, before the database is opened at all.
        EnsureManifestComplete(manifest);

        // The instants as UTC from here on. An author writes them in their own offset, and the column stores an
        // instant rather than the offset it was written in.
        manifest = manifest with
        {
            OpensAt = manifest.OpensAt.ToUniversalTime(),
            ClosesAt = manifest.ClosesAt?.ToUniversalTime(),
        };

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // The rounds the manifest names, and how many problems each of them holds.
        var rounds = new List<Round>();
        var problemCounts = new List<int>();

        // Each named round again, this time against what has actually landed.
        foreach (var reference in manifest.Rounds)
        {
            // The round under that node in that season. One whose draft has not landed yet stops the
            // declaration: the group would otherwise stand with a category missing and nothing would say so.
            var round = await dbContext.Rounds
                .Include(candidate => candidate.Competition)
                .Where(candidate => candidate.Competition.Path == reference.CompetitionPath
                    && candidate.Season.StartYear == reference.SeasonYear)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new HostedGroupManifestException(
                    $"No round for '{reference.CompetitionPath}' in {reference.SeasonYear}. Apply its draft first.");

            // A round's embargo is what actually keeps its problems back, so a manifest disagreeing with it
            // would promise a closing date the problems don't keep. A group that never closes promises no date at
            // all, and its rounds are free to carry any embargo, including one that never lifts.
            if (manifest.ClosesAt is not null && round.VisibleSince != manifest.ClosesAt)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' opens at {Describe(round.VisibleSince)}, but the group closes "
                    + $"at {Describe(manifest.ClosesAt)}. Fix the draft's visibleSince.");

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
            // serve a blank statement and the examiner would refuse the conversation, both mid-competition.
            if (incomplete.Count > 0)
                throw new HostedGroupManifestException(
                    $"'{reference.CompetitionPath}' problem(s) {string.Join(", ", incomplete)} lack a statement "
                    + "or a solution in one of the site's languages.");

            // The round stands, so keep it and what it holds.
            rounds.Add(round);
            problemCounts.Add(written.Count);
        }

        // The rounds are one competition run at several levels, so a student picking a harder one must not be
        // picking a longer paper as well.
        if (problemCounts.Distinct().Count() > 1)
            throw new HostedGroupManifestException(
                $"The rounds hold different numbers of problems ({string.Join(", ", problemCounts)}).");

        // Counts that agree can agree on zero, so a group whose rounds hold nothing at all gets this far.
        if (problemCounts[0] == 0)
            throw new HostedGroupManifestException("The rounds hold no problems. Apply their drafts first.");

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

        // Re-running the same manifest stays free. Moving the window, the clock or the re-entry rule under a
        // student already sitting it does not: a shortened clock expires one already running, a moved window
        // shuts a competition somebody is in, and withdrawing re-entry strands whoever holds a second entry.
        if (entered.Count > 0
            && (group!.OpensAt != manifest.OpensAt
                || group.ClosesAt != manifest.ClosesAt
                || group.ClockMinutes != manifest.ClockMinutes
                || group.AllowsReentry != manifest.AllowsReentry))
        {
            throw new HostedGroupManifestException(
                $"'{manifest.Slug}' has been entered, so its window, clock and re-entry rule can no longer be "
                + "changed.");
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
            };
            dbContext.HostedGroups.Add(group);
        }

        // Already there, so the manifest brings it into line: it owns every field outright.
        else
        {
            // The window, the clock and the re-entry rule, as the manifest now has them.
            group.OpensAt = manifest.OpensAt;
            group.ClockMinutes = manifest.ClockMinutes;
            group.ClosesAt = manifest.ClosesAt;
            group.AllowsReentry = manifest.AllowsReentry;
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
            await dbContext.SaveChangesAsync(cancellationToken);

        // What it did, or would have done.
        return new HostedGroupDeclarationOutcome(group.Id, created, rounds.Count, problemCounts[0]);
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
