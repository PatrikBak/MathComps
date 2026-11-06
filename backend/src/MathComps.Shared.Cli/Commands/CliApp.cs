using System.Reflection;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Configuration;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

namespace MathComps.Shared.Cli.Commands;

/// <summary>
/// Fluent bootstrap shared by every CLI tool: it builds configuration from the shared logging defaults, the JSON
/// config files the tool declares, and its user secrets and environment variables, wires up dependency injection and
/// console logging, and hands the resulting command app to <see cref="CliRunner"/>. Tools supply the config files
/// they require, their own service registrations, and their command list.
/// </summary>
public sealed class CliApp
{
    /// <summary>
    /// The tool's entry assembly, used to anchor its user-secrets store.
    /// </summary>
    private readonly Assembly _userSecretsAssembly;

    /// <summary>
    /// Tool-specific registrations, each taking the built configuration.
    /// </summary>
    private readonly List<Action<IServiceCollection, IConfiguration>> _serviceConfigurators = [];

    /// <summary>
    /// The config files the tool requires, in the order they load.
    /// </summary>
    private readonly List<string> _requiredConfigFiles = [];

    /// <summary>
    /// Initializes a new bootstrap for a single tool.
    /// </summary>
    /// <param name="userSecretsAssembly">The tool's entry assembly, anchoring its user-secrets store.</param>
    private CliApp(Assembly userSecretsAssembly)
    {
        // Stash the assembly that owns the secrets; configuration is built later, at run time.
        _userSecretsAssembly = userSecretsAssembly;
    }

    /// <summary>
    /// Begins bootstrapping a tool, anchoring user secrets to the assembly that declares
    /// <typeparamref name="TProgram"/> so each tool keeps its own secret store.
    /// </summary>
    /// <typeparam name="TProgram">The tool's <c>Program</c> type, used to locate its entry assembly.</typeparam>
    /// <returns>The bootstrap, for fluent chaining.</returns>
    public static CliApp Create<TProgram>() =>
        // A bootstrap anchored to the tool's own assembly.
        new(typeof(TProgram).Assembly);

    /// <summary>
    /// Registers tool-specific services. The callback receives the built configuration so it can bind
    /// options and read connection strings. May be called more than once; callbacks run in order.
    /// </summary>
    /// <param name="configure">Adds the tool's services to the collection using the configuration.</param>
    /// <returns>The bootstrap, for fluent chaining.</returns>
    public CliApp ConfigureServices(Action<IServiceCollection, IConfiguration> configure)
    {
        // Defer the registration until run time, when the configuration exists.
        _serviceConfigurators.Add(configure);

        // Allow the caller to keep chaining.
        return this;
    }

    /// <summary>
    /// Declares a JSON config file the tool requires. Each must be present: a missing one fails at startup rather
    /// than surfacing later as an opaque binding error. May be called more than once; files load in call order, so a
    /// later one overrides an earlier, and user secrets and env vars override them all.
    /// </summary>
    /// <param name="fileName">The config file's name, resolved against the tool's base directory.</param>
    /// <returns>The bootstrap, for fluent chaining.</returns>
    public CliApp RequireConfigFile(string fileName)
    {
        // Record the file; it's loaded when configuration is built.
        _requiredConfigFiles.Add(fileName);

        // Allow the caller to keep chaining.
        return this;
    }

