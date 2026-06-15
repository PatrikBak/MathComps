using MathComps.Cli.Tagging.Dtos;
using MathComps.Cli.Tagging.Services;
using MathComps.Cli.Tagging.Settings;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.Collections.Immutable;
using System.ComponentModel;
using MathComps.Domain.Tagging;
using MathComps.Shared.Serialization;
using MathComps.Shared.Cli.Progress;

namespace MathComps.Cli.Tagging.Commands;

/// <summary>
/// Tags a bulk-import draft in place: for each untagged problem it runs Gemini over the original-language statement
/// (Area/Goal/Type) and solution (Technique), prunes the proposals with a second AI veto pass, and writes the
/// surviving slugs into the problem's <c>pN.yaml</c> sidecar. The draft — not the database — is the source of truth,
/// so <c>apply</c> later replays the same tags identically to every environment.
/// </summary>
/// <param name="taggingService">The database-free generate/veto core.</param>
/// <param name="settings">The four Gemini passes and the fit floor.</param>
[Description("""
    Tag a bulk-import draft folder in place. For every problem whose pN.yaml has no 'tags:' key, Gemini proposes
    tags from the approved vocabulary (statement → Area/Goal/Type, solution → Technique), a veto pass prunes them,
    and the survivors are written as a bare slug list into pN.yaml. Problems that already have a 'tags:' key are
    left untouched, so a re-run only fills in the gaps. Names the model proposes outside the vocabulary are written
    to 'tag-suggestions.json' for review, never into a sidecar.
""")]
public class TagDraftCommand(
    IAiTaggingService taggingService,
    IOptions<TagDraftSettings> settings)
    : AsyncCommand<TagDraftCommand.Settings>
{
    /// <summary>
    /// How many problems to tag concurrently. A one-time import is a few dozen problems at up to four Gemini calls
    /// each, so a small fixed fan-out keeps well clear of model rate limits without needing a knob.
    /// </summary>
    private const int Concurrency = 4;

    /// <summary>
    /// The name of the review file collecting tag names the model proposed outside the approved vocabulary.
    /// </summary>
    private const string SuggestionsFileName = "tag-suggestions.json";

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

        // Tags are generated against the draft's original language — the one whose body files we send to the model.
        var language = DraftTagFiles.ReadOriginalLanguage(folder);

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

        // Discover the problems and keep only the ones the skip rule says still need tagging.
        var problems = DraftTagFiles.DiscoverProblems(folder, language)
            .Where(NeedsTagging)
            .ToImmutableArray();

        // Nothing left to do — everything is already tagged.
        if (problems.Length == 0)
        {
            AnsiConsole.MarkupLine("[yellow]Every problem already has a 'tags:' key — nothing to tag.[/]");
            return 0;
        }

        // Collect the out-of-vocabulary proposals across all problems for the review file (written under the
        // synchronized result handler, so a plain dictionary is safe).
        var suggestions = new Dictionary<string, SortedSet<string>>();

        // Tag the problems concurrently, writing each sidecar as its result lands.
        await ProgressHelper.ExecuteWithProgressInParallelAsync(
            problems,
            "Tagging draft problems...",
            getItemDescription: problem => $"p{problem.Index}",
            numThreads: Concurrency,
            processItem: (problem, index, cancellationToken) => TagProblemAsync(
                problem, statementCandidates, techniqueCandidates, candidateBySlug, cancellationToken),
            handleResult: async (result, problem, index, cancellationToken) =>
            {
                // A failed problem leaves its sidecar's 'tags:' key absent so a re-run retries just that one.
                if (!result.Succeeded)
                {
                    AnsiConsole.MarkupLineInterpolated($"[red]p{problem.Index} failed — left untagged for a re-run.[/]");
                    return;
                }

                // Read the sidecar's existing keys (authors / solutionLink).
                var existing = File.Exists(problem.YamlPath)
                    ? await File.ReadAllTextAsync(problem.YamlPath, cancellationToken)
                    : string.Empty;

                // Append the tags block beneath them.
                var block = DraftTagFiles.BuildTagsBlock(result.Tags);
                await File.WriteAllTextAsync(
                    problem.YamlPath, DraftTagFiles.AppendTagsBlock(existing, block), cancellationToken);

                // Remember any names the model invented outside the vocabulary, tagged by their source problem.
                foreach (var name in result.UnknownNames)
                {
                    // Start a fresh source set the first time a name shows up.
                    if (!suggestions.TryGetValue(name, out var sources))
                        suggestions[name] = sources = [];

                    // Record this problem as one that proposed it.
                    sources.Add($"p{problem.Index}");
                }
            });

        // Surface any out-of-vocabulary proposals for the human to approve into approved-tags.json.
        await WriteSuggestionsAsync(folder, suggestions);

        // Report how many problems were tagged.
        AnsiConsole.MarkupLineInterpolated($"[green]Tagged {problems.Length} problem(s).[/]");

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
        try
        {
            // Read the original-language body.
            var body = await File.ReadAllTextAsync(problem.BodyPath, cancellationToken);

            // Split it into statement and solution.
            var (statement, solution) = DraftTagFiles.SplitStatementAndSolution(body);

            // Generate pass over the statement (Area/Goal/Type).
            var statementResult = await taggingService.SuggestTagsAsync(
                statement, null, statementCandidates, settings.Value.GenerateStatement, cancellationToken);

            // Generate pass over the solution (Technique) — skipped when statement-only, so a Technique tag never
            // lands on a problem without a solution.
            var solutionResult = solution is null
                ? new SuggestTagsResult([], [])
                : await taggingService.SuggestTagsAsync(
                    statement, solution, techniqueCandidates, settings.Value.GenerateSolution, cancellationToken);

            // Combine the proposals and keep only those that clear the fit floor before the veto pass.
            var proposed = statementResult.TagsBySlug
                .AddRange(solutionResult.TagsBySlug)
                .Where(pair => pair.Value.GoodnessOfFit >= settings.Value.FitFloor)
                .ToImmutableDictionary();

            // Rebuild veto candidates carrying each survivor's justification, split by the prompt that reviews it.
            var statementSurvivors = SurvivorsForVeto(proposed, candidateBySlug, technique: false);
            var techniqueSurvivors = SurvivorsForVeto(proposed, candidateBySlug, technique: true);

            // Veto pass: the statement tags review against the statement, the technique tags against the solution.
            var approved = (await taggingService.VetoTagsAsync(
                    statement, null, statementSurvivors, settings.Value.VetoStatement, cancellationToken))
                .Union(solution is null
                    ? []
                    : await taggingService.VetoTagsAsync(
                        statement, solution, techniqueSurvivors, settings.Value.VetoSolution, cancellationToken));

            // Order the survivors by category (Area → Type → Goal → Technique) then slug for a stable, readable list.
            var tags = approved
                .OrderBy(slug => CategoryRank(candidateBySlug[slug].Type))
                .ThenBy(slug => slug, StringComparer.Ordinal)
                .Select(slug => new DraftTag(slug, proposed[slug].GoodnessOfFit, proposed[slug].Justification))
                .ToImmutableArray();

            // Gather the model's out-of-vocabulary proposals from both generate passes.
            var unknownNames = statementResult.UnknownNames
                .AddRange(solutionResult.UnknownNames)
                .Distinct()
                .ToImmutableArray();

            // Hand back the survivors and any unknown names for the caller to write.
            return new ProblemTagResult(Succeeded: true, tags, unknownNames);
        }
        catch (Exception exception)
        {
            // Any failure (transport, malformed response) leaves the problem untagged for a clean re-run.
            AnsiConsole.MarkupLineInterpolated($"[red]p{problem.Index}: {exception.Message}[/]");
            return new ProblemTagResult(Succeeded: false, [], []);
        }
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
