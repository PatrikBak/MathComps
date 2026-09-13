using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHintsDocumentType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
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
                .OldAnnotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:Enum:user_capability", "bypass_competition_gates")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
