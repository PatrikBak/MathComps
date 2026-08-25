using System.ComponentModel;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Shared.Serialization;
using Spectre.Console;
using Spectre.Console.Cli;

namespace MathComps.Cli.Competitions.Commands;

/// <summary>
/// Declares a hosted group: the batch of rounds the site runs as one competition, and the terms it runs on. The
/// rounds themselves are ordinary drafts imported the ordinary way, so this runs after their <c>apply</c> and only
/// links what is already there.
/// </summary>
/// <param name="declare">The service that carries the manifest out.</param>
[Description("Declare a hosted group from its manifest: link its rounds and set the terms they run on.")]
public class DeclareGroupCommand(IHostedGroupService declare) : AsyncCommand<DeclareGroupCommand.Settings>
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
            AnsiConsole.MarkupLineInterpolated($"[red]No manifest at {settings.Manifest}[/]");

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

            // What a real run put there, or what a dry run says it would.
            var verb = settings.DryRun
                ? outcome.Created ? "Would create" : "Would update"
                : outcome.Created ? "Created" : "Updated";

            // The group's size, in rounds and problems each.
            var size = $"{outcome.RoundsLinked} round(s) of {outcome.ProblemCount} problem(s) each";

            // What it did, in one line.
            AnsiConsole.MarkupLineInterpolated($"[green]{verb}[/] group [bold]{manifest.Slug}[/]: {size}.");

            // The group stands as the manifest describes it, or a dry run says it would.
            return 0;
        }
        // The manifest is the author's to fix.
        catch (HostedGroupManifestException exception)
        {
            // Say what is wrong with it, in the words the refusal used.
            AnsiConsole.MarkupLineInterpolated($"[red]{exception.Message}[/]");

            // Nothing was written, here or on the run that refused it.
            return 1;
        }
    }
}
