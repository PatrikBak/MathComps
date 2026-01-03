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

    /// <summary>Physical images associated with problems.</summary>
    public DbSet<ProblemImage> ProblemImages => Set<ProblemImage>();

    /// <summary>Embeddings for problems.</summary>
    public DbSet<ProblemEmbedding> ProblemEmbeddings => Set<ProblemEmbedding>();

    /// <summary>Texts (statements and solutions) for problems in various languages.</summary>
    public DbSet<ProblemText> ProblemTexts => Set<ProblemText>();

    /// <summary>Users synced from Clerk.</summary>
    public DbSet<User> Users => Set<User>();

    /// <summary>Likes on problems by users.</summary>
    public DbSet<ProblemLike> ProblemLikes => Set<ProblemLike>();

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

    /// <summary>Anchor entity for news articles.</summary>
    public DbSet<NewsArticle> NewsArticles => Set<NewsArticle>();

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
        modelBuilder.HasDbFunction(typeof(Extensions.PostgresDbFunctions).GetMethod(nameof(Extensions.PostgresDbFunctions.Unaccent))!)
            .HasName("immutable_unaccent")
            .HasSchema("public");

        // IDs (Guid v7) are generated client-side in entities; tell EF the store does NOT generate them.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            var idProp = entityType.FindProperty("Id");
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

            e.HasMany(p => p.Images)
             .WithOne(i => i.Problem)
             .HasForeignKey(i => i.ProblemId)
             .OnDelete(DeleteBehavior.Cascade);

            e.HasMany(p => p.Likes)
             .WithOne(l => l.Problem)
             .HasForeignKey(l => l.ProblemId)
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

            // GIN trigram index on unaccented raw_text for efficient accent-insensitive search
            // This is an expression index: immutable_unaccent(raw_text)
            // The actual SQL is created in migration 20251027182303_AddMultiLanguageSupport
            e.HasIndex(pt => pt.RawText)
             .HasDatabaseName("ix_problem_text_raw_text_unaccent_trgm")
             .HasFilter("raw_text IS NOT NULL")
             .HasAnnotation("Npgsql:IndexExpression", "immutable_unaccent(raw_text)")
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

            // Embeddings relationship
            e.HasMany(pt => pt.Embeddings)
             .WithOne(pe => pe.ProblemText)
             .HasForeignKey(pe => pe.ProblemTextId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        #endregion ProblemText

        #region ProblemImage

        modelBuilder.Entity<ProblemImage>(e =>
        {
            e.HasIndex(i => new { i.ProblemId, i.ContentId })
             .IsUnique()
             .HasDatabaseName("ux_problem_image_problem_content_id");
        });

        #endregion

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
            e.ToTable(t => t.HasCheckConstraint("ck_problem_similarity_not_self", "\"source_problem_id\" <> \"similar_problem_id\""));

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

        #region NewsArticle

        modelBuilder.Entity<NewsArticle>(e =>
        {
            e.HasIndex(n => n.ContentId).IsUnique().HasDatabaseName("ux_news_article_content_id");
        });

        #endregion NewsArticle
    }

    #endregion OnModelCreating
}
