using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStatementLookupIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_problem_text_statement_lookup",
                table: "problem_texts",
                columns: new[] { "problem_id", "language", "is_original" },
                filter: "document_type = 'statement' AND parsed_text IS NOT NULL")
                .Annotation("Npgsql:IndexInclude", new[] { "parsed_text" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_problem_text_statement_lookup",
                table: "problem_texts");
        }
    }
}
