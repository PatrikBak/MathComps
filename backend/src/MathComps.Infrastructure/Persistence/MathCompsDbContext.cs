using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace MathComps.Infrastructure.Persistence;

/// <summary>
/// Entity Framework Core DbContext for MathComps (PostgreSQL).
/// Configures keys, indexes, relationships, delete behaviors, and database constraints.
/// </summary>
/// <param name="options">DbContext options provided via dependency injection.</param>
public class MathCompsDbContext(DbContextOptions<MathCompsDbContext> options) : DbContext(options)
{
    #region DbSets

    /// <summary>Problems (core content).</summary>
    public DbSet<Problem> Problems => Set<Problem>();

    /// <summary>Competitions (like CZ/SK MO, IMO).</summary>
    public DbSet<Competition> Competitions => Set<Competition>();

    /// <summary>Round instances (combinations of rounds with seasons).</summary>
    public DbSet<RoundInstance> RoundInstances => Set<RoundInstance>();

    /// <summary>Universal seasons (e.g., 2024/2025) used as the primary timeline.</summary>
    public DbSet<Season> Seasons => Set<Season>();

    /// <summary>Rounds owned by a competition, ordered within that competition.</summary>
    public DbSet<Round> Rounds => Set<Round>();

    /// <summary>Authors of problems (ordered per problem via join).</summary>
    public DbSet<Author> Authors => Set<Author>();

    /// <summary>Join table for problem–author ordering.</summary>
    public DbSet<ProblemAuthor> ProblemAuthors => Set<ProblemAuthor>();

    /// <summary>Freeform tags for problems (topic/technique).</summary>
    public DbSet<Tag> Tags => Set<Tag>();

    /// <summary>Grades for problems (age/level categories like A/B/C).</summary>
    public DbSet<Category> Categories => Set<Category>();

    /// <summary>Tags for problems.</summary>
    public DbSet<ProblemTag> ProblemTags => Set<ProblemTag>();

    /// <summary>Similarity links between problems.</summary>
    public DbSet<ProblemSimilarity> ProblemSimilarities => Set<ProblemSimilarity>();

    /// <summary>Embeddings for problems.</summary>
    public DbSet<ProblemEmbedding> ProblemEmbeddings => Set<ProblemEmbedding>();

    /// <summary>Texts (statements and solutions) for problems in various languages.</summary>
    public DbSet<ProblemText> ProblemTexts => Set<ProblemText>();

    /// <summary>Users synced from Clerk.</summary>
    public DbSet<User> Users => Set<User>();

    /// <summary>Likes on problems by users.</summary>
    public DbSet<ProblemLike> ProblemLikes => Set<ProblemLike>();

    /// <summary>Mark statuses on problems by users.</summary>
    public DbSet<ProblemMarkStatus> ProblemMarkStatuses => Set<ProblemMarkStatus>();

    /// <summary>Comments on content.</summary>
    public DbSet<Comment> Comments => Set<Comment>();

    /// <summary>Likes on comments.</summary>
    public DbSet<CommentLike> CommentLikes => Set<CommentLike>();

    /// <summary>Join table: comments on problems.</summary>
    public DbSet<ProblemComment> ProblemComments => Set<ProblemComment>();

    /// <summary>Join table: comments on handouts.</summary>
    public DbSet<HandoutComment> HandoutComments => Set<HandoutComment>();

    /// <summary>Join table: comments on news articles.</summary>
    public DbSet<NewsArticleComment> NewsArticleComments => Set<NewsArticleComment>();

    /// <summary>Anchor entity for file-based handouts.</summary>
    public DbSet<Handout> Handouts => Set<Handout>();

    /// <summary>Anchor entity for one environment within a file-based handout.</summary>
    public DbSet<HandoutEnvironment> HandoutEnvironments => Set<HandoutEnvironment>();

    /// <summary>Which environment a defense session defends.</summary>
    public DbSet<HandoutEnvironmentDefense> HandoutEnvironmentDefenses => Set<HandoutEnvironmentDefense>();

    /// <summary>Anchor entity for news articles.</summary>
    public DbSet<NewsArticle> NewsArticles => Set<NewsArticle>();

    /// <summary>User-defined problem lists.</summary>
    public DbSet<UserProblemList> UserProblemLists => Set<UserProblemList>();

    /// <summary>Join table: problems in user lists.</summary>
    public DbSet<UserProblemListItem> UserProblemListItems => Set<UserProblemListItem>();

    /// <summary>AI-examiner defense conversations.</summary>
    public DbSet<DefenseSession> DefenseSessions => Set<DefenseSession>();

    /// <summary>Turns within a defense conversation.</summary>
    public DbSet<DefenseTurn> DefenseTurns => Set<DefenseTurn>();

    /// <summary>Replies the examiner drafted on its way to a turn.</summary>
    public DbSet<DefenseTurnAttempt> DefenseTurnAttempts => Set<DefenseTurnAttempt>();

