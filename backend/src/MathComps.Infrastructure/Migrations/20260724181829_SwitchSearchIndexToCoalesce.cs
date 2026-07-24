using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SwitchSearchIndexToCoalesce : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Retarget the search trigram index from raw_text to coalesce(markdown_text, raw_text) so
            // markdown-native imports become searchable. Raw SQL because the scaffolder can't express the
            // gin_trgm_ops expression index; IF EXISTS tolerates environments missing the old index.
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ix_problem_text_raw_text_unaccent_trgm;

                CREATE INDEX ix_problem_text_search_trgm
                ON problem_texts
                USING gin (immutable_unaccent(coalesce(markdown_text, raw_text)) gin_trgm_ops);
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the raw_text-only trigram index.
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ix_problem_text_search_trgm;

                CREATE INDEX ix_problem_text_raw_text_unaccent_trgm
                ON problem_texts
                USING gin (immutable_unaccent(raw_text) gin_trgm_ops);
            ");
        }
    }
}
