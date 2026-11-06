using MathComps.Cli.Examiner.Commands;
using MathComps.Infrastructure.Extensions;
using MathComps.Shared.Cli.Commands;

// Bootstrap the tool and run it, with the examiner turn as the default command.
return await CliApp.Create<Program>()
    .RequireConfigFile("appsettings.llm.json")
    .RequireConfigFile("appsettings.examiner.json")
    .RequireConfigFile("appsettings.photo-reader.json")
    .ConfigureServices((services, configuration) =>
    {
        // The shared chat stack: settings, chat client, retrying caller, and spend tracker.
        services.AddLlmChat(configuration);

        // The examiner loop: its per-step model config plus the engine that runs generate → verify → revise.
        services.AddExaminer(configuration);

        // The photo reader: the page's text and its drawings out of a photo of a handwritten page.
        services.AddPhotoReader(configuration);
    })
    .RunAsync<ExaminerTurnCommand>(args, configurator =>
    {
        // Every guard over a reply already written, generating nothing.
        configurator.AddCommand<ExaminerCheckCommand>("check");

        // The deterministic transcript rewind, for re-driving a conversation from an earlier point.
        configurator.AddCommand<StripTranscriptCommand>("strip");

        // The reading of photographed pages, for trying a model or prompt on real photos.
        configurator.AddCommand<ReadPhotoCommand>("read-photo");
    });
