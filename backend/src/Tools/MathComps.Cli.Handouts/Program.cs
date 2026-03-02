using MathComps.Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using MathComps.Cli.Handouts;
using Spectre.Console.Cli.Extensions.DependencyInjection;

// Fancy header
AnsiConsole.Write(new FigletText("Handouts").Centered().Color(Color.Aqua));

// We'll use DI
var services = new ServiceCollection();

// Configuration is built manually to support appsettings.json, user secrets, and env vars.
var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: false)
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();

// Register R2 settings with validation via the options pipeline
services.AddOptions<R2Settings>()
    .Bind(configuration.GetSection(R2Settings.SectionName))
    .ValidateDataAnnotations();

// Register the R2 uploader as the file uploader implementation
services.AddSingleton<IFileUploader, R2Uploader>();

// Start the app with DI
using var registrar = new DependencyInjectionRegistrar(services);

// Configure single-command CLI
var app = new CommandApp<BuildCommand>(registrar);

// Let exceptions bubble up to the console 
app.Configure(config => config.PropagateExceptions());

try
{
    // The application runs with the provided command-line arguments and returns the exit code.
    return await app.RunAsync(args);
}
catch (Exception exception)
{
    // Developer exceptions
    AnsiConsole.WriteException(exception, ExceptionFormats.ShortenEverything);
    return 1;
}
