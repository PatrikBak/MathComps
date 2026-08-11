using System;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseTurnAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "solution,statement")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "defense_turn_attempts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    turn_id = table.Column<Guid>(type: "uuid", nullable: false),
                    attempt_index = table.Column<int>(type: "integer", nullable: false),
                    reply = table.Column<string>(type: "text", nullable: false),
                    revision_note = table.Column<string>(type: "text", nullable: false),
                    math_holds = table.Column<bool>(type: "boolean", nullable: false),
                    math_correction = table.Column<string>(type: "text", nullable: false),
                    leaks = table.Column<bool>(type: "boolean", nullable: false),
                    what_leaked = table.Column<string>(type: "text", nullable: false),
                    withholds_close = table.Column<bool>(type: "boolean", nullable: false),
                    established = table.Column<string>(type: "text", nullable: false),
                    switches_language = table.Column<bool>(type: "boolean", nullable: false),
                    candidate_language = table.Column<string>(type: "text", nullable: false),
                    is_safe_fallback = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_turn_attempts", x => x.id);
                    table.ForeignKey(
                        name: "fk_defense_turn_attempts_defense_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_defense_turn_attempts_defense_turns_session_id_turn_id",
                        columns: x => new { x.session_id, x.turn_id },
                        principalTable: "defense_turns",
                        principalColumns: new[] { "session_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "defense_attempt_calls",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    attempt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    step = table.Column<ExaminerStep>(type: "examiner_step", nullable: false),
                    model = table.Column<string>(type: "text", nullable: false),
                    reasoning_effort = table.Column<string>(type: "text", nullable: true),
                    cost = table.Column<decimal>(type: "numeric", nullable: false),
                    prompt_tokens = table.Column<int>(type: "integer", nullable: false),
                    completion_tokens = table.Column<int>(type: "integer", nullable: false),
                    reasoning_tokens = table.Column<int>(type: "integer", nullable: false),
                    cached_prompt_tokens = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_attempt_calls", x => x.id);
                    table.ForeignKey(
                        name: "fk_defense_attempt_calls_defense_turn_attempts_attempt_id",
                        column: x => x.attempt_id,
                        principalTable: "defense_turn_attempts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_defense_attempt_calls_attempt_id",
                table: "defense_attempt_calls",
                column: "attempt_id");

            migrationBuilder.CreateIndex(
                name: "ix_defense_turn_attempts_session_id_turn_id",
                table: "defense_turn_attempts",
                columns: new[] { "session_id", "turn_id" });

            migrationBuilder.CreateIndex(
                name: "ux_defense_turn_attempt_turn_id_attempt_index",
                table: "defense_turn_attempts",
                columns: new[] { "turn_id", "attempt_index" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "defense_attempt_calls");

            migrationBuilder.DropTable(
                name: "defense_turn_attempts");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "solution,statement")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "solution,statement")
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