    /// <summary>Model calls the drafts were made by.</summary>
    public DbSet<DefenseAttemptCall> DefenseAttemptCalls => Set<DefenseAttemptCall>();

    /// <summary>Per-turn examiner spend.</summary>
    public DbSet<DefenseSpend> DefenseSpends => Set<DefenseSpend>();

    /// <summary>Student reports on individual examiner replies.</summary>
    public DbSet<DefenseTurnReport> DefenseTurnReports => Set<DefenseTurnReport>();

    /// <summary>What students said about their defense conversations.</summary>
    public DbSet<DefenseSessionFeedback> DefenseSessionFeedbacks => Set<DefenseSessionFeedback>();

    /// <summary>What was written down while reviewing defense conversations.</summary>
    public DbSet<AdminNote> AdminNotes => Set<AdminNote>();

    /// <summary>When defense conversations were last read while reviewing.</summary>
    public DbSet<AdminSessionReview> AdminSessionReviews => Set<AdminSessionReview>();

    #endregion DbSets

    #region OnConfiguring

    /// <summary>
    /// Apply provider-wide options. We intentionally apply snake_case naming so
    /// database identifiers (tables, columns, indexes, FKs) default to snake_case
    /// even if the convention wasn't set at DI registration.
    /// </summary>
    /// <param name="optionsBuilder">Options builder for configuring provider-wide settings.</param>
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        base.OnConfiguring(optionsBuilder);

        // This does not require a connection string; it just registers a naming-convention plugin.
        optionsBuilder.UseSnakeCaseNamingConvention();

