using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;

namespace MathComps.Cli.DatabaseSeeder.Commands;

/// <summary>
/// Orchestrates database seeding from a parsed problems dataset. Reads the input JSON,
/// maps to EF Core entities, and performs idempotent upserts.
/// </summary>
/// <param name="seeder">The database seeder service that performs the actual seeding operations.</param>
[Description("Seeds the database with problems from the parsed JSON dataset.")]
public class SeedCommand(IDatabaseSeeder seeder) : AsyncCommand<SeedCommand.Settings>
{
    /// <summary>
    /// Command-line arguments for the seed command.
    /// </summary>
    public class Settings : CommandSettings
    {
        [CommandOption("-s|--skip-existing")]
        [Description("Skip updating existing problems (only insert new ones)")]
        [DefaultValue(false)]
        /// <summary>
        /// Useful when we just add new problems and we want the command to run quick.
        /// </summary>
        public bool SkipExisting { get; set; }
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        // Fancy header
        AnsiConsole.Write(new FigletText("Skmo Seeder").Color(Color.Blue));

        try
        {
            // Execute the seeding operation with the configured options.
            await seeder.SeedAsync(settings.SkipExisting);

            // Success!
            return 0;
        }
        catch (Exception exception)
        {
            // Make aware of the error
            AnsiConsole.WriteException(exception);

            // Be sad
            return 1;
        }
    }
}

