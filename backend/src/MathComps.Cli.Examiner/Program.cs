using MathComps.Cli.Examiner.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;

// Bootstrap the tool and run it — the examiner turn as the default command, plus the transcript rewind.
return await CliApp.Create<Program>("Examiner")
    .RequireConfigFile("appsettings.llm.json")
    .RequireConfigFile("appsettings.examiner.json")
    .ConfigureServices((services, configuration) =>
    {
        // The shared chat stack: settings, chat client, retrying caller, and spend tracker.
        services.AddLlmChat(configuration);

        // The examiner loop: its per-step model config plus the engine that runs generate → verify → revise.
        services.AddExaminer(configuration);
    })
    .RunAsync<ExaminerTurnCommand>(args, configurator =>
    {
        // The deterministic transcript rewind, for re-driving a conversation from an earlier point.
        configurator.AddCommand<StripTranscriptCommand>("strip");
    });
