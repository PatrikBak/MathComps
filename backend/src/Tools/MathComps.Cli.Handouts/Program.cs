using MathComps.Cli.Handouts;
using Spectre.Console.Cli;

// Spectre handles it all
return await new CommandApp<ParseCommand>().RunAsync(args);
