using System;
using System.Collections.Generic;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseFeedback : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                .OldAnnotation("Npgsql:Enum:document_type", "solution,statement")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.AddUniqueConstraint(
                name: "ak_defense_turns_session_id_id",
                table: "defense_turns",
                columns: new[] { "session_id", "id" });

            migrationBuilder.CreateTable(
                name: "defense_session_feedbacks",
                columns: table => new
                {
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    outcome = table.Column<DefenseOutcome>(type: "defense_outcome", nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_session_feedbacks", x => x.session_id);
                    table.CheckConstraint("ck_defense_session_feedback_something_else_needs_comment", "outcome <> 'something_else' OR coalesce(btrim(comment, E' \\t\\n\\r\\f'), '') <> ''");
                    table.ForeignKey(
                        name: "fk_defense_session_feedbacks_defense_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "defense_turn_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    turn_id = table.Column<Guid>(type: "uuid", nullable: false),
                    categories = table.Column<List<DefenseReportCategory>>(type: "defense_report_category[]", nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_defense_turn_reports", x => x.id);
                    table.CheckConstraint("ck_defense_turn_report_categories_not_empty", "cardinality(categories) > 0");
                    table.CheckConstraint("ck_defense_turn_report_other_needs_comment", "NOT ('other' = ANY(categories)) OR coalesce(btrim(comment, E' \\t\\n\\r\\f'), '') <> ''");
                    table.ForeignKey(
                        name: "fk_defense_turn_reports_defense_sessions_session_id",
                        column: x => x.session_id,
                        principalTable: "defense_sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_defense_turn_reports_defense_turns_session_id_turn_id",
                        columns: x => new { x.session_id, x.turn_id },
                        principalTable: "defense_turns",
                        principalColumns: new[] { "session_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_defense_turn_report_session_id_turn_id",
                table: "defense_turn_reports",
                columns: new[] { "session_id", "turn_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_defense_turn_report_turn_id",
                table: "defense_turn_reports",
                column: "turn_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "defense_session_feedbacks");

            migrationBuilder.DropTable(
                name: "defense_turn_reports");

            migrationBuilder.DropUniqueConstraint(
                name: "ak_defense_turns_session_id_id",
                table: "defense_turns");

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
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
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
