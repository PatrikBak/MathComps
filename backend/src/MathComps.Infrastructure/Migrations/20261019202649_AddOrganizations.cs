using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrganizations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "organization_id",
                table: "selection_boards",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "organization_id",
                table: "proposals",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "organizations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organizations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "organization_members",
                columns: table => new
                {
                    organization_id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_organization_members", x => new { x.organization_id, x.email });
                    table.CheckConstraint("ck_organization_member_email_lowercase", "\"email\" = lower(\"email\")");
                    table.ForeignKey(
                        name: "fk_organization_members_organizations_organization_id",
                        column: x => x.organization_id,
                        principalTable: "organizations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_selection_boards_organization_id",
                table: "selection_boards",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ix_proposals_organization_id",
                table: "proposals",
                column: "organization_id");

            migrationBuilder.CreateIndex(
                name: "ux_organization_slug",
                table: "organizations",
                column: "slug",
                unique: true);

            // The MathComps organization, which prepares the competitions the site hosts.
            migrationBuilder.Sql("INSERT INTO organizations (id, slug) VALUES (gen_random_uuid(), 'mathcomps');");

            // Every standing proposal and board is MathComps', so the pool and the boards read as they did.
            migrationBuilder.Sql(
                """
                UPDATE proposals SET organization_id = (SELECT id FROM organizations WHERE slug = 'mathcomps');
                UPDATE selection_boards SET organization_id = (SELECT id FROM organizations WHERE slug = 'mathcomps');
                """);

            // The defaults were only ever scaffolding for the fill above, so they go.
            migrationBuilder.Sql(
                """
                ALTER TABLE proposals ALTER COLUMN organization_id DROP DEFAULT;
                ALTER TABLE selection_boards ALTER COLUMN organization_id DROP DEFAULT;
                """);

            // Everybody the grant let prepare the competitions keeps doing so wherever their account carries an
            // address, a member since they were granted, so their test runs stay test runs. Two accounts can share an
            // address, so each address lands once, at the earlier grant.
            migrationBuilder.Sql(
                """
                INSERT INTO organization_members (organization_id, email, added_at)
                SELECT o.id, lower(u.email), min(g.granted_at)
                FROM user_grants g
                JOIN users u ON u.id = g.user_id
                CROSS JOIN organizations o
                WHERE o.slug = 'mathcomps'
                  AND g.capability = 'prepare_competitions'
                  AND u.email IS NOT NULL
                  AND u.email <> ''
                GROUP BY o.id, lower(u.email);
                """);

            migrationBuilder.AddForeignKey(
                name: "fk_proposals_organizations_organization_id",
                table: "proposals",
                column: "organization_id",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_selection_boards_organizations_organization_id",
                table: "selection_boards",
                column: "organization_id",
                principalTable: "organizations",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // The grant's holders are on the list now, so the grant goes, and its type with it.
            migrationBuilder.DropTable(
                name: "user_grants");

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_proposals_organizations_organization_id",
                table: "proposals");

            migrationBuilder.DropForeignKey(
                name: "fk_selection_boards_organizations_organization_id",
                table: "selection_boards");

            migrationBuilder.DropTable(
                name: "organization_members");

            migrationBuilder.DropTable(
                name: "organizations");

            migrationBuilder.DropIndex(
                name: "ix_selection_boards_organization_id",
                table: "selection_boards");

            migrationBuilder.DropIndex(
                name: "ix_proposals_organization_id",
                table: "proposals");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "selection_boards");

            migrationBuilder.DropColumn(
                name: "organization_id",
                table: "proposals");

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
                .OldAnnotation("Npgsql:PostgresExtension:pg_trgm", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:unaccent", ",,")
                .OldAnnotation("Npgsql:PostgresExtension:vector", ",,");

            migrationBuilder.CreateTable(
                name: "user_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capability = table.Column<string>(type: "user_capability", nullable: false),
                    granted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_grants", x => x.id);
                    table.ForeignKey(
                        name: "fk_user_grants_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_user_grant_user_id_capability",
                table: "user_grants",
                columns: new[] { "user_id", "capability" },
                unique: true);
        }
    }
}
