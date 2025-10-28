using System;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMultiLanguageSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_problem_embeddings_problems_problem_id",
                table: "problem_embeddings");

            migrationBuilder.DropIndex(
                name: "ix_problem_solution_trgm",
                table: "problems");

            migrationBuilder.DropIndex(
                name: "ix_problem_statement_trgm",
                table: "problems");

            migrationBuilder.DropIndex(
                name: "ux_problem_embedding_problem_document_type_embedding_type_model",
                table: "problem_embeddings");

            migrationBuilder.DropColumn(
                name: "solution",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "solution_parsed",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "statement",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "statement_parsed",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "document_type",
                table: "problem_embeddings");

            // Delete all existing embeddings since they will need to be regenerated
            // with the new structure (referencing ProblemText instead of Problem)
            migrationBuilder.Sql("DELETE FROM problem_embeddings;");

            migrationBuilder.RenameColumn(
                name: "problem_id",
                table: "problem_embeddings",
                newName: "problem_text_id");

            migrationBuilder.RenameIndex(
                name: "ix_problem_embedding_problem_id",
                table: "problem_embeddings",
                newName: "ix_problem_embedding_problem_text_id");

            // Manually handle enum type changes
            // First, drop and recreate the document_type enum with new values
            migrationBuilder.Sql(@"
                ALTER TYPE document_type RENAME TO document_type_old;
                CREATE TYPE document_type AS ENUM ('statement', 'solution', 'statement_with_solution');
            ");

            // Create the language enum
            migrationBuilder.Sql(@"
                CREATE TYPE language AS ENUM ('sk', 'cz', 'en');
            ");

            migrationBuilder.CreateTable(
                name: "problem_texts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<DocumentType>(type: "document_type", nullable: false),
                    raw_text = table.Column<string>(type: "text", nullable: false),
                    parsed_text = table.Column<string>(type: "jsonb", nullable: true),
                    language = table.Column<Language>(type: "language", nullable: false),
                    date_modified = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    is_original = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_texts", x => x.id);
                    table.ForeignKey(
                        name: "fk_problem_texts_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_problem_embedding_text_embedding_model",
                table: "problem_embeddings",
                columns: new[] { "problem_text_id", "embedding_type", "model_name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_problem_text_problem_id",
                table: "problem_texts",
                column: "problem_id");

            // Create GIN trigram index on unaccented raw_text for efficient accent-insensitive search
            // Note: Expression indexes must be created via raw SQL because EF Core doesn't support them
            // We create an IMMUTABLE wrapper function because unaccent() is not marked IMMUTABLE by default
            migrationBuilder.Sql(@"
                CREATE OR REPLACE FUNCTION immutable_unaccent(text) 
                RETURNS text AS $$
                    SELECT unaccent($1)
                $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

                CREATE INDEX ix_problem_text_raw_text_unaccent_trgm 
                ON problem_texts 
                USING gin (immutable_unaccent(raw_text) gin_trgm_ops);
            ");

            migrationBuilder.CreateIndex(
                name: "ux_problem_text_one_original_per_problem_document",
                table: "problem_texts",
                columns: new[] { "problem_id", "document_type" },
                unique: true,
                filter: "is_original = true");

            migrationBuilder.CreateIndex(
                name: "ux_problem_text_problem_document_language",
                table: "problem_texts",
                columns: new[] { "problem_id", "document_type", "language" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_problem_embeddings_problem_texts_problem_text_id",
                table: "problem_embeddings",
                column: "problem_text_id",
                principalTable: "problem_texts",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            // Drop the old enum type
            migrationBuilder.Sql(@"
                DROP TYPE document_type_old;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_problem_embeddings_problem_texts_problem_text_id",
                table: "problem_embeddings");

            // Drop the immutable_unaccent function
            migrationBuilder.Sql(@"
                DROP FUNCTION IF EXISTS immutable_unaccent(text);
            ");

            migrationBuilder.DropTable(
                name: "problem_texts");

            migrationBuilder.DropIndex(
                name: "ux_problem_embedding_text_embedding_model",
                table: "problem_embeddings");

            migrationBuilder.RenameColumn(
                name: "problem_text_id",
                table: "problem_embeddings",
                newName: "problem_id");

            migrationBuilder.RenameIndex(
                name: "ix_problem_embedding_problem_text_id",
                table: "problem_embeddings",
                newName: "ix_problem_embedding_problem_id");

            // Drop the language enum
            migrationBuilder.Sql(@"
                DROP TYPE language;
            ");

            // Recreate the old document_type enum
            migrationBuilder.Sql(@"
                ALTER TYPE document_type RENAME TO document_type_new;
                CREATE TYPE document_type AS ENUM ('problem_statement', 'problem_with_solution');
            ");

            migrationBuilder.AddColumn<string>(
                name: "solution",
                table: "problems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "solution_parsed",
                table: "problems",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "statement",
                table: "problems",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "statement_parsed",
                table: "problems",
                type: "jsonb",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DocumentType>(
                name: "document_type",
                table: "problem_embeddings",
                type: "document_type",
                nullable: false,
                defaultValue: DocumentType.Statement);

            migrationBuilder.CreateIndex(
                name: "ix_problem_solution_trgm",
                table: "problems",
                column: "solution",
                filter: "solution IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_problem_statement_trgm",
                table: "problems",
                column: "statement",
                filter: "statement IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ux_problem_embedding_problem_document_type_embedding_type_model",
                table: "problem_embeddings",
                columns: new[] { "problem_id", "document_type", "embedding_type", "model_name" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_problem_embeddings_problems_problem_id",
                table: "problem_embeddings",
                column: "problem_id",
                principalTable: "problems",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            // Drop the new enum type
            migrationBuilder.Sql(@"
                DROP TYPE document_type_new;
            ");
        }
    }
}
