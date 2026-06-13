using System;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;
using Pgvector;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateProblemEmbeddingsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_problem_solution_embedding_cosine",
                table: "problems");

            migrationBuilder.DropIndex(
                name: "ix_problem_statement_embedding_cosine",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "solution_embedding",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "statement_embedding",
                table: "problems");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:document_type", "problem_statement,problem_with_solution")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "problem_embeddings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_id = table.Column<Guid>(type: "uuid", nullable: false),
                    document_type = table.Column<DocumentType>(type: "document_type", nullable: false),
                    embedding_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    model_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    embedding = table.Column<Vector>(type: "vector(1536)", nullable: false),
                    date_updated = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_problem_embeddings", x => x.id);
                    table.ForeignKey(
                        name: "fk_problem_embeddings_problems_problem_id",
                        column: x => x.problem_id,
                        principalTable: "problems",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_problem_embedding_cosine",
                table: "problem_embeddings",
                column: "embedding")
                .Annotation("Npgsql:IndexMethod", "ivfflat")
                .Annotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                .Annotation("Npgsql:StorageParameter:lists", 100);

            migrationBuilder.CreateIndex(
                name: "ix_problem_embedding_problem_id",
                table: "problem_embeddings",
                column: "problem_id");

            migrationBuilder.CreateIndex(
                name: "ux_problem_embedding_problem_document_type_embedding_type_model",
                table: "problem_embeddings",
                columns: new[] { "problem_id", "document_type", "embedding_type", "model_name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "problem_embeddings");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:document_type", "problem_statement,problem_with_solution")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.AddColumn<Vector>(
                name: "solution_embedding",
                table: "problems",
                type: "vector(768)",
                nullable: true);

            migrationBuilder.AddColumn<Vector>(
                name: "statement_embedding",
                table: "problems",
                type: "vector(768)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_problem_solution_embedding_cosine",
                table: "problems",
                column: "solution_embedding",
                filter: "solution_embedding IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "ivfflat")
                .Annotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                .Annotation("Npgsql:StorageParameter:lists", 100);

            migrationBuilder.CreateIndex(
                name: "ix_problem_statement_embedding_cosine",
                table: "problems",
                column: "statement_embedding",
                filter: "statement_embedding IS NOT NULL")
                .Annotation("Npgsql:IndexMethod", "ivfflat")
                .Annotation("Npgsql:IndexOperators", new[] { "vector_cosine_ops" })
                .Annotation("Npgsql:StorageParameter:lists", 100);
        }
    }
}
