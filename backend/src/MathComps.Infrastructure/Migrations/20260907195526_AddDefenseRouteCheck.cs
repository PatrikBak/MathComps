using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDefenseRouteCheck : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The examiner's step enum gains the route check.
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
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

            // Every attempt recorded so far was judged before the route check existed, so these defaults are what
            // say so for the rows already there. They stay on the columns: the deploy applies this migration while
            // the previous build of the API is still serving, and that build inserts an attempt without naming them.
            migrationBuilder.AddColumn<string>(
                name: "candidate_work",
                table: "defense_turn_attempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "restated_reference_step",
                table: "defense_turn_attempts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "takes_over",
                table: "defense_turn_attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "candidate_work",
                table: "defense_turn_attempts");

            migrationBuilder.DropColumn(
                name: "restated_reference_step",
                table: "defense_turn_attempts");

            migrationBuilder.DropColumn(
                name: "takes_over",
                table: "defense_turn_attempts");

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
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
