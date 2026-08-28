using System.ClientModel;
using Clerk.BackendAPI;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Clerk;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Defense.Content;
using MathComps.Infrastructure.Services.Defense.Engine;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Users;
using MathComps.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using MathComps.Domain.Tagging;
using MathComps.Domain.Localization;
using OpenAI;

namespace MathComps.Infrastructure.Extensions;

/// <summary>
/// Registers the infrastructure layer's services into the DI container. Each feature lives in its own focused
/// <c>Add*</c> method that co-locates its options with the services that consume them, so a caller registers just
/// the slices it resolves.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Configures MathCompsDbContext with PostgreSQL using DbContextFactory.
    /// </summary>
    /// <param name="services">The service collection to add the DbContext to.</param>
    /// <param name="configuration">The application configuration containing connection string.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddMathCompsDbContext(
        this IServiceCollection services, IConfiguration configuration)
    {
        // Grab the connection string from the configuration
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        // Important to have it
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "Missing connection string 'ConnectionStrings:DefaultConnection'. Provide via user secrets for "
                + "development or environment variable 'ConnectionStrings__DefaultConnection' in production.");

        // Add Npgsql with all mapped enums using DbContextFactory
        // (see https://www.npgsql.org/efcore/mapping/enum.html?tabs=with-connection-string%2Cwith-datasource)
        services.AddDbContextFactory<MathCompsDbContext>(options =>
            options.UseNpgsql(connectionString,
                npgsqlOptions => npgsqlOptions
                    .MapEnum<TagType>("tag_type")
                    .MapEnum<DocumentType>("document_type")
                    .MapEnum<Language>("language")
                    .MapEnum<CommentStatus>("comment_status")
                    .MapEnum<TranscriptRole>("transcript_role")
                    .MapEnum<DefenseReportCategory>("defense_report_category")
                    .MapEnum<DefenseOutcome>("defense_outcome")
                    .MapEnum<ExaminerStep>("examiner_step")
            )
        );

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the metadata localization registry — the singleton that loads competition/topic metadata once and
    /// resolves it across languages.
    /// </summary>
    /// <param name="services">The service collection to add the localization service to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddLocalization(this IServiceCollection services)
    {
        // The options for localization
        services.AddOptions<LocalizationOptions>()
            .BindConfiguration(LocalizationOptions.ConfigurationSectionName);

        // Metadata localization service (singleton - loads data once)
        services.TryAddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the bounds every paged read cuts its page by, which is what keeps one request from asking for a
    /// whole table. Registered on its own because several features page and each of them needs the same bounds.
    /// </summary>
    /// <param name="services">The service collection to add the pagination options to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddPaginationOptions(this IServiceCollection services)
    {
        // The options for pagination, checked at startup so a bad bound fails fast
        services.AddOptions<PaginationOptions>()
            .BindConfiguration(PaginationOptions.ConfigurationSectionName)
            .Validate(
                options => options.DefaultPageSize > 0,
                $"{nameof(PaginationOptions.DefaultPageSize)} must be > 0.")
            .Validate(options => options.MaxPageSize > 0, $"{nameof(PaginationOptions.MaxPageSize)} must be > 0.")
            .Validate(
                options => options.MaxPageNumber > 0,
                $"{nameof(PaginationOptions.MaxPageNumber)} must be > 0.")
            // A default the server itself couldn't ask for is a contradiction between the two bounds
            .Validate(
                options => options.DefaultPageSize <= options.MaxPageSize,
                $"{nameof(PaginationOptions.DefaultPageSize)} must be <= "
                + $"{nameof(PaginationOptions.MaxPageSize)}.")
            // The furthest page these bounds allow still has to land on an offset a skip can hold, which is the
            // whole reason a page number is bounded at all. Worked out in long so the check itself can't be the
            // thing that overflows.
            .Validate(
                options => ((long)options.MaxPageNumber - 1) * options.MaxPageSize <= int.MaxValue,
                $"({nameof(PaginationOptions.MaxPageNumber)} - 1) * {nameof(PaginationOptions.MaxPageSize)} "
                + $"must be <= {int.MaxValue}.")
            .ValidateOnStart();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the problem catalog query services — filtering, lookup and images — plus the pagination and
    /// similarity options the filter reads. Pulls in <see cref="AddLocalization"/> since the filter reads the metadata
    /// registry. Expects the DbContext from <see cref="AddMathCompsDbContext"/>.
    /// </summary>
    /// <param name="services">The service collection to add the problem services to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddProblemServices(this IServiceCollection services)
    {
        // The filter cuts its page by the server's bounds
        services.AddPaginationOptions();

        // The options for similarity, checked at startup so bad thresholds fail fast
        services.AddOptions<SimilarityOptions>()
            .BindConfiguration(SimilarityOptions.ConfigurationSectionName)
            .Validate(
                options => options.MaxSimilarProblems >= 0,
                $"{nameof(SimilarityOptions.MaxSimilarProblems)} must be >= 0.")
            .Validate(
                options => options.MinSimilarityScore is >= 0 and <= 1,
                $"{nameof(SimilarityOptions.MinSimilarityScore)} must be between 0 and 1.")
            .ValidateOnStart();

        // The problem filter reads the metadata registry, so bring it along
        services.AddLocalization();

        // Problem catalog DB services
        services.TryAddScoped<IProblemFilterService, ProblemFilterService>();
        services.TryAddScoped<IProblemLookupService, ProblemLookupService>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the user account services — the user manager, the user's saved problems and lists, and comments.
    /// Pulls in <see cref="AddClerkApi"/> since the user manager reads upstream users through the Clerk client. Expects
    /// the DbContext from <see cref="AddMathCompsDbContext"/>.
    /// </summary>
    /// <param name="services">The service collection to add the user services to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddUserServices(this IServiceCollection services)
    {
        // The user manager reads upstream users through the Clerk client, so bring it along
        services.AddClerkApi();

        // User account DB services
        services.TryAddScoped<IUserManager, UserManager>();
        services.TryAddScoped<IUserProblemService, UserProblemService>();
        services.TryAddScoped<IUserListService, UserListService>();
        services.TryAddScoped<ICommentService, CommentService>();

        // The list service resolves problem slugs, so make sure the lookup is available
        services.TryAddScoped<IProblemLookupService, ProblemLookupService>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the Clerk backend API client and its settings — the client used to read upstream users from Clerk.
    /// </summary>
    /// <param name="services">The service collection to add the Clerk client to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddClerkApi(this IServiceCollection services)
    {
        // Clerk settings
        services.AddOptions<ClerkSettings>()
            .BindConfiguration(ClerkSettings.SectionName);

        // Clerk API Client
        services.TryAddScoped(serviceProvider =>
        {
            // Parse out the secret key
            var secretKey = serviceProvider.GetRequiredService<IOptions<ClerkSettings>>().Value.SecretKey;

            // Make sure the key is fine
            if (string.IsNullOrWhiteSpace(secretKey))
                throw new InvalidOperationException("Clerk secret key is required.");

            // Return the Clerk API client
            return new ClerkBackendApi(bearerAuth: secretKey);
        });

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the Clerk webhook handler that syncs incoming user events into the database, and requires the webhook
    /// secret it verifies signatures with. Kept out of <see cref="AddClerkApi"/> so resolving the Clerk client doesn't
    /// force a webhook secret; depends on the user manager from <see cref="AddUserServices"/>.
    /// </summary>
    /// <param name="services">The service collection to add the webhook handler to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddClerkWebhook(this IServiceCollection services)
    {
        // The handler verifies incoming signatures with this secret, so require it
        services.AddOptions<ClerkSettings>()
            .BindConfiguration(ClerkSettings.SectionName)
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.WebhookSecret),
                $"{nameof(ClerkSettings.WebhookSecret)} is required.");

        // Webhook handler turning Clerk user events into DB writes
        services.TryAddScoped<IClerkWebhookService, ClerkWebhook>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the R2 object-storage uploader and reader with their shared settings. Settings are validated
    /// lazily so config is only required when storage is actually reached for.
    /// </summary>
    /// <param name="services">The service collection to add the uploader to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddStorage(this IServiceCollection services)
    {
        // R2 storage settings
        services.AddOptions<R2Settings>()
            .BindConfiguration(R2Settings.SectionName)
            .ValidateDataAnnotations();

        // R2 uploader backing image uploads
        services.TryAddSingleton<IFileUploader, R2Uploader>();

        // R2 reader backing the content the API serves itself from
        services.TryAddSingleton<IObjectReader, R2ObjectReader>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Wraps the registered <see cref="IFileUploader"/> in the deduping <see cref="TrackedFileUploader"/> and exposes
    /// that one instance as <see cref="ITrackedFileUploader"/>. The tracker keeps a ledger at
    /// <paramref name="ledgerPath"/> so a re-run skips assets whose bytes are already on R2. Call after
    /// <see cref="AddStorage"/>, which registers the uploader being decorated.
    /// </summary>
    /// <param name="services">The service collection to add the tracking uploader to.</param>
    /// <param name="ledgerPath">
    /// Path of the upload ledger, kept across runs beside the tool's sources (gitignored).</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddTrackedFileUploader(
        this IServiceCollection services, string ledgerPath)
    {
        // Where the dedupe ledger lives
        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(
            new UploadLedgerOptions { LedgerPath = ledgerPath }));

        // Decorate wraps the registered uploader in the tracker
        services.Decorate<IFileUploader, TrackedFileUploader>();

        // Expose that one decorated instance as the tracked uploader
        services.AddSingleton(provider => (ITrackedFileUploader)provider.GetRequiredService<IFileUploader>());

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the read-only draft resolution service that backs the bulk-import create-vs-reuse preview. Expects the
    /// DbContext from <see cref="AddMathCompsDbContext"/>.
    /// </summary>
    /// <param name="services">The service collection to add the bulk-import service to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddBulkImport(this IServiceCollection services)
    {
        // Read-only DB-resolution service backing the import preview
        services.TryAddScoped<IDraftResolutionService, DraftResolutionService>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the shared chat stack: the connection settings, one shared chat client, the retrying
    /// structured-completion caller, and the process's spend tally. The API key is required (from user secrets); the
    /// base URL comes from configuration. Each call names its own model.
    /// </summary>
    /// <param name="services">The service collection to add the chat stack to.</param>
    /// <param name="configuration">The application configuration carrying the <c>Llm</c> section.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddLlmChat(this IServiceCollection services, IConfiguration configuration)
    {
        // The connection: base URL from appsettings, API key from user secrets.
        services.AddOptions<LlmSettings>()
            .Bind(configuration.GetSection(LlmSettings.SectionName))
            .Validate(settings => !string.IsNullOrWhiteSpace(settings.ApiKey),
                $"{LlmSettings.SectionName}:{nameof(LlmSettings.ApiKey)} is not configured. Set it in user secrets.")
            .ValidateDataAnnotations();

        // One connection for the whole run, pointed at the configured OpenAI-compatible endpoint.
        services.TryAddSingleton(serviceProvider =>
        {
            // Pull the connection settings.
            var settings = serviceProvider.GetRequiredService<IOptions<LlmSettings>>().Value;

            // Build the OpenAI client against the configured endpoint.
            return new OpenAIClient(
                new ApiKeyCredential(settings.ApiKey),
                new OpenAIClientOptions { Endpoint = new Uri(settings.BaseUrl) });
        });

        // The retrying structured-completion caller every chat consumer drives.
        services.TryAddSingleton<ILlmChatCaller, LlmChatCaller>();

        // Tallies the process's own spend so a run can report exactly what it cost.
        services.TryAddSingleton<ILlmSpendTracker, LlmSpendTracker>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the examiner: its per-step model configuration plus the engine that runs the generate → verify →
    /// revise loop. When <c>Examiner:UseFake</c> is set, the zero-cost <see cref="FakeExaminer"/> is registered
    /// instead of the real one, so the whole path can run without spending tokens. Assumes the chat stack is
    /// registered (see <see cref="AddLlmChat"/>).
    /// </summary>
    /// <param name="services">The service collection to add the examiner to.</param>
    /// <param name="configuration">The application configuration carrying the <c>Examiner</c> section.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddExaminer(this IServiceCollection services, IConfiguration configuration)
    {
        // The examiner loop config: the model knob for each step plus the revision cap. Validated at startup —
        // without ValidateOnStart, options validation is lazy and a broken section would only surface on the
        // first turn.
        services.AddOptions<ExaminerSettings>()
            .Bind(configuration.GetSection(ExaminerSettings.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // The examiner's config snapshot for a new session, read from disk and serialized once per process.
        services.TryAddSingleton<IExaminerConfigSnapshotProvider, ExaminerConfigSnapshotProvider>();

        // Whether this run uses the zero-cost fake engine.
        var useFake = configuration.GetValue<bool>($"{ExaminerSettings.SectionName}:UseFake");

        // Register whichever engine the flag selects, tolerating a double call (e.g. a host that wires the
        // examiner directly and the defense feature) rather than stacking a duplicate registration.
        if (useFake)
            services.TryAddScoped<IExaminer>(_ => new FakeExaminer());
        else
            services.TryAddScoped<IExaminer, Examiner>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the defense feature: the examiner engine, the input/turn/spend caps, the per-user turn gate, the
    /// lookup of what the examiner is told about a problem, her own localized lines, the guard saying whether a
    /// student may argue a given target, the service that runs and persists defense conversations, and the service
    /// that records the students' feedback on them. Assumes the chat stack is registered (see
    /// <see cref="AddLlmChat"/>) and, since the problem content is read back out of object storage, that
    /// <see cref="AddStorage"/> has run.
    /// </summary>
    /// <param name="services">The service collection to add the defense feature to.</param>
    /// <param name="configuration">The application configuration carrying the <c>Examiner</c>,
    /// <c>DefenseLimits</c> and <c>DefenseContent</c> sections.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddDefenseServices(this IServiceCollection services, IConfiguration configuration)
    {
        // The engine that produces the examiner's replies.
        services.AddExaminer(configuration);

        // The input, turn, and spend caps, validated at startup like the examiner's config.
        services.AddOptions<DefenseLimits>()
            .Bind(configuration.GetSection(DefenseLimits.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // How long the published handout content is trusted between revalidations.
        services.AddOptions<DefenseContentOptions>()
            .Bind(configuration.GetSection(DefenseContentOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // The app's in-memory cache, pulled in here because the handout resolver below caches its reads in one.
        services.AddMemoryCache();

        // Resolves what the examiner is told, from whichever source the defense's target names.
        services.TryAddSingleton<IHandoutDefenseContentResolver, HandoutDefenseContentResolver>();
        services.TryAddSingleton<IProblemDefenseContentResolver, ProblemDefenseContentResolver>();
        services.TryAddSingleton<IDefenseContentResolver, DefenseContentResolver>();

        // The examiner's own lines, read from disk once; a singleton for the same reason.
        services.TryAddSingleton<IDefenseCopy, DefenseCopy>();

        // Serializes a user's concurrent turns; shared process-wide, so a singleton.
        services.TryAddSingleton<IDefenseUserTurnGate, DefenseUserTurnGate>();

        // The service that runs and persists defense conversations.
        services.TryAddScoped<IDefenseSessionService, DefenseSessionService>();

        // The service that records what students thought of those conversations.
        services.TryAddScoped<IDefenseFeedbackService, DefenseFeedbackService>();

        // Says whether a student may argue what a defense target names.
        services.TryAddScoped<IDefenseTargetGuard, DefenseTargetGuard>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the competitions the site hosts itself: the service backing what a student sees of them and what
    /// they do with an entry. Pulls in <see cref="AddLocalization"/> since a competition's name is read from the
    /// taxonomy metadata. Assumes the defense caps are registered (see <see cref="AddDefenseServices"/>), since a
    /// competition reports how many turns a defense allows. Registers the terms a hosted competition runs on,
    /// and expects the DbContext from <see cref="AddMathCompsDbContext"/>.
    /// </summary>
    /// <param name="services">The service collection to add the competition services to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddCompetitionServices(this IServiceCollection services)
    {
        // A competition is named after the node it runs under, so bring the metadata registry along.
        services.AddLocalization();

        // The terms a hosted competition runs on, checked at startup so a bad window fails fast.
        services.AddOptions<HostedCompetitionOptions>()
            .BindConfiguration(HostedCompetitionOptions.ConfigurationSectionName)
            .Validate(
                options => options.NoteGraceMinutes >= 0,
                $"{nameof(HostedCompetitionOptions.NoteGraceMinutes)} must be >= 0.")
            .ValidateOnStart();

        // Runs the competitions the site hosts itself.
        services.TryAddScoped<IHostedCompetitionService, HostedCompetitionService>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Adds the admin-only review of defense conversations: reading every student's conversations back,
    /// recording which have been read, and keeping the notes written about them.
    /// </summary>
    /// <param name="services">The service collection to add the review feature to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddAdminServices(this IServiceCollection services)
    {
        // Both the queue and the notes feed are read a page at a time, by the server's bounds.
        services.AddPaginationOptions();

        // The service that reads every student's conversations back and records which have been read.
        services.TryAddScoped<IAdminDefenseReviewService, AdminDefenseReviewService>();

        // The service that keeps what gets written down about them.
        services.TryAddScoped<IAdminNoteService, AdminNoteService>();

        // Builder pattern
        return services;
    }
}
