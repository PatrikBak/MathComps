using System.Reflection;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Spectre.Console;
using Spectre.Console.Cli;
using Spectre.Console.Cli.Extensions.DependencyInjection;

namespace MathComps.Shared.Cli.Commands;

/// <summary>
/// Fluent bootstrap shared by every CLI tool: it renders the banner, builds the standard
/// appsettings/user-secrets/environment configuration, wires up dependency injection, and hands the
/// resulting command app to <see cref="CliRunner"/>. Tools supply only their banner text, their own
/// service registrations, and their command list.
/// </summary>
public sealed class CliApp
{
    /// <summary>
    /// The tool's banner text.
    /// </summary>
    private readonly string _bannerText;

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
    /// Initializes a new bootstrap for a single tool.
    /// </summary>
    /// <param name="bannerText">The tool's banner text.</param>
    /// <param name="userSecretsAssembly">The tool's entry assembly, anchoring its user-secrets store.</param>
    private CliApp(string bannerText, Assembly userSecretsAssembly)
    {
        // Stash the banner and the assembly that owns the secrets; configuration is built later, at run time.
        _bannerText = bannerText;
        _userSecretsAssembly = userSecretsAssembly;
    }

    /// <summary>
    /// Begins bootstrapping a tool, anchoring user secrets to the assembly that declares
    /// <typeparamref name="TProgram"/> so each tool keeps its own secret store.
    /// </summary>
    /// <typeparam name="TProgram">The tool's <c>Program</c> type, used to locate its entry assembly.</typeparam>
    /// <param name="bannerText">The tool's banner text.</param>
    /// <returns>The bootstrap, for fluent chaining.</returns>
    public static CliApp Create<TProgram>(string bannerText) =>
        new(bannerText, typeof(TProgram).Assembly);

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
    /// Bootstraps and runs a multi-command tool, registering its commands through
    /// <paramref name="configure"/>.
    /// </summary>
    /// <param name="args">Command-line arguments forwarded from <c>Program.cs</c>.</param>
    /// <param name="configure">Registers the tool's commands on the Spectre configurator.</param>
    /// <returns>The process exit code: 0 on success, 1 on an unhandled exception.</returns>
    public async Task<int> RunAsync(string[] args, Action<IConfigurator>? configure = null)
    {
        // Build the DI registrar through the shared bootstrap. Awaiting before the using disposes it keeps the
        // service provider (and its singletons, e.g. the HttpClient meter factory) alive until the async command
        // actually finishes.
        using var registrar = BuildRegistrar();

        // Run a command app with no compile-time default command.
        return await CliRunner.RunAsync(new CommandApp(registrar), args, configure);
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
        // actually finishes.
        using var registrar = BuildRegistrar();

        // Run a command app whose default command is the supplied type.
        return await CliRunner.RunAsync(new CommandApp<TDefaultCommand>(registrar), args, configure);
    }

    /// <summary>
    /// Runs the shared bootstrap — console encoding, banner, configuration, and service registration —
    /// and returns the registrar the command app resolves dependencies from.
    /// </summary>
    /// <returns>The dependency-injection registrar wrapping the configured service collection.</returns>
    private DependencyInjectionRegistrar BuildRegistrar()
    {
        // Force UTF-8 so diacritics (e.g. Slovak) render even where the default console code page can't.
        Console.InputEncoding = Encoding.UTF8;
        Console.OutputEncoding = Encoding.UTF8;

        // Render the tool's banner.
        AnsiConsole.Write(new FigletText(_bannerText).Centered().Color(Color.Aqua));

        // Build configuration from appsettings.json (optional), the tool's user secrets, and env vars.
        // Anchoring on AppContext.BaseDirectory keeps this independent of the working directory.
        var configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets(_userSecretsAssembly, optional: true)
            .AddEnvironmentVariables()
            .Build();

        // Stand up the service collection.
        var services = new ServiceCollection();

        // Expose configuration to DI.
        services.AddSingleton<IConfiguration>(configuration);

        // Apply each tool-specific registration against the built configuration.
        foreach (var configureServices in _serviceConfigurators)
            configureServices(services, configuration);

        // Wrap the collection in the registrar Spectre resolves commands and their dependencies from.
        return new DependencyInjectionRegistrar(services);
    }
}
