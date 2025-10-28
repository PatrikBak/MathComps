using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveStatementWithSolutionDocumentType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // PostgreSQL doesn't support removing enum values directly
            // We need to recreate the enum type without the statement_with_solution value
            migrationBuilder.Sql(@"
                ALTER TYPE document_type RENAME TO document_type_old;
                CREATE TYPE document_type AS ENUM ('statement', 'solution');
                ALTER TABLE problem_texts ALTER COLUMN document_type TYPE document_type USING document_type::text::document_type;
                DROP TYPE document_type_old;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore the enum with statement_with_solution value
            migrationBuilder.Sql(@"
                ALTER TYPE document_type RENAME TO document_type_old;
                CREATE TYPE document_type AS ENUM ('statement', 'solution', 'statement_with_solution');
                ALTER TABLE problem_texts ALTER COLUMN document_type TYPE document_type USING document_type::text::document_type;
                DROP TYPE document_type_old;
            ");
        }
    }
}
