using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.ConversationReview;

/// <summary>
/// A base for the suites over reviewing defense conversations against a real PostgreSQL database, starting from the
/// conversations <see cref="ConversationReviewSeed"/> writes and registering the services those suites resolve.
/// </summary>
/// <typeparam name="TService">The service the derived suite tests.</typeparam>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public abstract class ConversationReviewPostgresTestBase<TService>(PostgresContainerFixture fixture)
    : PostgresTestBase<TService>(fixture) where TService : class
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The bounds the queue cuts its page by, left at their defaults, which hold the whole seed.
        services.AddPaginationOptions();

        // The reader of who prepares competitions.
        services.AddUserGrants();

        // The admin's queue over the conversations.
        services.AddScoped<IAdminDefenseReviewService, AdminDefenseReviewService>();

        // Reading one conversation back and marking how far it has been read.
        services.AddScoped<IConversationReviewService, ConversationReviewService>();

        // Writing notes, which several of the queue's marks are read off.
        services.AddScoped<IReviewNoteService, ReviewNoteService>();

        // The display names an archive problem is named by.
        services.AddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();
    }

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // The conversations every suite over them starts from
        ConversationReviewSeed.SeedAsync(context);
}
