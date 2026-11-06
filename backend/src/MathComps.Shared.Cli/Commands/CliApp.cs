using System.Reflection;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Console;
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
    /// Tool-specific registrations, each handed the built configuration so it can bind options and
    /// resolve connection strings.
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
    /// Declares a JSON config file the tool requires. Each must be present — a missing one fails at startup rather
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
    /// <param name="args">Command-line arguments forwarded from <c>Program.cs</c>.</param>
    /// <param name="configure">Optionally registers additional commands on the Spectre configurator.</param>
    /// <returns>The process exit code: 0 on success, 1 on an unhandled exception.</returns>
    public async Task<int> RunAsync<TDefaultCommand>(string[] args, Action<IConfigurator>? configure = null)
        where TDefaultCommand : class, ICommand
    {
        // Build the DI registrar through the shared bootstrap. Awaiting before the using disposes it keeps the
        // service provider (and its singletons, e.g. the HttpClient meter factory) alive until the async command
        // actually finishes, and disposing it writes out the log lines the console logger still holds.
        using var registrar = BuildRegistrar();

        // Run a command app whose default command is the supplied type.
        return await CliRunner.RunAsync(new CommandApp<TDefaultCommand>(registrar), args, configure);
    }

    /// <summary>
    /// Runs the shared bootstrap (console setup, configuration, logging, and service registration) and returns the
    /// registrar the command app resolves dependencies from.
    /// </summary>
    /// <returns>The dependency-injection registrar wrapping the configured service collection.</returns>
    private DependencyInjectionRegistrar BuildRegistrar()
    {
        // Force UTF-8 so diacritics (e.g. Slovak) render even where the default console code page can't.
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        // Redirected output is a file something else reads back, and Spectre wraps it to 80 columns, which splits
        // every long line into continuation lines the reader has no way to rejoin. A terminal keeps its own width.
        if (Console.IsOutputRedirected)
            AnsiConsole.Profile.Width = 10_000;

        // Start from the tool's base directory so configuration is independent of the working directory.
        var configurationBuilder = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory);

        // Load the logging defaults every tool shares first, so every source loaded after them can override them.
        configurationBuilder.AddJsonFile("appsettings.logging.json", optional: false);

        // Load each declared config file, required and in call order.
        foreach (var configFile in _requiredConfigFiles)
            configurationBuilder.AddJsonFile(configFile, optional: false);

        // Layer the tool's user secrets and env vars on top.
        var configuration = configurationBuilder
            .AddUserSecrets(_userSecretsAssembly, optional: true)
            .AddEnvironmentVariables()
            .Build();

        // Stand up the service collection.
        var services = new ServiceCollection();

        // Expose configuration to DI.
        services.AddSingleton<IConfiguration>(configuration);

        // Redirected output gets one line per log entry, which a reader parses line by line, and a terminal gets the
        // two-line form. Registered ahead of the logging setup, so the Logging section can still override it.
        services.Configure<SimpleConsoleFormatterOptions>(options => options.SingleLine = Console.IsOutputRedirected);

        // Log to the console at the levels and in the format the Logging section sets.
        services.AddLogging(logging => logging
            .AddConfiguration(configuration.GetSection("Logging"))
            .AddConsole());

        // Apply each tool-specific registration against the built configuration.
        foreach (var configureServices in _serviceConfigurators)
            configureServices(services, configuration);

        // Wrap the collection in the registrar Spectre resolves commands and their dependencies from.
        return new DependencyInjectionRegistrar(services);
    }
}
