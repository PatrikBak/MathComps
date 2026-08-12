using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class MakeCompetitionsATree : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A slug is only unique among siblings once categories and rounds join the table, and a sort order
            // only within its own generation. The path and the two filtered indexes below take over.
            migrationBuilder.DropIndex(
                name: "ux_competition_slug",
                table: "competitions");

            migrationBuilder.DropIndex(
                name: "ux_competition_sort_order",
                table: "competitions");

            migrationBuilder.AddColumn<Guid>(
                name: "parent_id",
                table: "competitions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "path",
                table: "competitions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "sort_path",
                table: "competitions",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            // Nullable while the backfill runs; every instance has a competition by the time it is tightened.
            migrationBuilder.AddColumn<Guid>(
                name: "competition_id",
                table: "round_instances",
                type: "uuid",
                nullable: true);

            // The rows already here are the roots, and a root extends nothing, so its path is its own slug.
            migrationBuilder.Sql("UPDATE competitions SET path = slug;");

            // A category joins as a child of every competition whose rounds actually use it, keeping the order
            // it already had. Position stays absolute, so a category a competition never used leaves its slot
            // empty rather than packing the rest down.
            migrationBuilder.Sql("""
                INSERT INTO competitions (id, parent_id, slug, path, sort_path, sort_order)
                SELECT gen_random_uuid(), parent.id, category.slug, parent.path || '-' || category.slug, '',
                       category.sort_order
                FROM (SELECT DISTINCT competition_id, category_id FROM rounds WHERE category_id IS NOT NULL) used
                JOIN categories category ON category.id = used.category_id
                JOIN competitions parent ON parent.id = used.competition_id;
                """);

            // An explicit round joins under its category, or under its competition when it has none, keeping
            // the order it already had. A default round is skipped: it stands for its whole competition, whose
            // row its instances will point at.
            migrationBuilder.Sql("""
                INSERT INTO competitions (id, parent_id, slug, path, sort_path, sort_order)
                SELECT gen_random_uuid(), parent.id, round.slug, parent.path || '-' || round.slug, '',
                       round.sort_order
                FROM rounds round
                JOIN competitions brand ON brand.id = round.competition_id
                LEFT JOIN categories category ON category.id = round.category_id
                JOIN competitions parent
                  ON parent.path = CASE
                       WHEN round.category_id IS NULL THEN brand.path
                       ELSE brand.path || '-' || category.slug
                     END
                WHERE round.slug <> '';
                """);

            // The composite slug a round already carries is exactly the path of the competition it resolves to,
            // which lands a default round on its whole competition without a special case.
            migrationBuilder.Sql("""
                UPDATE round_instances
                SET competition_id = competition.id
                FROM rounds round
                JOIN competitions competition ON competition.path = round.composite_slug
                WHERE round.id = round_instances.round_id;
                """);

            // An instance the backfill could not place would otherwise surface as a bare not-null violation.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM round_instances WHERE competition_id IS NULL) THEN
                        RAISE EXCEPTION 'No competition matched the composite slug of % round instance(s)',
                            (SELECT count(*) FROM round_instances WHERE competition_id IS NULL);
                    END IF;
                END $$;
                """);

            // The sort path reads down the whole chain, so it is stamped once the tree is complete.
            migrationBuilder.Sql("""
                WITH RECURSIVE walk AS (
                    SELECT id, lpad(sort_order::text, 4, '0') AS sort_path
                    FROM competitions
                    WHERE parent_id IS NULL
                    UNION ALL
                    SELECT child.id, walk.sort_path || '.' || lpad(child.sort_order::text, 4, '0')
                    FROM competitions child
                    JOIN walk ON child.parent_id = walk.id
                )
                UPDATE competitions SET sort_path = walk.sort_path FROM walk WHERE competitions.id = walk.id;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "competition_id",
                table: "round_instances",
                type: "uuid",
                nullable: false);

            migrationBuilder.CreateIndex(
                name: "ux_round_instance_competition_season",
                table: "round_instances",
                columns: new[] { "competition_id", "season_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_competition_parent_sort_order",
                table: "competitions",
                columns: new[] { "parent_id", "sort_order" },
                unique: true,
                filter: "\"parent_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_competition_path",
                table: "competitions",
                column: "path",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_competition_root_sort_order",
                table: "competitions",
                column: "sort_order",
                unique: true,
                filter: "\"parent_id\" IS NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_competition_slug_has_no_hyphen",
                table: "competitions",
                sql: "position('-' in \"slug\") = 0");

            migrationBuilder.AddForeignKey(
                name: "fk_competitions_competitions_parent_id",
                table: "competitions",
                column: "parent_id",
                principalTable: "competitions",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_round_instances_competitions_competition_id",
                table: "round_instances",
                column: "competition_id",
                principalTable: "competitions",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_competitions_competitions_parent_id",
                table: "competitions");

            migrationBuilder.DropForeignKey(
                name: "fk_round_instances_competitions_competition_id",
                table: "round_instances");

            migrationBuilder.DropIndex(
                name: "ux_round_instance_competition_season",
                table: "round_instances");

            migrationBuilder.DropIndex(
                name: "ux_competition_parent_sort_order",
                table: "competitions");

            migrationBuilder.DropIndex(
                name: "ux_competition_path",
                table: "competitions");

            migrationBuilder.DropIndex(
                name: "ux_competition_root_sort_order",
                table: "competitions");

            migrationBuilder.DropCheckConstraint(
                name: "ck_competition_slug_has_no_hyphen",
                table: "competitions");

            migrationBuilder.DropColumn(
                name: "competition_id",
                table: "round_instances");

            // Everything below a root was a category or a round before this migration, and goes back to being
            // one — leaving them would break the slug and sort-order uniqueness restored at the end.
            migrationBuilder.Sql("DELETE FROM competitions WHERE parent_id IS NOT NULL;");

            migrationBuilder.DropColumn(
                name: "parent_id",
                table: "competitions");

            migrationBuilder.DropColumn(
                name: "path",
                table: "competitions");

            migrationBuilder.DropColumn(
                name: "sort_path",
                table: "competitions");

            migrationBuilder.CreateIndex(
                name: "ux_competition_slug",
                table: "competitions",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_competition_sort_order",
                table: "competitions",
                column: "sort_order",
                unique: true);
        }
    }
}
