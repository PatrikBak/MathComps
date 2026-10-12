using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.ConversationReview;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.ConversationReview;

/// <summary>
/// A base for the suites over review notes against a real PostgreSQL database, starting from the conversations
/// <see cref="ReviewNoteSeed"/> writes, with the note services registered.
/// </summary>
/// <typeparam name="TService">The service the derived suite tests.</typeparam>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public abstract class ReviewNotePostgresTestBase<TService>(PostgresContainerFixture fixture)
    : PostgresTestBase<TService>(fixture) where TService : class
{
    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The bounds the feed cuts its page by, left at their defaults, which hold everything a test writes.
        services.AddPaginationOptions();

        // Writing, revising and settling the notes.
        services.AddScoped<IReviewNoteService, ReviewNoteService>();

        // The admin's feed of every note.
        services.AddScoped<IAdminNoteService, AdminNoteService>();

        // The display names an archive problem is named by.
        services.AddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();
    }

    /// <inheritdoc/>
    protected override Task SeedDataAsync(MathCompsDbContext context) =>
        // The conversations every suite over them starts from
        ReviewNoteSeed.SeedAsync(context);
}