    /// <summary>
    /// Bootstraps and runs a tool whose default command is <typeparamref name="TDefaultCommand"/>,
    /// optionally registering extra commands through <paramref name="configure"/>.
    /// </summary>
    /// <typeparam name="TDefaultCommand">The command run when no command name is given.</typeparam>
    /// <param name="args">The tool's command-line arguments.</param>
    /// <param name="configure">Optionally registers additional commands on the Spectre configurator.</param>
    /// <returns>The process exit code: the command's own, or 1 on an unhandled exception.</returns>
    public async Task<int> RunAsync<TDefaultCommand>(string[] args, Action<IConfigurator>? configure = null)
        where TDefaultCommand : class, ICommand
    {
        // Force UTF-8 so diacritics (e.g. Slovak) render even where the default console code page can't.
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        // A width no help line reaches.
        const int unwrappedWidth = 10_000;

        // Spectre writes the help and nothing else, and it wraps redirected output to 80 columns, which splits a long
        // help line into continuation lines the reader has no way to rejoin. A terminal keeps its own width.
        if (Console.IsOutputRedirected)
            AnsiConsole.Profile.Width = unwrappedWidth;

        // Read every configuration layer, the shared logging defaults first.
        var configuration = BuildConfiguration();

        // The one logger factory every line goes through, the crash report included.
        using var loggerFactory = CreateLoggerFactory(configuration);

        // Build the DI registrar. Awaiting before the using disposes it keeps the service provider (and its
        // singletons, e.g. the HttpClient meter factory) alive until the async command actually finishes.
        using var registrar = BuildRegistrar(configuration, loggerFactory);

        // The logger an unhandled exception is reported through.
        var crashLogger = loggerFactory.CreateLogger(typeof(CliRunner));

        // Run a command app whose default command is the supplied type.
        return await CliRunner.RunAsync(new CommandApp<TDefaultCommand>(registrar), args, crashLogger, configure);
    }

    /// <summary>
    /// Builds the configuration from the shared logging defaults, the tool's declared config files, its user secrets
    /// and its environment variables, each layer overriding the ones before it.
    /// </summary>
    /// <returns>The built configuration.</returns>
    private IConfiguration BuildConfiguration()
    {
        // Start from the tool's base directory so configuration is independent of the working directory.
        var configurationBuilder = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory);

        // Load the logging defaults every tool shares first, so every source loaded after them can override them.
        configurationBuilder.AddJsonFile("appsettings.logging.json", optional: false);

        // Load each declared config file, required and in call order.
        foreach (var configFile in _requiredConfigFiles)
            configurationBuilder.AddJsonFile(configFile, optional: false);

        // Layer the tool's user secrets and env vars on top.
        return configurationBuilder
            .AddUserSecrets(_userSecretsAssembly, optional: true)
            .AddEnvironmentVariables()
            .Build();
    }

    /// <summary>
    /// Creates the logger factory that writes to the console through <see cref="CliConsoleLoggerProvider"/>, at the
    /// levels and in the format the Logging section sets.
    /// </summary>
    /// <param name="configuration">The built configuration, whose Logging section configures the factory.</param>
    /// <returns>The logger factory, owned and disposed by the caller.</returns>
    private static ILoggerFactory CreateLoggerFactory(IConfiguration configuration) =>
        // A factory whose one provider is our console logger.
        LoggerFactory.Create(logging =>
        {
            // Log at the levels the Logging section sets.
            logging.AddConfiguration(configuration.GetSection("Logging"));

            // Write every entry to the console through our own logger.
            logging.Services.AddSingleton<ILoggerProvider, CliConsoleLoggerProvider>();

            // Bind the console logger's settings to the Logging section's Console part, which the provider's alias
            // names.
            LoggerProviderOptions.RegisterProviderOptions<CliConsoleLoggerSettings, CliConsoleLoggerProvider>(
                logging.Services);
        });

    /// <summary>
    /// Registers the shared services and the tool's own, and returns the registrar the command app resolves
    /// dependencies from.
    /// </summary>
    /// <param name="configuration">The built configuration, exposed to DI and handed to each tool registration.</param>
    /// <param name="loggerFactory">The logger factory every resolved logger comes from.</param>
    /// <returns>The dependency-injection registrar wrapping the configured service collection.</returns>
    private DependencyInjectionRegistrar BuildRegistrar(IConfiguration configuration, ILoggerFactory loggerFactory)
    {
        // Stand up the service collection.
        var services = new ServiceCollection();

        // Expose configuration to DI.
        services.AddSingleton(configuration);

        // Hand every logger out of the one factory.
        services.AddSingleton(loggerFactory);

        // Add the typed loggers. Logging's own registration only fills what is still missing, so the factory stays.
        services.AddLogging();

        // Apply each tool-specific registration against the built configuration.
        foreach (var configureServices in _serviceConfigurators)
            configureServices(services, configuration);

        // Wrap the collection in the registrar Spectre resolves commands and their dependencies from.
        return new DependencyInjectionRegistrar(services);
    }
}
