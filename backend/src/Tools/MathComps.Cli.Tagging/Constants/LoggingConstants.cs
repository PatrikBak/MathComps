namespace MathComps.Cli.Tagging.Constants;

/// <summary>
/// Contains constants related to logging functionality in the tagging CLI tool.
/// Centralizes file paths and directory names used for storing AI interaction logs,
/// prompts, and responses for debugging and audit purposes.
/// </summary>
public static class LoggingConstants
{
    /// <summary>
    /// The root directory name where all logging files are stored.
    /// This includes AI prompts, responses, and processing logs for debugging and audit trails.
    /// </summary>
    public const string LogsDirectory = "Logs";

    /// <summary>
    /// File name for the main log file that tracks tag suggestion operations.
    /// Contains a summary of all tag suggestions made during the suggest-tags command execution.
    /// </summary>
    public const string SuggestTagsLogFile = "suggestTagsPrompt.txt";

    /// <summary>
    /// File name for storing the AI response from tag suggestion operations.
    /// Contains the raw JSON response from the Gemini API for tag suggestions.
    /// </summary>
    public const string SuggestTagsAiResponseFile = "suggestTags.aiResponse.json";

    /// <summary>
    /// File name for the prompt used in tag filtering operations.
    /// Contains the formatted prompt sent to the AI for vetting suggested tags.
    /// </summary>
    public const string FilterTagsPromptFile = "filterTagsPrompt.txt";

    /// <summary>
    /// File name for storing the AI response from tag filtering operations.
    /// Contains the raw JSON response from the Gemini API for tag filtering decisions.
    /// </summary>
    public const string FilterTagsAiResponseFile = "filterTags.aiResponse.json";

    /// <summary>
    /// File name for the main log file that tracks problem tagging operations.
    /// Contains a summary of all problems processed and tags assigned during tag-problems command execution.
    /// </summary>
    public const string TagProblemsLogFile = "tagProblems.log";

    /// <summary>
    /// File name for the main log file that tracks tag veto operations.
    /// Contains a summary of all tag veto decisions made during veto-problem-tags command execution.
    /// </summary>
    public const string VetoProblemsLogFile = "vetoProblems.log";

    /// <summary>
    /// File name for storing the final approved suggested tags in JSON format.
    /// Contains the categorized tag suggestions that have been filtered and approved by the AI.
    /// </summary>
    public const string SuggestedTagsJsonFile = "suggestedTags.json";
}
