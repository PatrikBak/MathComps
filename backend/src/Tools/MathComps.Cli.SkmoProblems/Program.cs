using MathComps.Cli.SkmoProblems;
using Spectre.Console;
using Spectre.Console.Cli;

// Fancy header
AnsiConsole.Write(new FigletText("SKMO Parser").Centered().Color(Color.Aqua));

// Spectre handles everything
return await new CommandApp<ParseCommand>().RunAsync(args);
