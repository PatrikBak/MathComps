using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using MathComps.Infrastructure.Services.Ai;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using System.Diagnostics;
using MathComps.Domain.Tagging;
using MathComps.Shared.Cli;
using MathComps.Shared.Serialization;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Tags a bulk-import draft in place: for each untagged problem it runs the model over the configured-language
/// statement (Area/Goal/Type) and solution (Technique), prunes the proposals with a second AI veto pass, and writes
/// the surviving slugs into the problem's <c>pN.yaml</c> sidecar. The draft — not the database — is the source of
/// truth, so <c>apply</c> later replays the same tags identically to every environment.
/// </summary>
/// <param name="taggingService">The database-free generate/veto core.</param>
/// <param name="settings">The four tagging passes and the fit floor.</param>
/// <param name="spendTracker">The round's spend tally for the cost report.</param>
[Description("""
    Tag a bulk-import draft folder in place. For every problem whose pN.yaml has no 'tags:' key, the model proposes
    tags from the approved vocabulary (statement → Area/Goal/Type, solution → Technique), a veto pass prunes them,
    and the survivors are written as a bare slug list into pN.yaml. Problems that already have a 'tags:' key are
    left untouched, so a re-run only fills in the gaps — pass --retag to redo every problem, overwriting its tags.
    Names the model proposes outside the vocabulary are written to 'tag-suggestions.json' for review, never into a
    sidecar.
""")]
public class TagDraftCommand(
    IAiTaggingService taggingService,
    IOptions<TagDraftSettings> settings,
    ILlmSpendTracker spendTracker)
    : AsyncCommand<TagDraftCommand.Settings>
{
    /// <summary>
    /// How many problems to tag concurrently. A one-time import is a few dozen problems at up to four model calls
    /// each, so a small fixed fan-out keeps well clear of model rate limits without needing a knob.
    /// </summary>
    private const int Concurrency = 4;

    /// <summary>
    /// The name of the review file collecting tag names the model proposed outside the approved vocabulary.
    /// </summary>
    private const string SuggestionsFileName = "tag-suggestions.json";

    /// <summary>
    /// The body language to tag against. Always English — the translations come from stronger models than the
    /// source-language originals.
    /// </summary>
    private const string TaggingLanguage = "en";

    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// The draft folder to tag.
        /// </summary>
        [CommandArgument(0, "<folder>")]
        [Description("Path to the draft folder to tag.")]
        public required string Folder { get; set; }

        /// <summary>
        /// Whether to re-tag every problem, overwriting existing tags, instead of skipping the already-tagged ones.
        /// </summary>
        [CommandOption("--retag")]
        [Description("Re-tag every problem, overwriting existing tags (default skips problems that already have tags).")]
        public bool Retag { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings commandSettings)
    {
        // Resolve the folder and bail early if it isn't there.
        var folder = commandSettings.Folder;
        if (!Directory.Exists(folder))
        {
            AnsiConsole.MarkupLineInterpolated($"[red]Draft folder not found:[/] {folder}");
            return 1;
        }

        // Build the full candidate set from the approved vocabulary.
        var vocabulary = TagFilesHelper.GetTagsForAi();
        var allCandidates = vocabulary
            .Select(pair => new AiTagCandidate(pair.Value.Slug, pair.Key, pair.Value.Type, pair.Value.Description))
            .ToImmutableArray();

        // Split the candidates by the pass that uses each category.
        var statementCandidates = allCandidates.Where(candidate => candidate.Type != TagType.Technique).ToImmutableArray();
        var techniqueCandidates = allCandidates.Where(candidate => candidate.Type == TagType.Technique).ToImmutableArray();

        // Index by slug for category lookup and veto-candidate rebuilding.
        var candidateBySlug = allCandidates.ToImmutableDictionary(candidate => candidate.Slug);

        // Discover the problems. Re-tagging takes them all; otherwise the skip rule keeps only the untagged ones.
        var problems = DraftTagFiles.DiscoverProblems(folder, TaggingLanguage)
            .Where(problem => commandSettings.Retag || NeedsTagging(problem))
            .ToImmutableArray();

        // Nothing left to do — everything is already tagged.
        if (problems.Length == 0)
        {
            AnsiConsole.MarkupLine("[yellow]Every problem already has a 'tags:' key — nothing to tag.[/]");
            return 0;
        }

        // Out-of-vocabulary proposals across all problems, for the review file.
        var suggestions = new Dictionary<string, SortedSet<string>>();

        // How many problems finished successfully.
        var taggedCount = 0;

        // Guards the two accumulators above — the tagging loop writes them concurrently.
        var resultLock = new Lock();

        // Announce the run: how many problems, in which language.
        AnsiConsole.MarkupLineInterpolated(
            $"\n[green]Tagging {problems.Length} problem(s) ({TaggingLanguage})...[/]");

        // Warn when re-tagging so overwriting existing tags is never a surprise.
        if (commandSettings.Retag)
            AnsiConsole.MarkupLine("[yellow]Re-tagging — existing tags on these problems will be overwritten.[/]");

        // Time the whole run.
        var runStopwatch = Stopwatch.StartNew();

        // Tag the problems concurrently. Each problem streams its own per-pass log; we write its sidecar as soon as
        // it finishes (distinct files, so no lock) and fold its tally + proposals in under the result lock.
        await Parallel.ForEachAsync(
            problems,
            new ParallelOptions { MaxDegreeOfParallelism = Concurrency },
            async (problem, cancellationToken) =>
            {
                // Run the full generate → veto pipeline for this problem.
                var result = await TagProblemAsync(
                    problem, statementCandidates, techniqueCandidates, candidateBySlug, cancellationToken);

                // A failure is already logged inside; skip writing a sidecar so a re-run retries just this one.
                if (!result.Succeeded)
                    return;

                // Read the sidecar's existing keys (authors / solutionLink).
                var existing = File.Exists(problem.YamlPath)
                    ? await File.ReadAllTextAsync(problem.YamlPath, cancellationToken)
                    : string.Empty;

                // Drop any prior tags block (a no-op unless re-tagging) so we never write a second one.
                var withoutTags = DraftTagFiles.StripTagsBlock(existing);

                // Append the fresh tags block beneath the remaining keys.
                var block = DraftTagFiles.BuildTagsBlock(result.Tags);
                await File.WriteAllTextAsync(
                    problem.YamlPath, DraftTagFiles.AppendTagsBlock(withoutTags, block), cancellationToken);

                // Fold this problem's result into the shared state.
                lock (resultLock)
                {
                    // Count it as tagged.
                    taggedCount++;

                    // File each out-of-vocabulary name under the problem that proposed it.
                    foreach (var name in result.UnknownNames)
                    {
                        // Start a fresh source set the first time a name shows up.
                        if (!suggestions.TryGetValue(name, out var sources))
                            suggestions[name] = sources = [];

                        // Record this problem as one that proposed it.
                        sources.Add($"p{problem.Index}");
                    }
                }
            });

        // Write any out-of-vocabulary proposals to the review file for the human to vet.
        await WriteSuggestionsAsync(folder, suggestions);

        // Report how many problems were tagged and how long the whole run took.
        AnsiConsole.MarkupLineInterpolated(
            $"[green]Tagged {taggedCount}/{problems.Length} problem(s) in {runStopwatch.Elapsed.TotalSeconds:0.0}s.[/]");

        // Price the round from its own spend tally; one credit is one US dollar.
        AnsiConsole.MarkupLine($"[green]This round cost ${spendTracker.Total:0.0000}.[/]");

        // Done.
        return 0;
    }

    /// <summary>
    /// Whether a problem still needs tagging: it does when its sidecar is absent or has no <c>tags:</c> key. A sidecar
    /// that won't parse aborts the run with a pointer to the offending file — a malformed sidecar is a data error to
    /// fix, not something to silently skip past.
    /// </summary>
    /// <param name="problem">The problem's body and sidecar paths.</param>
    /// <returns>True when the problem should be sent through the tagging pipeline.</returns>
    private static bool NeedsTagging(DraftProblemFiles problem)
    {
        // No sidecar yet — definitely untagged.
        if (!File.Exists(problem.YamlPath))
            return true;

        try
        {
            // A 'tags:' key (even an empty one) means the problem is already decided.
            return !DraftTagFiles.HasTagsKey(File.ReadAllText(problem.YamlPath));
        }
        catch (Exception exception)
        {
            // A sidecar that won't parse is a data error the run must not paper over — fail loudly, naming the file.
            throw new InvalidOperationException(
                $"p{problem.Index}: could not read {Path.GetFileName(problem.YamlPath)} — fix the sidecar and re-run.",
                exception);
        }
    }

    /// <summary>
    /// Runs the full generate → fit-floor → veto pipeline for one problem and returns the surviving tags.
    /// </summary>
    /// <param name="problem">The problem's body and sidecar paths.</param>
    /// <param name="statementCandidates">Area/Goal/Type candidates for the statement passes.</param>
    /// <param name="techniqueCandidates">Technique candidates for the solution passes.</param>
    /// <param name="candidateBySlug">Slug → candidate, for category lookup and veto-candidate rebuilding.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The surviving tags, or a failed result the caller should leave untagged.</returns>
    private async Task<ProblemTagResult> TagProblemAsync(
        DraftProblemFiles problem,
        ImmutableArray<AiTagCandidate> statementCandidates,
        ImmutableArray<AiTagCandidate> techniqueCandidates,
        ImmutableDictionary<string, AiTagCandidate> candidateBySlug,
        CancellationToken cancellationToken)
    {
        // Time the whole problem so the completion summary can show where the seconds went.
        var problemStopwatch = Stopwatch.StartNew();

        try
        {
            // Read the problem body.
            var body = await File.ReadAllTextAsync(problem.BodyPath, cancellationToken);

            // Split it into statement and solution.
            var (statement, solution) = DraftTagFiles.SplitStatementAndSolution(body);

            // Generate pass over the statement (Area/Goal/Type).
            var (statementResult, generateStatementTime) = await RunPassAsync(problem.Index, "generate statement",
                () => taggingService.SuggestTagsAsync(
                    statement, null, statementCandidates, settings.Value.GenerateStatement, cancellationToken));

            // Generate pass over the solution (Technique) — skipped when statement-only, so a Technique tag never
            // lands on a problem without a solution.
            var solutionResult = new SuggestTagsResult([], []);
            var generateSolutionTime = TimeSpan.Zero;
            if (solution is not null)
                (solutionResult, generateSolutionTime) = await RunPassAsync(problem.Index, "generate solution",
                    () => taggingService.SuggestTagsAsync(
                        statement, solution, techniqueCandidates, settings.Value.GenerateSolution, cancellationToken));

            // Combine the proposals and keep only those that clear the fit floor before the veto pass.
            var proposed = statementResult.TagsBySlug
                .AddRange(solutionResult.TagsBySlug)
                .Where(pair => pair.Value.GoodnessOfFit >= settings.Value.FitFloor)
                .ToImmutableDictionary();

            // Rebuild veto candidates carrying each survivor's justification, split by the prompt that reviews it.
            var statementSurvivors = SurvivorsForVeto(proposed, candidateBySlug, technique: false);
            var techniqueSurvivors = SurvivorsForVeto(proposed, candidateBySlug, technique: true);

            // Veto pass over the statement's Area/Goal/Type survivors, against the statement.
            var (approvedStatement, vetoStatementTime) = await RunPassAsync(problem.Index, "veto statement",
                () => taggingService.VetoTagsAsync(
                    statement, null, statementSurvivors, settings.Value.VetoStatement, cancellationToken));

            // Veto pass over the Technique survivors, against the solution — skipped when statement-only.
            var approvedTechnique = ImmutableHashSet<string>.Empty;
            var vetoSolutionTime = TimeSpan.Zero;
            if (solution is not null)
                (approvedTechnique, vetoSolutionTime) = await RunPassAsync(problem.Index, "veto solution",
                    () => taggingService.VetoTagsAsync(
                        statement, solution, techniqueSurvivors, settings.Value.VetoSolution, cancellationToken));

            // Order the survivors by category (Area → Type → Goal → Technique) then slug for a stable, readable list.
            var tags = approvedStatement.Union(approvedTechnique)
                .OrderBy(slug => CategoryRank(candidateBySlug[slug].Type))
                .ThenBy(slug => slug, StringComparer.Ordinal)
                .Select(slug => new DraftTag(slug, proposed[slug].GoodnessOfFit, proposed[slug].Justification))
                .ToImmutableArray();

            // Gather the model's out-of-vocabulary proposals from both generate passes.
            var unknownNames = statementResult.UnknownNames
                .AddRange(solutionResult.UnknownNames)
                .Distinct()
                .ToImmutableArray();

            // Completion summary: total time, the generate/veto breakdown, and how many tags survived.
            CliLog.Line($"[green]p{problem.Index} ✓[/] {problemStopwatch.Elapsed.TotalSeconds:0.0}s — " +
                $"gen {(generateStatementTime + generateSolutionTime).TotalSeconds:0.0}s " +
                $"(stmt {generateStatementTime.TotalSeconds:0.0} / sol {generateSolutionTime.TotalSeconds:0.0}), " +
                $"veto {(vetoStatementTime + vetoSolutionTime).TotalSeconds:0.0}s " +
                $"(stmt {vetoStatementTime.TotalSeconds:0.0} / sol {vetoSolutionTime.TotalSeconds:0.0}) " +
                $"→ {tags.Length} tag(s)");

            // Hand back the survivors and any unknown names for the caller to write.
            return new ProblemTagResult(Succeeded: true, tags, unknownNames);
        }
        catch (Exception exception)
        {
            // Log why this problem failed, escaping the message so markup chars in it can't break the line.
            var reason = Markup.Escape(exception.Message);
            CliLog.Line($"[red]p{problem.Index} failed after {problemStopwatch.Elapsed.TotalSeconds:0.0}s:[/] {reason}");

            // A failure (transport, malformed response) leaves the problem untagged so a re-run retries just this one.
            return new ProblemTagResult(Succeeded: false, [], []);
        }
    }

    /// <summary>
    /// Runs one model pass, logging a start line first (so a pass left sitting with no follow-up visibly marks where
    /// a problem is waiting) and returning its result alongside how long the call took.
    /// </summary>
    /// <typeparam name="TResult">The pass's result type.</typeparam>
    /// <param name="problemIndex">The problem number, for the log prefix.</param>
    /// <param name="passLabel">A short name for the pass, e.g. "veto statement".</param>
    /// <param name="pass">The pass to run and time.</param>
    /// <returns>The pass's result and its elapsed time.</returns>
    private static async Task<(TResult Result, TimeSpan Elapsed)> RunPassAsync<TResult>(
        int problemIndex, string passLabel, Func<Task<TResult>> pass)
    {
        // Announce the pass starting.
        CliLog.Line($"[grey]p{problemIndex}[/] → {passLabel}…");

        // Time just this model call.
        var stopwatch = Stopwatch.StartNew();
        var result = await pass();

        // Hand back the result alongside how long it took.
        return (result, stopwatch.Elapsed);
    }

    /// <summary>
    /// Selects the fit-floor survivors of one category and rebuilds them as veto candidates carrying their
    /// generate-pass justification.
    /// </summary>
    /// <param name="proposed">The surviving proposals keyed by slug.</param>
    /// <param name="candidateBySlug">Slug → candidate, for category and vocabulary lookup.</param>
    /// <param name="technique">Whether to take the Technique survivors (true) or the Area/Goal/Type ones (false).</param>
    /// <returns>The veto candidates for the matching prompt.</returns>
    private static ImmutableArray<AiTagCandidate> SurvivorsForVeto(
        ImmutableDictionary<string, TagFitness> proposed,
        ImmutableDictionary<string, AiTagCandidate> candidateBySlug,
        bool technique) =>
        [.. proposed
            .Where(pair => candidateBySlug[pair.Key].Type == TagType.Technique == technique)
            .Select(pair => candidateBySlug[pair.Key] with { Justification = pair.Value.Justification })];

    /// <summary>
    /// Writes the out-of-vocabulary proposals to the draft's review file, or removes a stale one when there are none.
    /// </summary>
    /// <param name="folder">The draft folder.</param>
    /// <param name="suggestions">Proposed name → the problems that proposed it.</param>
    private static async Task WriteSuggestionsAsync(
        string folder, IReadOnlyDictionary<string, SortedSet<string>> suggestions)
    {
        // The review file lives in the draft folder.
        var path = Path.Combine(folder, SuggestionsFileName);

        // No proposals — drop any leftover file from a previous run and say nothing.
        if (suggestions.Count == 0)
        {
            File.Delete(path);
            return;
        }

        // Persist the proposals.
        var file = new TagSuggestionsFile([.. suggestions
            .OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .Select(pair => new TagSuggestion(pair.Key, [.. pair.Value]))]);
        await File.WriteAllTextAsync(path, file.ToJson());

        // Point the user at the file.
        AnsiConsole.MarkupLineInterpolated(
            $"[yellow]{suggestions.Count} proposed tag(s) outside the vocabulary written to {SuggestionsFileName} for review.[/]");
    }

    /// <summary>
    /// The display/sort rank of a category: Area → Type → Goal → Technique, matching the site's tag ordering.
    /// </summary>
    /// <param name="type">The tag category.</param>
    /// <returns>The sort rank.</returns>
    private static int CategoryRank(TagType type) => type switch
    {
        TagType.Area => 0,
        TagType.Type => 1,
        TagType.Goal => 2,
        TagType.Technique => 3,
        _ => 4,
    };

    /// <summary>
    /// The outcome of tagging one problem.
    /// </summary>
    /// <param name="Succeeded">Whether the pipeline ran to completion; a failure leaves the sidecar untouched.</param>
    /// <param name="Tags">The surviving tags to write, in display order.</param>
    /// <param name="UnknownNames">Names the model proposed outside the vocabulary.</param>
    private record ProblemTagResult(bool Succeeded, ImmutableArray<DraftTag> Tags, ImmutableArray<string> UnknownNames);

    /// <summary>
    /// One out-of-vocabulary proposal in the review file.
    /// </summary>
    /// <param name="Name">The proposed tag name.</param>
    /// <param name="FromProblems">The problems that proposed it (e.g. <c>p3</c>).</param>
    private record TagSuggestion(string Name, ImmutableArray<string> FromProblems);

    /// <summary>
    /// The review file's contents.
    /// </summary>
    /// <param name="ProposedTags">The out-of-vocabulary proposals.</param>
    private record TagSuggestionsFile(ImmutableArray<TagSuggestion> ProposedTags);
}
