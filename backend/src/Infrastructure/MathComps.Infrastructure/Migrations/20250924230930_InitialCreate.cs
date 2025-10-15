using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:tag_type", "area,technique,type")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "authors",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_authors", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.id);
                    table.CheckConstraint("ck_category_sort_order_positive", "\"sort_order\" > 0");
                });

            migrationBuilder.CreateTable(
                name: "competitions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_competitions", x => x.id);
                    table.CheckConstraint("ck_competition_sort_order_positive", "\"sort_order\" > 0");
                });

            migrationBuilder.CreateTable(
                name: "seasons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_year = table.Column<int>(type: "integer", nullable: false),
                    edition_label = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    edition_number = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seasons", x => x.id);
                    table.CheckConstraint("ck_season_edition_positive", "\"edition_number\" > 0");
                    table.CheckConstraint("ck_season_start_year_sane", "\"start_year\" >= 1900");
                });

            migrationBuilder.CreateTable(
                name: "tags",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    tag_type = table.Column<TagType>(type: "tag_type", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tags", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rounds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    competition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    composite_slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rounds", x => x.id);
                    table.CheckConstraint("ck_round_sort_order_positive", "\"sort_order\" > 0");
                    table.ForeignKey(
                        name: "fk_rounds_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_rounds_competitions_competition_id",
                        column: x => x.competition_id,
                        principalTable: "competitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "round_instances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    round_id = table.Column<Guid>(type: "uuid", nullable: false),
                    season_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_round_instances", x => x.id);
                    table.ForeignKey(
                        name: "fk_round_instances_rounds_round_id",
                        column: x => x.round_id,
                        principalTable: "rounds",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_round_instances_seasons_season_id",
                        column: x => x.season_id,
                        principalTable: "seasons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "problems",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    round_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<int>(type: "integer", nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    statement = table.Column<string>(type: "text", nullable: false),
                    statement_parsed = table.Column<string>(type: "jsonb", nullable: false),
                    solution = table.Column<string>(type: "text", nullable: true),
                    solution_parsed = table.Column<string>(type: "jsonb", nullable: true),
                    solution_link = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    statement_embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    solution_embedding = table.Column<Vector>(type: "vector(768)", nullable: true),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problems", x => x.id);
                    table.CheckConstraint("ck_problem_number_positive", "\"number\" > 0");
                    table.ForeignKey(
                        name: "fk_problems_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_problems_round_instances_round_instance_id",
                        column: x => x.round_instance_id,
                        principalTable: "round_instances",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "problem_authors",
                columns: table => new
                {
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    author_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ordinal = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_authors", x => new { x.problem_id, x.author_id });
                    table.CheckConstraint("ck_problem_author_order_positive", "\"ordinal\" > 0");
                    table.ForeignKey(
                        name: "fk_problem_authors_authors_author_id",
                        column: x => x.author_id,
                        principalTable: "authors",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_problem_authors_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "problem_images",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    content_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    width = table.Column<string>(type: "text", nullable: false),
                    height = table.Column<string>(type: "text", nullable: false),
                    scale = table.Column<decimal>(type: "numeric", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_images", x => x.id);
                    table.ForeignKey(
                        name: "fk_problem_images_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "problem_similarities",
                columns: table => new
                {
                    source_problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    similar_problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    similarity_score = table.Column<double>(type: "double precision", nullable: false),
                    components = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_similarities", x => new { x.source_problem_id, x.similar_problem_id });
                    table.CheckConstraint("ck_problem_similarity_not_self", "\"source_problem_id\" <> \"similar_problem_id\"");
                    table.ForeignKey(
                        name: "fk_problem_similarities_problems_similar_problem_id",
                        column: x => x.similar_problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_problem_similarities_problems_source_problem_id",
                        column: x => x.source_problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "problem_tag",
                columns: table => new
                {
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tag_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_tag", x => new { x.problem_id, x.tag_id });
                    table.ForeignKey(
                        name: "fk_problem_tag_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_problem_tag_tags_tag_id",
                        column: x => x.tag_id,
                        principalTable: "tags",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ux_author_slug",
                table: "authors",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_category_slug",
                table: "categories",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_category_sort_order",
                table: "categories",
                column: "sort_order",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_competition_slug",
                table: "competitions",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_competition_sort_order",
                table: "competitions",
                column: "sort_order",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_problem_author_author_id",
                table: "problem_authors",
                column: "author_id");

            migrationBuilder.CreateIndex(
                name: "ux_problem_author_problem_ordinal",
                table: "problem_authors",
                columns: new[] { "problem_id", "ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_problem_image_problem_content_id",
                table: "problem_images",
                columns: new[] { "problem_id", "content_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_problem_similarity_similar_problem_id",
                table: "problem_similarities",
                column: "similar_problem_id");

            migrationBuilder.CreateIndex(
                name: "ix_problem_tag_tag_problem",
                table: "problem_tag",
                columns: new[] { "tag_id", "problem_id" });

            migrationBuilder.CreateIndex(
                name: "ix_problem_solution_embedding_cosine",
                table: "problems",
                column: "solution_embedding",
                filter: "solution_embedding IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "ivfflat")
                .Annotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                .Annotation("Npgsql:StorageParameter:lists", 100);

            migrationBuilder.CreateIndex(
                name: "ix_problem_solution_trgm",
                table: "problems",
                column: "solution",
                filter: "solution IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_problem_statement_embedding_cosine",
                table: "problems",
                column: "statement_embedding",
                filter: "statement_embedding IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "ivfflat")
                .Annotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                .Annotation("Npgsql:StorageParameter:lists", 100);

            migrationBuilder.CreateIndex(
                name: "ix_problem_statement_trgm",
                table: "problems",
                column: "statement",
                filter: "statement IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_problems_category_id",
                table: "problems",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ux_problem_round_instance_number",
                table: "problems",
                columns: new[] { "round_instance_id", "number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_round_instances_season_id",
                table: "round_instances",
                column: "season_id");

            migrationBuilder.CreateIndex(
                name: "ux_round_instance_round_season",
                table: "round_instances",
                columns: new[] { "round_id", "season_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_rounds_category_id",
                table: "rounds",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ux_round_competition_category_slug",
                table: "rounds",
                columns: new[] { "competition_id", "category_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_round_competition_category_sort_order_when_category_not_null",
                table: "rounds",
                columns: new[] { "competition_id", "category_id", "sort_order" },
                unique: true,
                filter: "\"category_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_round_competition_category_sort_order_when_category_null",
                table: "rounds",
                columns: new[] { "competition_id", "sort_order" },
                unique: true,
                filter: "\"category_id\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_round_composite_slug",
                table: "rounds",
                column: "composite_slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_season_edition_number",
                table: "seasons",
                column: "edition_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_season_start_year",
                table: "seasons",
                column: "start_year",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_tag_slug",
                table: "tags",
                column: "slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "problem_authors");

            migrationBuilder.DropTable(
                name: "problem_images");

            migrationBuilder.DropTable(
                name: "problem_similarities");

            migrationBuilder.DropTable(
                name: "problem_tag");

            migrationBuilder.DropTable(
                name: "authors");

            migrationBuilder.DropTable(
                name: "problems");

            migrationBuilder.DropTable(
                name: "tags");

            migrationBuilder.DropTable(
                name: "round_instances");

            migrationBuilder.DropTable(
                name: "rounds");

            migrationBuilder.DropTable(
                name: "seasons");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "competitions");
        }
    }
}
