using MathComps.Cli.Translation.Dtos;
using MathComps.Cli.Translation.Enums;
using MathComps.Cli.Translation.Services;
using MathComps.Cli.Translation.Settings;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services;
using MathComps.Shared;
using Microsoft.Extensions.Options;
using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

namespace MathComps.Cli.Translation.Commands;

/// <summary>
/// Translates problem statements and solutions into a specified language using AI.
/// Supports batch processing with configurable thread count and force retranslation.
/// </summary>
/// <param name="databaseService">The database service for accessing problem data.</param>
/// <param name="geminiService">The service responsible for making calls to the Gemini API.</param>
/// <param name="translateProblemsOptions">Configuration settings specific for this command.</param>
[Description("Automatically translate problems into a specified language using AI.")]
public class TranslateProblemsCommand(
    ITranslationDatabaseService databaseService,
    IGeminiService geminiService,
    IOptions<TranslateProblemsSettings> translateProblemsOptions)
    : AsyncCommand<TranslateProblemsCommand.Settings>
{
    /// <summary>
    /// The command arguments
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Number of problems to translate.
        /// </summary>
        [CommandOption("-n|--count")]
        [Description("Number of problems to translate.")]
        public required int Count { get; set; }

        /// <summary>
        /// Target language for translation (e.g., "en", "cz", "sk").
        /// </summary>
        [CommandOption("-l|--language", isRequired: true)]
        [Description("Target language for translation (e.g., 'en', 'cz', 'sk').")]
        public required string Language { get; set; }

        /// <summary>
        /// Force retranslation even if translations already exist.
        /// </summary>
        [CommandOption("--force")]
        [Description("Force retranslation even if translations already exist.")]
        [DefaultValue(false)]
        public bool Force { get; set; }

        /// <summary>
        /// Number of threads to run the translation in parallel.
        /// </summary>
        [CommandOption("--num-threads")]
        [Description("Number of threads to run the translation in parallel. Note: make sure to take into account model rate limits when setting this.")]
        [DefaultValue(1)]
        public int NumThreads { get; set; }

        /// <summary>
        /// Scope of translation (statements only, solutions only, or both).
        /// </summary>
        [CommandOption("--scope")]
        [Description("Translation scope: both, statements-only, or solutions-only.")]
        [DefaultValue(TranslationScope.Both)]
        public TranslationScope Scope { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        #region Parse and validate input

        // Parse the target language
        if (!Enum.TryParse<Language>(settings.Language.ToUpper(), out var targetLanguage))
        {
            // Make aware of a bad one
            AnsiConsole.MarkupLine($"[red]Invalid language code '{settings.Language}'. Use language codes like 'en', 'cz', 'sk'.[/]");
            return 1;
        }

        // Display the target language
        AnsiConsole.MarkupLine($"[cyan]Target language:[/] {targetLanguage.ToString().ToUpper()}");

        // Display what we're translating
        var translationScope = settings.Scope switch
        {
            TranslationScope.StatementsOnly => "statements only",
            TranslationScope.SolutionsOnly => "solutions only",
            TranslationScope.Both => "statements and solutions",
            _ => throw new ArgumentException($"Unsupported translation scope: {settings.Scope}")
        };
        AnsiConsole.MarkupLine($"[cyan]Translation scope:[/] {translationScope}");

        #endregion

        #region Retrieve problems needing translation

        // Retrieve the problems that need translation based on user settings
        var problemsToTranslate = await databaseService.GetProblemsNeedingTranslationAsync(
            targetLanguage,
            settings.Count,
            settings.Force,
            settings.Scope
        );

        // If no problems found to process
        if (problemsToTranslate.Count == 0)
        {
            // Make aware
            AnsiConsole.MarkupLine("[yellow]No problems found to translate with the specified criteria.[/]");

            // Exit successfully
            return 0;
        }

        // Log count
        AnsiConsole.MarkupLine($"[green]Found {problemsToTranslate.Count} problem(s) to translate.[/]");

        #endregion

        #region Process problems with AI translation

        // Use Spectre.Console's Progress UI to provide a rich, real-time view of the translation process
        await AnsiConsole.Progress()
            .AutoClear(enabled: false)
            .Columns(
            [
                new TaskDescriptionColumn(),
                new ProgressBarColumn(),
                new PercentageColumn(),
                new RemainingTimeColumn(),
                new SpinnerColumn(),
            ])
            .StartAsync(async progressContext =>
            {
                // Create progress task for AI processing phase
                var processingTask = progressContext.AddTask("[green]Translating problems[/]", maxValue: problemsToTranslate.Count);
                processingTask.StartTask();

                // Semaphore to ensure thread-safe database operations and progress updates
                SemaphoreSlim semaphore = new(1, 1);

                // Process problems in parallel with configurable thread count
                await Parallel.ForAsync(0, problemsToTranslate.Count, new ParallelOptions { MaxDegreeOfParallelism = settings.NumThreads },
                    async (problemIndex, cancellationToken) =>
                    {
                        // Get the current problem to process
                        var problem = problemsToTranslate[problemIndex];

                        // Translate the problem
                        var translationResult = await TranslateProblem(
                            problem,
                            targetLanguage,
                            settings.Scope,
                            cancellationToken
                        );

                        // Use semaphore to ensure thread-safe database access and progress updates
                        await semaphore.WaitAsync(cancellationToken);

                        try
                        {
                            // If translation succeeded, save to database
                            if (translationResult != null)
                                await databaseService.UpsertTranslationAsync(translationResult);

                            // Update progress (must be done in semaphore for correct display)
                            processingTask.Increment(1);
                            processingTask.Description =
                                $"[green]Translating {processingTask.Value}/{problemsToTranslate.Count}[/] [dim]" +
                                $"({problem.Slug.ToUpperInvariant()} -> {targetLanguage.ToString().ToUpper()})[/]";
                        }
                        finally
                        {
                            // Release the semaphore for other threads
                            semaphore.Release();
                        }
                    });

                // Mark AI processing phase as complete
                processingTask.StopTask();
            });

        #endregion

        #region Report completion

        // Confirm successful completion
        AnsiConsole.MarkupLine($"[bold green]Translation complete.[/]");

        #endregion

        return 0;
    }

    /// <summary>
    /// Translates a single problem into the target language.
    /// Makes separate API calls for statement and solution to improve efficiency and reliability.
    /// </summary>
    /// <param name="problem">The problem to translate.</param>
    /// <param name="targetLanguage">The target language for translation.</param>
    /// <param name="scope">The scope of translation (statements only, solutions only, or both).</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The translation result, or null if translation failed.</returns>
    private async Task<ProblemTranslationUpsertDto?> TranslateProblem(
        ProblemForTranslationDto problem,
        Language targetLanguage,
        TranslationScope scope,
        CancellationToken cancellationToken)
    {
        // Load the system prompt from file once for both translations
        var systemPrompt = await File.ReadAllTextAsync(translateProblemsOptions.Value.ModelConfig.SystemPromptPath, cancellationToken);

        // Local function to get language name without repetition
        static string GetLanguageName(Language language) => language switch
        {
            Language.EN => "English",
            Language.CZ => "Czech",
            Language.SK => "Slovak",
            _ => throw new ArgumentException($"Unsupported language: {language}")
        };

        // Get language names for building prompts
        var sourceLanguageName = GetLanguageName(problem.OriginalLanguage);
        var targetLanguageName = GetLanguageName(targetLanguage);

        // Get the translations ready
        string? statementTranslation = null;
        string? solutionTranslation = null;

        // If statement should be translated
        if (scope is TranslationScope.StatementsOnly or TranslationScope.Both)
        {
            // Do the translation
            statementTranslation = await TranslateText(
                problem.StatementText,
                sourceLanguageName,
                targetLanguageName,
                systemPrompt,
                "statement",
                problem.Slug,
                targetLanguage,
                cancellationToken
            );
        }

        // If solution should be translated and it exists
        if (scope is TranslationScope.StatementsOnly or TranslationScope.Both && problem.SolutionText is not null)
        {
            // Do the translation
            solutionTranslation = await TranslateText(
                problem.SolutionText,
                sourceLanguageName,
                targetLanguageName,
                systemPrompt,
                "solution",
                problem.Slug,
                targetLanguage,
                cancellationToken
            );
        }

        // Return the translation result
        return new ProblemTranslationUpsertDto(
            problem.Id,
            targetLanguage,
            statementTranslation,
            solutionTranslation
        );
    }

    /// <summary>
    /// Translates a single text into the target language.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="sourceLanguageName">The name of the source language.</param>
    /// <param name="targetLanguageName">The name of the target language.</param>
    /// <param name="systemPrompt">The system prompt.</param>
    /// <param name="textType">The type of text (statement or solution) used in the prompt.</param>
    /// <param name="problemSlug">The slug of the problem for logging.</param>
    /// <param name="targetLanguage">The target language.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The translation result, or null if translation failed.</returns>
    private async Task<string?> TranslateText(
        string text,
        string sourceLanguageName,
        string targetLanguageName,
        string systemPrompt,
        string textType,
        string problemSlug,
        Language targetLanguage,
        CancellationToken cancellationToken)
    {
        // Build the user prompt with the text
        var userPrompt = $"""
            Translate this math problem {textType} from {sourceLanguageName} to {targetLanguageName}:

            ```tex
            {text}
            ```
            """;

        // Call the Gemini service to get the translation
        var translationResponse = await GeneralUtilities.TryExecuteAsync(() =>
            geminiService.GenerateContentAsync(
                translateProblemsOptions.Value.ModelConfig.Model,
                systemPrompt,
                userPrompt,
                translateProblemsOptions.Value.ModelConfig.ThinkingBudget,
                cancellationToken
            ),
            // Handle AI service errors gracefully
            exception =>
            {
                // Log the problem slug and exception details
                AnsiConsole.MarkupLine($"[red]{problemSlug.ToUpperInvariant()} -> {targetLanguage.ToString().ToUpper()}[/] Gemini service error");
                AnsiConsole.WriteException(exception);
            });

        // If AI service failed, return null
        if (translationResponse is null)
            return null;

        // Parse the translation response - try multiple strategies

        // Strategy 1: Look for tex code block
        var translationMatch = System.Text.RegularExpressions.Regex.Match(
            translationResponse,
            @"```(?:tex)?\s*(.*?)\s*```",
            System.Text.RegularExpressions.RegexOptions.Singleline
        );

        // Return if worked
        if (translationMatch.Success)
            return translationMatch.Groups[1].Value.Trim();

        // Strategy 2: Look for any code block
        translationMatch = System.Text.RegularExpressions.Regex.Match(
            translationResponse,
            @"```\s*(.*?)\s*```",
            System.Text.RegularExpressions.RegexOptions.Singleline
        );

        // Return if worked
        if (translationMatch.Success)
            return translationMatch.Groups[1].Value.Trim();

        // Strategy 3: Use the entire response if it looks like LaTeX
        if (translationResponse.Contains('\\') || translationResponse.Contains('{') || translationResponse.Contains('}'))
            return translationResponse.Trim();

        // Complete failure - log the response for debugging
        AnsiConsole.MarkupLine($"[red]{problemSlug.ToUpperInvariant()} → {targetLanguage.ToString().ToUpper()}[/] Failed to parse translation response");
        AnsiConsole.MarkupLine($"[dim]Response preview: {translationResponse[..Math.Min(200, translationResponse.Length)]}...[/]");
        return null;
    }
}
