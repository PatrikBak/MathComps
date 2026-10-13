using MathComps.Domain.EfCoreEntities;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameCommentLikesToReactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:comment_reaction_kind", "thumbs_down,thumbs_up")
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
                .OldAnnotation("Npgsql:Enum:outgoing_mail_status", "failed,pending,sent")
                .OldAnnotation("Npgsql:Enum:proposal_area", "algebra,combinatorics,geometry,number_theory")
                .OldAnnotation("Npgsql:Enum:tag_type", "area,goal,technique,type")
                .OldAnnotation("Npgsql:Enum:transcript_role", "candidate,examiner")
                .OldAnnotation("Npgsql:Enum:user_capability", "prepare_competitions")
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            // A like on a comment is now one of two reactions, so the table keeps its rows under the new name.
            migrationBuilder.RenameTable(
                name: "comment_likes",
                newName: "comment_reactions");

            // Renaming a table renames none of the constraints and indexes hanging off it.
            migrationBuilder.Sql("""
                ALTER TABLE comment_reactions RENAME CONSTRAINT pk_comment_likes TO pk_comment_reactions;
                ALTER TABLE comment_reactions RENAME CONSTRAINT fk_comment_likes_comments_comment_id
                    TO fk_comment_reactions_comments_comment_id;
                ALTER TABLE comment_reactions RENAME CONSTRAINT fk_comment_likes_users_user_id
                    TO fk_comment_reactions_users_user_id;
                """);

            migrationBuilder.RenameIndex(
                name: "ix_comment_like_comment_id",
                table: "comment_reactions",
                newName: "ix_comment_reaction_comment_id");

            // Every heart given so far becomes a 👍.
            migrationBuilder.AddColumn<CommentReactionKind>(
                name: "kind",
                table: "comment_reactions",
                type: "comment_reaction_kind",
                nullable: false,
                defaultValue: CommentReactionKind.ThumbsUp);

            // The default was only ever there for the rows above. Every press from now on names its own kind, and
            // one that somehow didn't should fail rather than turn into a 👍.
            migrationBuilder.Sql("ALTER TABLE comment_reactions ALTER COLUMN kind DROP DEFAULT;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // A like is the 👍 alone, so a 👎 has no row it could become
            migrationBuilder.Sql("DELETE FROM comment_reactions WHERE kind = 'thumbs_down';");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "comment_reactions");

            migrationBuilder.RenameIndex(
                name: "ix_comment_reaction_comment_id",
                table: "comment_reactions",
                newName: "ix_comment_like_comment_id");

            // The constraints back under their old names
            migrationBuilder.Sql("""
                ALTER TABLE comment_reactions RENAME CONSTRAINT pk_comment_reactions TO pk_comment_likes;
                ALTER TABLE comment_reactions RENAME CONSTRAINT fk_comment_reactions_comments_comment_id
                    TO fk_comment_likes_comments_comment_id;
                ALTER TABLE comment_reactions RENAME CONSTRAINT fk_comment_reactions_users_user_id
                    TO fk_comment_likes_users_user_id;
                """);

            migrationBuilder.RenameTable(
                name: "comment_reactions",
                newName: "comment_likes");

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
                .OldAnnotation("Npgsql:Enum:comment_reaction_kind", "thumbs_down,thumbs_up")
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
