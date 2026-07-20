using System;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:document_type", "solution,statement")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:document_type", "solution,statement")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "defense_sessions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    problem_key = table.Column<string>(type: "text", nullable: false),
                    problem_statement = table.Column<string>(type: "text", nullable: false),
                    problem_reference = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_sessions", x => x.id);
                    table.ForeignKey(
                        name: "fk_defense_sessions_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "defense_spends",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cost = table.Column<decimal>(type: "numeric", nullable: false),
                    prompt_tokens = table.Column<int>(type: "integer", nullable: false),
                    completion_tokens = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_spends", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "defense_turns",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<TranscriptRole>(type: "transcript_role", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    sequence = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_turns", x => x.id);
                    table.ForeignKey(
                        name: "fk_defense_turns_defense_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_defense_session_user_id_problem_key",
                table: "defense_sessions",
                columns: new[] { "user_id", "problem_key" });

            migrationBuilder.CreateIndex(
                name: "ix_defense_spend_user_id_created_at",
                table: "defense_spends",
                columns: new[] { "user_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_defense_turn_session_id_sequence",
                table: "defense_turns",
                columns: new[] { "session_id", "sequence" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "defense_spends");

            migrationBuilder.DropTable(
                name: "defense_turns");

            migrationBuilder.DropTable(
                name: "defense_sessions");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:document_type", "solution,statement")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:document_type", "solution,statement")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
