using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeImmutableUnaccentDumpSafe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Schema-qualify the unaccent call so the function resolves under an empty
            // search_path. pg_restore builds objects with search_path set to '', so the
            // original unqualified unaccent() failed when this function was inlined to
            // build the trigram index, breaking restores of a production dump. The
            // two-argument unaccent(regdictionary, text) form with a qualified dictionary
            // keeps both the function and dictionary lookups off search_path. The body
            // produces identical output, so the existing index stays valid (no reindex).
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION immutable_unaccent(text)
                RETURNS text AS $$
                    SELECT public.unaccent('public.unaccent', $1)
                $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the original search_path-dependent body.
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION immutable_unaccent(text)
                RETURNS text AS $$
                    SELECT unaccent($1)
                $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;
            ");
        }
    }
}