        // Configure pgvector support for Vector types
        // This is required for mapping Vector properties to vector columns
        optionsBuilder.UseNpgsql(options => options.UseVector());
    }

    #endregion OnConfiguring

    #region OnModelCreating

    /// <summary>
    /// Builds the condition holding a text column to something a reader could act on. It names every whitespace
    /// character it strips, since the one-argument <c>btrim</c> strips only spaces and would let a lone tab pass
    /// for text, and coalesces because a check constraint lets a null through on its own.
    /// </summary>
    /// <param name="column">The column the condition holds.</param>
    /// <returns>The check-constraint condition.</returns>
    private static string CarriesText(string column) => $@"coalesce(btrim({column}, E' \t\n\r\f'), '') <> ''";

    /// <inheritdoc/>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        #region Provider extensions & global conventions

        // Ensure pg_trgm extension is present for trigram indexes (LIKE/ILIKE/regex accelerators).
        // EF migrations will emit "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
        modelBuilder.HasPostgresExtension("pg_trgm");

        // Enable unaccent extension for diacritic-insensitive text search.
        // Allows searching "cafe" to match "café", "pôžitok" to match "pozitok", etc.
        modelBuilder.HasPostgresExtension("unaccent");

        // Enable pgvector extension for vector similarity search operations.
        // Required for storing and querying vector embeddings efficiently.
        modelBuilder.HasPostgresExtension("vector");

        // Register custom database function for PostgreSQL's immutable_unaccent().
        // This allows EF Core to translate our C# method calls to SQL immutable_unaccent() function calls.
        // We use immutable_unaccent to match the index and ensure consistent behavior.
        var unaccentMethod = typeof(Extensions.PostgresDbFunctions)
            .GetMethod(nameof(Extensions.PostgresDbFunctions.Unaccent))!;

        modelBuilder.HasDbFunction(unaccentMethod)
            .HasName("immutable_unaccent")
            .HasSchema("public");

        // Register the function keying a defense conversation to the examiner settings it ran on, so grouping
        // conversations by their settings and filtering to one set of them come out as the same SQL expression.
        var examinerConfigVersionMethod = typeof(Extensions.PostgresDbFunctions)
            .GetMethod(nameof(Extensions.PostgresDbFunctions.ExaminerConfigVersion))!;

        modelBuilder.HasDbFunction(examinerConfigVersionMethod)
            .HasName("examiner_config_version")
            .HasSchema("public")
            // Postgres declares the argument as jsonb while the CLR side carries the snapshot as a string.
            // A bare column argument needs no cast and resolves anyway; anything else renders as text and
            // fails at runtime with no such function, so the store type is pinned rather than inferred.
            .HasParameter("examinerConfig").HasStoreType("jsonb");

        // IDs (Guid v7) are generated client-side in entities; tell EF the store does NOT generate them.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            // The entity's own id, if it has one
            var idProp = entityType.FindProperty("Id");

            // Only the Guid ids the entities mint themselves
            if (idProp is { ClrType: var type } && type == typeof(Guid))
                idProp.ValueGenerated = ValueGenerated.Never;
        }

        #endregion Provider extensions & global conventions

        #region Competition

        modelBuilder.Entity<Competition>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("ux_competition_slug");
            e.HasIndex(x => x.SortOrder).IsUnique().HasDatabaseName("ux_competition_sort_order");

            // DB-side invariant mirror of [Range] attributes in code.
            e.ToTable(t => t.HasCheckConstraint("ck_competition_sort_order_positive", "\"sort_order\" > 0"));

            e.HasMany(x => x.Rounds)
             .WithOne(r => r.Competition)
             .HasForeignKey(r => r.CompetitionId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        #endregion Competition

        #region Round (owned by Competition)

        modelBuilder.Entity<Round>(e =>
        {
            e.HasIndex(r => new { r.CompetitionId, r.CategoryId, r.Slug })
             .IsUnique()
             .HasDatabaseName("ux_round_competition_category_slug");

            e.HasIndex(r => r.CompositeSlug)
             .IsUnique()
             .HasDatabaseName("ux_round_composite_slug");

            // Unique when CategoryId IS NOT NULL
            e.HasIndex(r => new { r.CompetitionId, r.CategoryId, r.SortOrder })
              .IsUnique()
              .HasFilter("\"category_id\" IS NOT NULL")
              .HasDatabaseName("ux_round_competition_category_sort_order_when_category_not_null");

            // Unique when CategoryId IS NULL
            e.HasIndex(r => new { r.CompetitionId, r.SortOrder })
            .IsUnique()
            .HasFilter("\"category_id\" IS NULL")
            .HasDatabaseName("ux_round_competition_category_sort_order_when_category_null");

            e.ToTable(t => t.HasCheckConstraint("ck_round_sort_order_positive", "\"sort_order\" > 0"));

            e.HasOne(p => p.Category)
             .WithMany(c => c.Rounds)
             .HasForeignKey(p => p.CategoryId);
        });

        #endregion Round (owned by Competition)

        #region Season

        modelBuilder.Entity<Season>(e =>
        {
            // Single season per start_year (prevents duplicates like two 2024/25 seasons).
            e.HasIndex(s => s.StartYear)
             .IsUnique()
             .HasDatabaseName("ux_season_start_year");

            // Keep EditionNumber unique across seasons for clean "ročník" mapping.
            e.HasIndex(s => s.EditionNumber)
             .IsUnique()
             .HasDatabaseName("ux_season_edition_number");

            // DB-side invariants
            e.ToTable(t =>
            {
                t.HasCheckConstraint("ck_season_start_year_sane", "\"start_year\" >= 1900");
                t.HasCheckConstraint("ck_season_edition_positive", "\"edition_number\" > 0");
            });
        });

        #endregion Season

        #region RoundInstance (Round x Season)

        modelBuilder.Entity<RoundInstance>(e =>
        {
            e.HasIndex(x => new { x.RoundId, x.SeasonId })
             .IsUnique()
             .HasDatabaseName("ux_round_instance_round_season");

            e.HasOne(x => x.Round)
             .WithMany(r => r.RoundInstances)
             .HasForeignKey(x => x.RoundId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(x => x.Season)
             .WithMany(s => s.RoundInstances)
             .HasForeignKey(x => x.SeasonId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        #endregion RoundInstance (Competition x Season)

        #region Category

        modelBuilder.Entity<Category>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("ux_category_slug");
            e.HasIndex(x => x.SortOrder).IsUnique().HasDatabaseName("ux_category_sort_order");

            // DB-side invariant mirror of [Range] attributes in code.
            e.ToTable(t => t.HasCheckConstraint("ck_category_sort_order_positive", "\"sort_order\" > 0"));
        });

        #endregion Category

        #region Tag

        modelBuilder.Entity<Tag>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("ux_tag_slug");
        });

        #endregion Tag

        #region Author

        modelBuilder.Entity<Author>(e =>
        {
            e.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("ux_author_slug");
        });

        #endregion Author

        #region Problem

        modelBuilder.Entity<Problem>(e =>
        {
            // Problem belongs to exactly one round instance.
            e.HasOne(p => p.RoundInstance)
             .WithMany(ri => ri.Problems)
             .HasForeignKey(p => p.RoundInstanceId);

            e.HasMany(p => p.Likes)
             .WithOne(l => l.Problem)
             .HasForeignKey(l => l.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(p => p.MarkStatuses)
             .WithOne(ms => ms.Problem)
             .HasForeignKey(ms => ms.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            // Within the same round instance, problem numbers must be unique.
            e.HasIndex(p => new { p.RoundInstanceId, p.Number })
             .IsUnique()
             .HasDatabaseName("ux_problem_round_instance_number");

            // DB-side guard mirroring [Range]
            e.ToTable(t => t.HasCheckConstraint("ck_problem_number_positive", "\"number\" > 0"));

            // Texts relationship
            e.HasMany(p => p.Texts)
             .WithOne(pt => pt.Problem)
             .HasForeignKey(pt => pt.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        #endregion Problem

        #region ProblemEmbedding

        modelBuilder.Entity<ProblemEmbedding>(e =>
        {
            // Relationship to problem text
            e.HasOne(pe => pe.ProblemText)
             .WithMany(pt => pt.Embeddings)
             .HasForeignKey(pe => pe.ProblemTextId)
             .OnDelete(DeleteBehavior.Cascade);

            // Unique constraint: one embedding per problem text, embedding type, and model
            e.HasIndex(pe => new { pe.ProblemTextId, pe.EmbeddingType, pe.ModelName })
             .IsUnique()
             .HasDatabaseName("ux_problem_embedding_text_embedding_model");

            // Index for efficient lookup by problem text
            e.HasIndex(pe => pe.ProblemTextId)
             .HasDatabaseName("ix_problem_embedding_problem_text_id");

            // Vector index for semantic similarity search using cosine distance.
            e.HasIndex(pe => pe.Embedding)
             .HasDatabaseName("ix_problem_embedding_cosine")
             .HasMethod("ivfflat")
             .HasOperators("vector_cosine_ops")
             .HasStorageParameter("lists", 100);
        });

        #endregion ProblemEmbedding

        #region ProblemText

        modelBuilder.Entity<ProblemText>(e =>
        {
            // Relationship to problem
            e.HasOne(pt => pt.Problem)
             .WithMany(p => p.Texts)
             .HasForeignKey(pt => pt.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            // Unique constraint: one text per problem, document type, and language
            e.HasIndex(pt => new { pt.ProblemId, pt.DocumentType, pt.Language })
             .IsUnique()
             .HasDatabaseName("ux_problem_text_problem_document_language");

            // Index for efficient lookup by problem
            e.HasIndex(pt => pt.ProblemId)
             .HasDatabaseName("ix_problem_text_problem_id");

            // GIN trigram index backing the accent-insensitive free-text search. The search matches
            // markdown text with a fallback to legacy TeX raw text, so the index expression is over the
            // same coalesce. The actual SQL is created in migration SwitchSearchIndexToCoalesce.
            e.HasIndex(pt => pt.MarkdownText)
             .HasDatabaseName("ix_problem_text_search_trgm")
             .HasAnnotation("Npgsql:IndexExpression", "immutable_unaccent(coalesce(markdown_text, raw_text))")
             .HasMethod("gin")
             .HasOperators("gin_trgm_ops");

            // Check constraint: for each (ProblemId, DocumentType), either all texts are automated
            // or exactly one text is original (IsOriginal = true)
            // This ensures: COUNT(*) = 0 OR COUNT(*) WHERE IsOriginal = true = 1
            // We implement this via a unique partial index: only one original text per (problem, document type)
            e.HasIndex(pt => new { pt.ProblemId, pt.DocumentType })
             .IsUnique()
             .HasFilter("is_original = true")
             .HasDatabaseName("ux_problem_text_one_original_per_problem_document");

            // Partial covering index for optimized statement lookup by language preference.
            e.HasIndex(pt => new { pt.ProblemId, pt.Language, pt.IsOriginal })
             .HasDatabaseName("ix_problem_text_statement_lookup")
             .HasFilter("document_type = 'statement' AND markdown_text IS NOT NULL")
             .IncludeProperties(pt => pt.MarkdownText!);

            // Embeddings relationship
            e.HasMany(pt => pt.Embeddings)
             .WithOne(pe => pe.ProblemText)
             .HasForeignKey(pe => pe.ProblemTextId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        #endregion ProblemText

        #region ProblemAuthor (ordered join)

        modelBuilder.Entity<ProblemAuthor>(e =>
        {
            e.HasKey(x => new { x.ProblemId, x.AuthorId });

            e.HasOne(pa => pa.Problem)
             .WithMany(p => p.ProblemAuthors)
             .HasForeignKey(pa => pa.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(pa => pa.Author)
             .WithMany(a => a.ProblemAuthors)
             .HasForeignKey(pa => pa.AuthorId)
             .OnDelete(DeleteBehavior.Restrict);

            // Efficient lookup: all problems by a given author.
            e.HasIndex(x => x.AuthorId).HasDatabaseName("ix_problem_author_author_id");

            // Enforce per-problem author order uniqueness
            e.HasIndex(x => new { x.ProblemId, x.Ordinal })
             .IsUnique()
             .HasDatabaseName("ux_problem_author_problem_ordinal");

            // Enforce per-problem author order positivity
            e.ToTable(t => t.HasCheckConstraint("ck_problem_author_order_positive", "\"ordinal\" > 0"));
        });

        #endregion ProblemAuthor (ordered join)

        #region ProblemTag (ordered join)

        modelBuilder.Entity<ProblemTag>(e =>
        {
            e.ToTable("problem_tag");

            e.HasKey(x => new { x.ProblemId, x.TagId });

            e.HasOne(pa => pa.Problem)
             .WithMany(p => p.ProblemTagsAll)
             .HasForeignKey(pa => pa.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(pa => pa.Tag)
             .WithMany(a => a.ProblemTagsAll)
             .HasForeignKey(pa => pa.TagId)
             .OnDelete(DeleteBehavior.Cascade);

            // Efficient lookup: all problems with a given tag.
            e.HasIndex(x => x.TagId).HasDatabaseName("ix_problem_tag_tag_id");

            // Efficient lookup: all tags of a given problem.
            e.HasIndex(x => x.ProblemId).HasDatabaseName("ix_problem_tag_problem_id");
        });

        #endregion ProblemTag (ordered join)

        #region ProblemSimilarity

        modelBuilder.Entity<ProblemSimilarity>(e =>
        {
            // Symmetry policy: store both directions (A->B and B->A) to speed lookups,
            // while keeping each directed pair unique and forbidding self-links.
            e.HasKey(x => new { x.SourceProblemId, x.SimilarProblemId });

            // Problem is similar to many problems
            e.HasOne(x => x.SourceProblem)
             .WithMany(p => p.SimilarProblems)
             .HasForeignKey(x => x.SourceProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            // Problem is similar from many problems
            e.HasOne(x => x.SimilarProblem)
             .WithMany(p => p.AppearsInProblems)
             .HasForeignKey(x => x.SimilarProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            // Reject self-links.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_problem_similarity_not_self", "\"source_problem_id\" <> \"similar_problem_id\""));

            // Inbound lookup for "who points to this problem"
            e.HasIndex(x => x.SimilarProblemId).HasDatabaseName("ix_problem_similarity_similar_problem_id");

            // Configure automatic JSON serialization for SimilarityComponents.
            // EF Core will automatically serialize/deserialize the Components property as JSON.
            e.OwnsOne(x => x.Components, components => components.ToJson());
        });

        #endregion ProblemSimilarity

        #region User

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.ExternalId).IsUnique().HasDatabaseName("ux_user_external_id");
        });

        #endregion User

        #region ProblemLike

        modelBuilder.Entity<ProblemLike>(e =>
        {
            // Composite primary key: a user can only like a problem once
            e.HasKey(pl => new { pl.UserId, pl.ProblemId });

            // Foreign key to User with cascade delete
            e.HasOne(pl => pl.User)
             .WithMany()
             .HasForeignKey(pl => pl.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Foreign key to Problem with cascade delete
            e.HasOne(pl => pl.Problem)
             .WithMany(p => p.Likes)
             .HasForeignKey(pl => pl.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            // Index on ProblemId for efficient lookup of all likes for a problem
            e.HasIndex(pl => pl.ProblemId).HasDatabaseName("ix_problem_like_problem_id");

            // Index on UserId for efficient lookup of all likes by a user
            e.HasIndex(pl => pl.UserId).HasDatabaseName("ix_problem_like_user_id");
        });

        #endregion ProblemLike

        #region ProblemMarkStatus

        modelBuilder.Entity<ProblemMarkStatus>(e =>
        {
            // Composite primary key: a user can only mark a problem once
            e.HasKey(ms => new { ms.UserId, ms.ProblemId });

            // Foreign key to User with cascade delete
            e.HasOne(ms => ms.User)
             .WithMany()
             .HasForeignKey(ms => ms.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Foreign key to Problem with cascade delete
            e.HasOne(ms => ms.Problem)
             .WithMany(p => p.MarkStatuses)
             .HasForeignKey(ms => ms.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            // Index on ProblemId for efficient lookup of all marks for a problem
            e.HasIndex(ms => ms.ProblemId).HasDatabaseName("ix_problem_mark_status_problem_id");

            // Index on UserId for efficient lookup of all marks by a user
            e.HasIndex(ms => ms.UserId).HasDatabaseName("ix_problem_mark_status_user_id");
        });

        #endregion ProblemMarkStatus

        #region Comment

        modelBuilder.Entity<Comment>(e =>
        {
            // Threading (self-reference)
            e.HasOne(c => c.ParentComment)
             .WithMany(c => c.Replies)
             .HasForeignKey(c => c.ParentCommentId)
             .OnDelete(DeleteBehavior.Restrict);

            // Edit versioning (self-reference)
            e.HasOne(c => c.PreviousVersion)
             .WithMany()
             .HasForeignKey(c => c.PreviousVersionId)
             .OnDelete(DeleteBehavior.Restrict);

            // Author
            e.HasOne(c => c.Author)
             .WithMany()
             .HasForeignKey(c => c.AuthorId)
             .OnDelete(DeleteBehavior.Restrict);

            e.HasIndex(c => c.ParentCommentId).HasDatabaseName("ix_comment_parent_id");
            e.HasIndex(c => c.AuthorId).HasDatabaseName("ix_comment_author_id");
        });

        #endregion Comment

        #region CommentLike

        modelBuilder.Entity<CommentLike>(e =>
        {
            e.HasKey(cl => new { cl.UserId, cl.CommentId });

            e.HasOne(cl => cl.User)
             .WithMany()
             .HasForeignKey(cl => cl.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(cl => cl.Comment)
             .WithMany(c => c.Likes)
             .HasForeignKey(cl => cl.CommentId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(cl => cl.CommentId).HasDatabaseName("ix_comment_like_comment_id");
        });

        #endregion CommentLike

        #region ProblemComment

        modelBuilder.Entity<ProblemComment>(e =>
        {
            e.HasKey(pc => new { pc.ProblemId, pc.CommentId });

            e.HasOne(pc => pc.Problem)
             .WithMany(p => p.ProblemComments)
             .HasForeignKey(pc => pc.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(pc => pc.Comment)
             .WithMany()
             .HasForeignKey(pc => pc.CommentId)
             .OnDelete(DeleteBehavior.Cascade);

            // Each comment belongs to at most one problem
            e.HasIndex(pc => pc.CommentId).IsUnique().HasDatabaseName("ux_problem_comment_comment_id");
        });

        #endregion ProblemComment

        #region HandoutComment

        modelBuilder.Entity<HandoutComment>(e =>
        {
            e.HasKey(hc => new { hc.HandoutId, hc.CommentId });

            e.HasOne(hc => hc.Handout)
             .WithMany(h => h.Comments)
             .HasForeignKey(hc => hc.HandoutId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(hc => hc.Comment)
             .WithMany()
             .HasForeignKey(hc => hc.CommentId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(hc => hc.CommentId).IsUnique().HasDatabaseName("ux_handout_comment_comment_id");
        });

        #endregion HandoutComment

        #region NewsArticleComment

        modelBuilder.Entity<NewsArticleComment>(e =>
        {
            e.HasKey(nc => new { nc.NewsArticleId, nc.CommentId });

            e.HasOne(nc => nc.NewsArticle)
             .WithMany(n => n.Comments)
             .HasForeignKey(nc => nc.NewsArticleId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(nc => nc.Comment)
             .WithMany()
             .HasForeignKey(nc => nc.CommentId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(nc => nc.CommentId).IsUnique().HasDatabaseName("ux_news_article_comment_comment_id");
        });

        #endregion NewsArticleComment

        #region Handout

        modelBuilder.Entity<Handout>(e =>
        {
            e.HasIndex(h => h.ContentId).IsUnique().HasDatabaseName("ux_handout_content_id");
        });

        #endregion Handout

        #region HandoutEnvironment

        modelBuilder.Entity<HandoutEnvironment>(e =>
        {
            // Environments belong to their handout, cascading so deleting it drops them.
            e.HasOne(env => env.Handout)
             .WithMany(h => h.Environments)
             .HasForeignKey(env => env.HandoutId)
             .OnDelete(DeleteBehavior.Cascade);

            // An environment's id is only unique within its own handout, not site-wide.
            e.HasIndex(env => new { env.HandoutId, env.ContentId })
             .IsUnique()
             .HasDatabaseName("ux_handout_environment_handout_id_content_id");
        });

        #endregion HandoutEnvironment

        #region HandoutEnvironmentDefense

        modelBuilder.Entity<HandoutEnvironmentDefense>(e =>
        {
            // A session defends exactly one environment, so its own id doubles as this row's key.
            e.HasKey(defense => defense.DefenseSessionId);

            // The session this row extends, sharing its id as this table's own key.
            e.HasOne(defense => defense.DefenseSession)
             .WithOne(session => session.EnvironmentTarget)
             .HasForeignKey<HandoutEnvironmentDefense>(defense => defense.DefenseSessionId)
             .OnDelete(DeleteBehavior.Cascade);

            // Defenses belong to their environment, cascading so deleting it drops them.
            e.HasOne(defense => defense.HandoutEnvironment)
             .WithMany(env => env.Defenses)
             .HasForeignKey(defense => defense.HandoutEnvironmentId)
             .OnDelete(DeleteBehavior.Cascade);

            // A user's history for one environment is the list query.
            e.HasIndex(defense => defense.HandoutEnvironmentId)
             .HasDatabaseName("ix_handout_environment_defense_handout_environment_id");
        });

        #endregion HandoutEnvironmentDefense

        #region NewsArticle

        modelBuilder.Entity<NewsArticle>(e =>
        {
            e.HasIndex(n => n.ContentId).IsUnique().HasDatabaseName("ux_news_article_content_id");
        });

        #endregion NewsArticle

        #region UserProblemList

        modelBuilder.Entity<UserProblemList>(e =>
        {
            // Foreign key to User with cascade delete
            e.HasOne(l => l.User)
             .WithMany()
             .HasForeignKey(l => l.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Relationship to items
            e.HasMany(l => l.Items)
             .WithOne(i => i.List)
             .HasForeignKey(i => i.ListId)
             .OnDelete(DeleteBehavior.Cascade);

            // Index on UserId for efficient lookup of all lists by a user
            e.HasIndex(l => l.UserId).HasDatabaseName("ix_user_problem_list_user_id");

            // Unique index on ContentId for external-facing lookups
            e.HasIndex(l => l.ContentId).IsUnique().HasDatabaseName("ux_user_problem_list_content_id");

            // DB-side guard for positive sort order
            e.ToTable(t => t.HasCheckConstraint("ck_user_problem_list_sort_order_positive", "\"sort_order\" > 0"));
        });

        #endregion UserProblemList

        #region UserProblemListItem

        modelBuilder.Entity<UserProblemListItem>(e =>
        {
            // Composite primary key: a problem can only appear once per list
            e.HasKey(i => new { i.ListId, i.ProblemId });

            // Foreign key to UserProblemList with cascade delete
            e.HasOne(i => i.List)
             .WithMany(l => l.Items)
             .HasForeignKey(i => i.ListId)
             .OnDelete(DeleteBehavior.Cascade);

            // Foreign key to Problem with restrict delete (don't lose list data if problem is removed)
            e.HasOne(i => i.Problem)
             .WithMany(p => p.UserProblemListItems)
             .HasForeignKey(i => i.ProblemId)
             .OnDelete(DeleteBehavior.Restrict);

            // Index on ProblemId for efficient lookup of all lists containing a problem
            e.HasIndex(i => i.ProblemId).HasDatabaseName("ix_user_problem_list_item_problem_id");
        });

        #endregion UserProblemListItem

        #region DefenseSession

        modelBuilder.Entity<DefenseSession>(e =>
        {
            // The examiner-settings snapshot is a freeform reference blob, stored as jsonb so it stays queryable.
            e.Property(session => session.ExaminerConfig)
             .HasColumnType("jsonb");

            // Owner of the conversation, cascading so deleting a user drops their sessions.
            e.HasOne(session => session.User)
             .WithMany()
             .HasForeignKey(session => session.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            // Turns belong to the session, cascading so deleting a session drops its turns.
            e.HasMany(session => session.Turns)
             .WithOne(turn => turn.Session)
             .HasForeignKey(turn => turn.SessionId)
             .OnDelete(DeleteBehavior.Cascade);

            // Every list query starts from the owner.
            e.HasIndex(session => session.UserId).HasDatabaseName("ix_defense_session_user_id");
        });

        #endregion DefenseSession

        #region DefenseTurn

        modelBuilder.Entity<DefenseTurn>(e =>
        {
            // Turns read back in their explicit conversation order; unique so racing turns can't corrupt it.
            e.HasIndex(turn => new { turn.SessionId, turn.Sequence })
             .IsUnique()
             .HasDatabaseName("ix_defense_turn_session_id_sequence");
        });

        #endregion DefenseTurn

        #region DefenseTurnAttempt

        modelBuilder.Entity<DefenseTurnAttempt>(e =>
        {
            // The conversation the draft was made in, cascading so deleting a session drops what it tried.
            e.HasOne(attempt => attempt.Session)
             .WithMany()
             .HasForeignKey(attempt => attempt.SessionId)
             .OnDelete(DeleteBehavior.Cascade);

            // The turn the draft was made for, cascading so a rewind past that turn takes its drafts too. The
            // conversation rides in the key, so the turn has to be one of that conversation's own.
            e.HasOne(attempt => attempt.Turn)
             .WithMany(turn => turn.Attempts)
             .HasPrincipalKey(turn => new { turn.SessionId, turn.Id })
             .HasForeignKey(attempt => new { attempt.SessionId, attempt.TurnId })
             .OnDelete(DeleteBehavior.Cascade);

            // Calls belong to the draft that made them, cascading so dropping a draft drops its calls.
            e.HasMany(attempt => attempt.Calls)
             .WithOne(call => call.Attempt)
             .HasForeignKey(call => call.AttemptId)
             .OnDelete(DeleteBehavior.Cascade);

            // Drafts read back in the order they were made; unique so a turn can't record two at one index.
            e.HasIndex(attempt => new { attempt.TurnId, attempt.AttemptIndex })
             .IsUnique()
             .HasDatabaseName("ux_defense_turn_attempt_turn_id_attempt_index");
        });

        #endregion DefenseTurnAttempt

        #region DefenseSpend

        modelBuilder.Entity<DefenseSpend>(e =>
        {
            // The per-user rolling spend query sums cost over a user's recent rows.
            e.HasIndex(spend => new { spend.UserId, spend.CreatedAt })
             .HasDatabaseName("ix_defense_spend_user_id_created_at");
        });

        #endregion DefenseSpend

        #region DefenseTurnReport

        modelBuilder.Entity<DefenseTurnReport>(e =>
        {
            // The reported conversation, cascading so deleting a session drops what was said about it.
            e.HasOne(report => report.Session)
             .WithMany(session => session.Reports)
             .HasForeignKey(report => report.SessionId)
             .OnDelete(DeleteBehavior.Cascade);

            // The reported reply, one report to a reply, cascading so a rewind past it takes the report too. The
            // conversation rides in the key, so the reply has to be one of that conversation's own.
            e.HasOne(report => report.Turn)
             .WithOne()
             .HasPrincipalKey<DefenseTurn>(turn => new { turn.SessionId, turn.Id })
             .HasForeignKey<DefenseTurnReport>(report => new { report.SessionId, report.TurnId })
             .OnDelete(DeleteBehavior.Cascade);

            // The pair the reply is held to, which reading a session's reports starts from as well.
            e.HasIndex(report => new { report.SessionId, report.TurnId })
             .IsUnique()
             .HasDatabaseName("ux_defense_turn_report_session_id_turn_id");

            // One report per reply site-wide, which is also the conflict target a revised report is written on.
            e.HasIndex(report => report.TurnId)
             .IsUnique()
             .HasDatabaseName("ux_defense_turn_report_turn_id");

            // A report holding nothing against the reply is an empty row, not a quiet one.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_defense_turn_report_categories_not_empty", "cardinality(categories) > 0"));

            // Blaming something off the list says nothing on its own, so it comes with the student's account
            // of what happened.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_defense_turn_report_other_needs_comment",
                $"NOT ('other' = ANY(categories)) OR {CarriesText("comment")}"));
        });

        #endregion DefenseTurnReport

        #region DefenseSessionFeedback

        modelBuilder.Entity<DefenseSessionFeedback>(e =>
        {
            // A session is answered for at most once, so its own id doubles as this row's key.
            e.HasKey(feedback => feedback.SessionId);

            // The session this answers for, cascading so deleting it drops the answer with it.
            e.HasOne(feedback => feedback.Session)
             .WithOne(session => session.Feedback)
             .HasForeignKey<DefenseSessionFeedback>(feedback => feedback.SessionId)
             .OnDelete(DeleteBehavior.Cascade);

            // Landing off the list says nothing on its own, so it comes with the student's account of where the
            // conversation went instead.
            e.ToTable(t => t.HasCheckConstraint(
                "ck_defense_session_feedback_something_else_needs_comment",
                $"outcome <> 'something_else' OR {CarriesText("comment")}"));
        });

        #endregion DefenseSessionFeedback

        #region AdminNote

        modelBuilder.Entity<AdminNote>(entity =>
        {
            // Who wrote it, restricted so a finding can't lose the reviewer standing behind it.
            entity.HasOne(note => note.Author)
                  .WithMany()
                  .HasForeignKey(note => note.AuthorId)
                  .OnDelete(DeleteBehavior.Restrict);

            // The reviewed conversation, cascading so deleting it drops what was written about it.
            entity.HasOne(note => note.Session)
                  .WithMany()
                  .HasForeignKey(note => note.SessionId)
                  .OnDelete(DeleteBehavior.Cascade);

            // The reply it is against, cascading so a rewind past that reply takes the note too. The conversation
            // rides in the key, so the reply has to be one of that conversation's own; a note against the whole
            // conversation names no reply and skips the check entirely.
            entity.HasOne(note => note.Turn)
                  .WithMany()
                  .HasPrincipalKey(turn => new { turn.SessionId, turn.Id })
                  .HasForeignKey(note => new { note.SessionId, note.TurnId })
                  .OnDelete(DeleteBehavior.Cascade);

            // The feed reads newest first across every conversation.
            entity.HasIndex(note => note.CreatedAt).HasDatabaseName("ix_admin_note_created_at");

            // Everything one reviewer has written.
            entity.HasIndex(note => note.AuthorId).HasDatabaseName("ix_admin_note_author_id");

            // A note carrying no text is an empty row, not a quiet one.
            entity.ToTable(table => table.HasCheckConstraint(
                "ck_admin_note_content_not_blank", CarriesText("content")));
        });

        #endregion AdminNote

        #region AdminSessionReview

        modelBuilder.Entity<AdminSessionReview>(entity =>
        {
            // A conversation is read once per reviewer, so it takes both to name a stamp.
            entity.HasKey(review => new { review.SessionId, review.ReviewerId });

            // The conversation that was read, cascading so deleting it drops the stamps with it.
            entity.HasOne(review => review.Session)
                  .WithMany()
                  .HasForeignKey(review => review.SessionId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Who read it, cascading because where a reviewer got to is bookkeeping that means nothing without them.
            entity.HasOne(review => review.Reviewer)
                  .WithMany()
                  .HasForeignKey(review => review.ReviewerId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        #endregion AdminSessionReview
    }

    #endregion OnModelCreating
}
