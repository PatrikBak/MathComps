using MathComps.Cli.SkmoParser.Commands;
using Spectre.Console;
using Spectre.Console.Cli;
using MathComps.Shared.Cli.Commands;

// Fancy header
AnsiConsole.Write(new FigletText("SKMO Parser").Centered().Color(Color.Aqua));

// Run the app using our custom runner
return await CliRunner.RunAsync(new CommandApp<ParseCommand>(), args);
