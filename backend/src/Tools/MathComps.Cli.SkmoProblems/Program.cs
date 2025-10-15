using MathComps.Cli.SkmoProblems;
using Spectre.Console.Cli;

// Spectre handles it all
return await new CommandApp<ParseCommand>().RunAsync(args);
