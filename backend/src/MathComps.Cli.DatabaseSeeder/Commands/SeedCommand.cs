using MathComps.Cli.DatabaseSeeder.Services;
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
        /// <summary>
        /// Skip updating problems that already exist, inserting only new ones.
        /// </summary>
        [CommandOption("-s|--skip-existing")]
        [Description(
            """
            Skip updating existing problems (only insert new ones). 
            Useful when we just add new problems and we want the command to run quick.
            """
        )]
        public bool SkipExisting { get; set; }

        /// <summary>
        /// The competition year(s) to process; an empty array means every year.
        /// </summary>
        [CommandArgument(0, "[years]")]
        [Description("Only process problems from the specified year(s), space-separated (e.g., '72 59 41')")]
        public int[] Years { get; set; } = [];
    }

    /// <inheritdoc/>
    public override async Task<int> ExecuteAsync(CommandContext context, Settings settings)
    {
        try
        {
            // If not specified, Years will be an empty array, meaning we're updating everything
            // Execute the seeding operation with the configured options.
            await seeder.SeedAsync(settings.SkipExisting, settings.Years);

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

