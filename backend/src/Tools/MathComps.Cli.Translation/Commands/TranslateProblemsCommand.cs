using MathComps.Cli.Translation.Dtos;
using MathComps.Cli.Translation.Enums;
using MathComps.Cli.Translation.Services;
using MathComps.Cli.Translation.Settings;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Services;
using MathComps.Shared;
using MathComps.Shared.Cli;
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
        public int NumThreads { get; set; } = 1;

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

        // Use the progress helper to process problems with AI translation in parallel
        await ProgressHelper.ExecuteWithProgressInParallelAsync(
            problemsToTranslate,
            "Translating problems...",
            getItemDescription: problem => $"{problem.Slug} -> {targetLanguage}".ToUpperInvariant(),
            processItem: async (problem, index, cancellationToken) =>
            {
                // Translate the problem in parallel
                return await TranslateProblem(
                    problem,
                    targetLanguage,
                    settings.Scope,
                    cancellationToken
                );
            },
            numThreads: settings.NumThreads,
            handleResult: async (result, problem, index, cancellationToken) =>
            {
                // Unwrap data
                var (translationResult, exceptions) = result;

                // Display any exceptions that occurred
                foreach (var exception in exceptions)
                {
                    AnsiConsole.MarkupLine($"[red]{problem.Slug.ToUpperInvariant()} -> {targetLanguage.ToString().ToUpper()}[/] Gemini service error");
                    AnsiConsole.WriteException(exception);
                    AnsiConsole.WriteLine();
                }

                // If translation succeeded, save to database
                if (translationResult != null)
                    await databaseService.UpsertTranslationAsync(translationResult);
            }
        );

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
    /// <returns>The translation result and any exceptions encountered, or null if translation failed.</returns>
    private async Task<(ProblemTranslationUpsertDto? result, List<Exception> exceptions)> TranslateProblem(
        ProblemForTranslationDto problem,
        Language targetLanguage,
        TranslationScope scope,
        CancellationToken cancellationToken)
    {
        // Load the system prompt from file once for both translations
        var systemPrompt = await File.ReadAllTextAsync(translateProblemsOptions.Value.ModelConfig.SystemPromptPath, cancellationToken);

        // Get language name for building prompts
        var targetLanguageName = targetLanguage switch
        {
            Language.EN => "English",
            Language.CZ => "Czech",
            Language.SK => "Slovak",
            _ => throw new ArgumentException($"Unsupported language: {targetLanguage}")
        };

        // Get the translations ready
        string? statementTranslation = null;
        string? solutionTranslation = null;

        // Collect exceptions to handle them in synchronized section
        var exceptions = new List<Exception>();

        // If statement should be translated
        if (scope is TranslationScope.StatementsOnly or TranslationScope.Both)
        {
            // Do the translation
            (statementTranslation, var exception) = await TranslateText(
                problem.StatementText,
                targetLanguageName,
                systemPrompt,
                "statement",
                cancellationToken
            );

            // Remember the exception if there was any
            if (exception != null)
                exceptions.Add(exception);
        }

        // If solution should be translated and it exists
        if (scope is TranslationScope.SolutionsOnly or TranslationScope.Both && problem.SolutionText is not null)
        {
            // Do the translation
            (solutionTranslation, var exception) = await TranslateText(
                problem.SolutionText,
                targetLanguageName,
                systemPrompt,
                "solution",
                cancellationToken
            );

            // Remember the exception if there was any
            if (exception != null)
                exceptions.Add(exception);
        }

        // Prepare the result
        var result = new ProblemTranslationUpsertDto(
            problem.Id,
            targetLanguage,
            statementTranslation,
            solutionTranslation
        );

        // Return the translation result with exceptions
        return (result, exceptions);
    }

    /// <summary>
    /// Translates a single text into the target language.
    /// </summary>
    /// <param name="text">The text to translate.</param>
    /// <param name="sourceLanguageName">The name of the source language.</param>
    /// <param name="targetLanguageName">The name of the target language.</param>
    /// <param name="systemPrompt">The system prompt.</param>
    /// <param name="textType">The type of text (statement or solution) used in the prompt.</param>
    /// <returns>The translation result, or null if translation failed.</returns>
    private async Task<(string? translation, Exception? exception)> TranslateText(
        string text,
        string targetLanguageName,
        string systemPrompt,
        string textType,
        CancellationToken cancellationToken)
    {
        // Build the user prompt with the text
        var userPrompt = $"""
            Translate this math problem {textType} to {targetLanguageName}:

            ```tex
            {text}
            ```
            """;

        // Track exception for deferred handling
        Exception? capturedException = null;

        // Call the Gemini service to get the translation
        var translationResponse = await GeneralUtilities.TryExecuteAsync(() =>
            geminiService.GenerateContentAsync(
                translateProblemsOptions.Value.ModelConfig.Model,
                systemPrompt,
                userPrompt,
                translateProblemsOptions.Value.ModelConfig.ThinkingBudget,
                cancellationToken
            ),
            // Capture exception for later handling (after semaphore is acquired)
            exception => capturedException = exception);

        // If AI service failed, return null with the exception
        if (translationResponse is null)
            return (null, capturedException);

        // Parse the translation response - try multiple strategies

        // Strategy 1: Look for tex code block
        var translationMatch = System.Text.RegularExpressions.Regex.Match(
            translationResponse,
            @"```(?:tex)?\s*(.*?)\s*```",
            System.Text.RegularExpressions.RegexOptions.Singleline
        );

        // Return if worked
        if (translationMatch.Success)
            return (translationMatch.Groups[1].Value.Trim(), null);

        // Strategy 2: Look for any code block
        translationMatch = System.Text.RegularExpressions.Regex.Match(
            translationResponse,
            @"```\s*(.*?)\s*```",
            System.Text.RegularExpressions.RegexOptions.Singleline
        );

        // Return if worked
        if (translationMatch.Success)
            return (translationMatch.Groups[1].Value.Trim(), null);

        // Strategy 3: Use the entire response if it looks like LaTeX
        if (translationResponse.Contains('\\') || translationResponse.Contains('{') || translationResponse.Contains('}'))
            return (translationResponse.Trim(), null);

        // Return failed translation with null exception (parsing failure, not API error)
        return (null, null);
    }
}
