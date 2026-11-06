using System.ComponentModel;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Shared.Serialization;
using Microsoft.Extensions.Logging;
using Spectre.Console.Cli;

namespace MathComps.Cli.Competitions.Commands;

/// <summary>
/// Declares a hosted group: the batch of rounds the site runs as one competition, and the terms it runs on. It
/// raises whatever the manifest names that the database has not met yet, so a group goes on the site the day its
/// dates are decided and the problems land on its rounds later.
/// </summary>
/// <param name="declare">The service that carries the manifest out.</param>
/// <param name="logger">The logger the outcome and refusals go through.</param>
[Description("Declare a hosted group from its manifest: link its rounds and set the terms they run on.")]
public class DeclareGroupCommand(IHostedGroupService declare, ILogger<DeclareGroupCommand> logger)
    : AsyncCommand<DeclareGroupCommand.Settings>
{
    /// <summary>
    /// The command arguments.
    /// </summary>
    public class Settings : CommandSettings
    {
        /// <summary>
        /// Path to the group manifest.
        /// </summary>
        [CommandArgument(0, "<manifest>")]
        [Description("Path to the group manifest. Example: ./data/problems/mc-2026-1.group.json")]
        public required string Manifest { get; set; }

        /// <summary>
        /// Whether to report what the manifest would do without writing it.
        /// </summary>
        [CommandOption("--dry-run")]
        [Description("Run every check and report what would happen. Writes nothing.")]
        public bool DryRun { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Nothing to read, so there is no manifest to declare from.
        if (!File.Exists(settings.Manifest))
        {
            // Say which path came up empty.
            logger.LogError("No manifest at {Manifest}", settings.Manifest);

            // Nothing was declared, and the path is the caller's to fix.
            return 1;
        }

        // What the manifest says the group is.
        var manifest = (await File.ReadAllTextAsync(settings.Manifest)).FromJson<HostedGroupManifest>();

        // The declaration itself, which refuses a manifest it cannot carry out.
        try
        {
            // Upsert the group and give it exactly the rounds the manifest names, or work out what that would do.
            var outcome = await declare.DeclareAsync(manifest, settings.DryRun);

            // The verb for what happened to the group: created or updated, or would be on a dry run.
            var verb = settings.DryRun
                ? outcome.Created ? "Would create" : "Would update"
                : outcome.Created ? "Created" : "Updated";

            // What the run did, in one line, with the group's size in rounds and the problems each round announces.
            logger.LogInformation("{Verb} group {Slug}: {Rounds} round(s) of {Problems} problem(s) each",
                verb, manifest.Slug, outcome.RoundsLinked, outcome.ProblemCount);

            // A group may stand before its problems are picked, so say how much of it is still to come. Without
            // it the line above reads as a full group over rounds holding nothing.
            if (outcome.RoundsAwaitingProblems > 0)
                logger.LogWarning("{Rounds} round(s) still waiting on their problems", outcome.RoundsAwaitingProblems);

            // The group stands as the manifest describes it, or a dry run says it would.
            return 0;
        }
        // The manifest is the author's to fix.
        catch (HostedGroupManifestException exception)
        {
            // Say what is wrong with it, in the words the refusal used.
            logger.LogError("{Refusal}", exception.Message);

            // The refusal left nothing behind, so the run fails.
            return 1;
        }
    }
}
