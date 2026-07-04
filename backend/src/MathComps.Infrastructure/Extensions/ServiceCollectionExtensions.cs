using System.ClientModel;
using Clerk.BackendAPI;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.BulkImport;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Clerk;
using MathComps.Infrastructure.Services.Comments;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Problems;
using MathComps.Infrastructure.Services.Users;
using MathComps.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using MathComps.Domain.Tagging;
using MathComps.Domain.Localization;
using OpenAI;
using OpenAI.Chat;

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
    public static IServiceCollection AddMathCompsDbContext(this IServiceCollection services, IConfiguration configuration)
    {
        // Grab the connection string from the configuration
        var connectionString = configuration.GetConnectionString("DefaultConnection");

        // Important to have it
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("Missing connection string 'ConnectionStrings:DefaultConnection'. Provide via user secrets for development or environment variable 'ConnectionStrings__DefaultConnection' in production.");

        // Add Npgsql with all mapped enums using DbContextFactory
        // (see https://www.npgsql.org/efcore/mapping/enum.html?tabs=with-connection-string%2Cwith-datasource)
        services.AddDbContextFactory<MathCompsDbContext>(options =>
            options.UseNpgsql(connectionString,
                npgsqlOptions => npgsqlOptions
                    .MapEnum<TagType>("tag_type")
                    .MapEnum<DocumentType>("document_type")
                    .MapEnum<Language>("language")
                    .MapEnum<CommentStatus>("comment_status")
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
    /// Registers the problem catalog query services — filtering, lookup and images — plus the pagination and
    /// similarity options the filter reads. Pulls in <see cref="AddLocalization"/> since the filter reads the metadata
    /// registry. Expects the DbContext from <see cref="AddMathCompsDbContext"/>.
    /// </summary>
    /// <param name="services">The service collection to add the problem services to.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddProblemServices(this IServiceCollection services)
    {
        // The options for pagination
        services.AddOptions<PaginationOptions>()
            .BindConfiguration(PaginationOptions.ConfigurationSectionName)
            .Validate(options => options.MaxPageSize > 0, $"{nameof(PaginationOptions.MaxPageSize)} must be > 0.");

        // The options for similarity
        services.AddOptions<SimilarityOptions>()
            .BindConfiguration(SimilarityOptions.ConfigurationSectionName)
            .Validate(options => options.MaxSimilarProblems >= 0, $"{nameof(SimilarityOptions.MaxSimilarProblems)} must >= 0.")
            .Validate(options => options.MinSimilarityScore is >= 0 and <= 1, $"{nameof(SimilarityOptions.MinSimilarityScore)} must be between 0 and 1.");

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
            .Validate(options => !string.IsNullOrWhiteSpace(options.WebhookSecret), $"{nameof(ClerkSettings.WebhookSecret)} is required.");

        // Webhook handler turning Clerk user events into DB writes
        services.TryAddScoped<IClerkWebhookService, ClerkWebhook>();

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Registers the R2 object-storage uploader and its settings. Settings are validated lazily so config is only
    /// required when an upload actually runs.
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

        // Builder pattern
        return services;
    }

    /// <summary>
    /// Wraps the registered <see cref="IFileUploader"/> in the deduping <see cref="TrackedFileUploader"/> and exposes
    /// that one instance as <see cref="ITrackedFileUploader"/>. The tracker keeps a ledger at <paramref name="ledgerPath"/>
    /// so a re-run skips assets whose bytes are already on R2. Call after <see cref="AddStorage"/>, which registers the
    /// uploader being decorated.
    /// </summary>
    /// <param name="services">The service collection to add the tracking uploader to.</param>
    /// <param name="ledgerPath">Path of the upload ledger, kept across runs beside the tool's sources (gitignored).</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddTrackedFileUploader(this IServiceCollection services, string ledgerPath)
    {
        // Where the dedupe ledger lives
        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(new UploadLedgerOptions { LedgerPath = ledgerPath }));

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
    /// Registers the OpenRouter chat stack: the connection settings, one chat client bound to the default model, the
    /// retrying structured-completion caller, and the spend reader. The API key is required (from user secrets); the
    /// base URL and default model come from configuration.
    /// </summary>
    /// <param name="services">The service collection to add the chat stack to.</param>
    /// <param name="configuration">The application configuration carrying the <c>OpenRouter</c> section.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddOpenRouterChat(this IServiceCollection services, IConfiguration configuration)
    {
        // The connection: base URL + default model from appsettings, API key from user secrets.
        services.AddOptions<OpenRouterSettings>()
            .Bind(configuration.GetSection(OpenRouterSettings.SectionName))
            .Validate(settings => !string.IsNullOrWhiteSpace(settings.ApiKey),
                $"{OpenRouterSettings.SectionName}:{nameof(OpenRouterSettings.ApiKey)} is not configured. Set it in user secrets.")
            .ValidateDataAnnotations();

        // One chat client for the whole run, pointed at OpenRouter's OpenAI-compatible endpoint and bound to the
        // configured default model; a per-call model override rides on ChatOptions.ModelId.
        services.TryAddSingleton(serviceProvider =>
        {
            // Pull the connection settings.
            var settings = serviceProvider.GetRequiredService<IOptions<OpenRouterSettings>>().Value;

            // Build the OpenAI client against OpenRouter's endpoint, bound to the configured default model.
            var chatClient = new ChatClient(
                settings.Model,
                new ApiKeyCredential(settings.ApiKey),
                new OpenAIClientOptions { Endpoint = new Uri(settings.BaseUrl) });

            // Expose it through the Microsoft.Extensions.AI abstraction the caller depends on.
            return chatClient.AsIChatClient();
        });

        // The retrying structured-completion caller every chat consumer drives.
        services.TryAddSingleton<IOpenRouterChatCaller, OpenRouterChatCaller>();

        // Reads the key's all-time spend so a run can report what it cost.
        services.AddHttpClient<IOpenRouterUsageReader, OpenRouterUsageReader>();

        // Builder pattern
        return services;
    }
}
