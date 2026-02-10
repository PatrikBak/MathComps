using Clerk.BackendAPI;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace MathComps.Infrastructure;

/// <summary>
/// Provides extension methods for setting up dependency injection for infrastructure services.
/// </summary>
public static class DependencyInjectionHelpers
{
    /// <summary>
    /// Adds services that use DB, with their options.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add the services to.</param>
    /// <returns>The <see cref="IServiceCollection"/> so that additional calls can be chained.</returns>
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
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

        // The options for localization
        services.AddOptions<LocalizationOptions>()
            .BindConfiguration(LocalizationOptions.ConfigurationSectionName);

        // Gemini API settings
        services.AddOptions<GeminiSettings>()
            .BindConfiguration(GeminiSettings.SectionName)
            .Validate(options => options.TimeoutSeconds > 0, $"{nameof(GeminiSettings.TimeoutSeconds)} must be > 0.")
            .ValidateDataAnnotations();

        // Clerk settings
        services.AddOptions<ClerkSettings>()
            .BindConfiguration(ClerkSettings.SectionName)
            .Validate(options => !string.IsNullOrWhiteSpace(options.WebhookSecret), $"{nameof(ClerkSettings.WebhookSecret)} is required.");

        // Gemini service with HttpClient
        services.AddHttpClient<IGeminiService, GeminiService>(client =>
        {
            // Set infinite timeout on HttpClient so the timeout is controlled by CancellationToken in the service
            client.Timeout = Timeout.InfiniteTimeSpan;
        });

        // Metadata localization service (singleton - loads data once)
        services.AddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();

        // DB service
        services.AddScoped<IProblemFilterService, ProblemFilterService>();
        services.AddScoped<IProblemLookupService, ProblemLookupService>();
        services.AddScoped<IUserManager, UserManager>();
        services.AddScoped<IUserProblemService, UserProblemService>();
        services.AddScoped<IUserListService, UserListService>();
        services.AddScoped<IClerkWebhookService, ClerkWebhook>();
        services.AddScoped<ICommentService, CommentService>();
        services.AddScoped<IProblemImageService, ProblemImageService>();

        // Clerk API Client
        services.AddScoped(serviceProvider =>
        {
            // Parse out the secret key
            var secretKey = serviceProvider.GetRequiredService<IOptions<ClerkSettings>>().Value.SecretKey;

            // Make sure the key is fine
            if (string.IsNullOrWhiteSpace(secretKey))
                throw new InvalidOperationException("Clerk secret key is required.");

            // Return the Clerk API client
            return new ClerkBackendApi(bearerAuth: secretKey);
        });

        // Return the services for chaining
        return services;
    }
}
