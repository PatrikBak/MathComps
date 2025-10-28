using MathComps.Cli.Handouts;
using Spectre.Console;
using Spectre.Console.Cli;

// Fancy header
AnsiConsole.Write(new FigletText("Handouts").Centered().Color(Color.Aqua));

// Spectre handles it all
return await new CommandApp<ParseCommand>().RunAsync(args);
