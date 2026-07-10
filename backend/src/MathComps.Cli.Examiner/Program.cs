using MathComps.Cli.Examiner.Commands;
using MathComps.Cli.Examiner.Engine;
using MathComps.Cli.Examiner.Settings;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;
using Microsoft.Extensions.DependencyInjection;

// Bootstrap the tool and run it — the examiner turn as the default command, plus the transcript rewind.
return await CliApp.Create<Program>("Examiner")
    .RequireConfigFile("appsettings.openrouter.json")
    .RequireConfigFile("appsettings.json")
    .ConfigureServices((services, configuration) =>
    {
        // The examiner loop config: the model knob for each step plus the revision cap.
        services.AddOptions<ExaminerSettings>()
            .Bind(configuration.GetSection(ExaminerSettings.SectionName))
            .ValidateDataAnnotations();

        // The OpenRouter chat stack: settings, chat client, retrying caller, and spend tracker.
        services.AddOpenRouterChat(configuration);

        // The engine that runs the per-turn generate → verify → revise loop.
        services.AddScoped<IExaminer, Examiner>();
    })
    .RunAsync<ExaminerTurnCommand>(args, configurator =>
    {
        // The deterministic transcript rewind, for re-driving a conversation from an earlier point.
        configurator.AddCommand<StripTranscriptCommand>("strip");
    });
