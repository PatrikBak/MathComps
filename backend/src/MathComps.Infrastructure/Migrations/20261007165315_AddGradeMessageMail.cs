using System;
using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGradeMessageMail : Migration
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
                .Annotation("Npgsql:Enum:hosted_competition_category", "advanced,elementary,intermediate")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:outgoing_mail_status", "failed,pending,sent")
                .Annotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:Enum:user_capability", "prepare_competitions")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .OldAnnotation("Npgsql:Enum:hosted_competition_category", "advanced,elementary,intermediate")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:Enum:user_capability", "prepare_competitions")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "outgoing_mails",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient_address = table.Column<string>(type: "text", nullable: false),
                    subject = table.Column<string>(type: "text", nullable: false),
                    html = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<OutgoingMailStatus>(type: "outgoing_mail_status", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    provider_id = table.Column<string>(type: "text", nullable: true),
                    last_error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_outgoing_mails", x => x.id);
                    table.CheckConstraint("ck_outgoing_mail_attempts_non_negative", "\"attempts\" >= 0");
                    table.CheckConstraint("ck_outgoing_mail_next_attempt_at_when_pending", "(\"status\" = 'pending') = (\"next_attempt_at\" IS NOT NULL)");
                    table.CheckConstraint("ck_outgoing_mail_provider_id_when_sent", "\"status\" = 'sent' OR \"provider_id\" IS NULL");
                    table.CheckConstraint("ck_outgoing_mail_sent_at_when_sent", "(\"status\" = 'sent') = (\"sent_at\" IS NOT NULL)");
                });

            migrationBuilder.CreateTable(
                name: "grade_message_notices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    mail_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_grade_message_notices", x => x.id);
                    table.ForeignKey(
                        name: "fk_grade_message_notices_comments_comment_id",
                        column: x => x.comment_id,
                        principalTable: "comments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_grade_message_notices_outgoing_mails_mail_id",
                        column: x => x.mail_id,
                        principalTable: "outgoing_mails",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_grade_message_notices_users_recipient_id",
                        column: x => x.recipient_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_grade_message_notice_comment_id",
                table: "grade_message_notices",
                column: "comment_id");

            migrationBuilder.CreateIndex(
                name: "ix_grade_message_notice_mail_id",
                table: "grade_message_notices",
                column: "mail_id");

            migrationBuilder.CreateIndex(
                name: "ix_grade_message_notice_recipient_id_unclaimed",
                table: "grade_message_notices",
                column: "recipient_id",
                filter: "\"mail_id\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_outgoing_mail_next_attempt_at_pending",
                table: "outgoing_mails",
                column: "next_attempt_at",
                filter: "\"status\" = 'pending'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "grade_message_notices");

            migrationBuilder.DropTable(
                name: "outgoing_mails");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .Annotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .Annotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .Annotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .Annotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .Annotation("Npgsql:Enum:hosted_competition_category", "advanced,elementary,intermediate")
                .Annotation("Npgsql:Enum:language", "cs,en,sk")
                .Annotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .Annotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .Annotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .Annotation("Npgsql:Enum:user_capability", "prepare_competitions")
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .Annotation("Npgsql:PostgresExtension:unaccent", ",,")
                .Annotation("Npgsql:PostgresExtension:vector", ",,")
                .OldAnnotation("Npgsql:Enum:comment_status", "active,deleted,superseded")
                .OldAnnotation("Npgsql:Enum:defense_outcome", "confirmed_the_solution,found_the_mistake,not_enough_help,something_else,was_off")
                .OldAnnotation("Npgsql:Enum:defense_report_category", "gave_away,missed_the_mistake,misunderstood,other,said_something_wrong,tone")
                .OldAnnotation("Npgsql:Enum:document_type", "hints,solution,statement")
                .OldAnnotation("Npgsql:Enum:examiner_step", "generate,language_check,leak_check,math_check,route_check")
                .OldAnnotation("Npgsql:Enum:hosted_competition_category", "advanced,elementary,intermediate")
                .OldAnnotation("Npgsql:Enum:language", "cs,en,sk")
                .OldAnnotation("Npgsql:Enum:outgoing_mail_status", "failed,pending,sent")
                .OldAnnotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:Enum:user_capability", "prepare_competitions")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");
        }
    }
}
