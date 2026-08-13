using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FlattenTaxonomyIntoContestNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The rename below moves no rows, so the only way to lose one is to drop the wrong table. Remember
            // how many there were and check it at the end.
            migrationBuilder.Sql(
                "CREATE TEMP TABLE flatten_taxonomy_guard AS SELECT count(*) AS instances FROM round_instances;");

            // Every generation now takes its order from the children its own parent lists, where the flat
            // registry gave one round list to a whole competition — so a category that never ran the school
            // round no longer leaves that slot empty. Park everything first: a uniform shift keeps the
            // per-parent unique index satisfied and puts every stored order above every value about to be
            // claimed, so no single row-update on the way down can collide.
            migrationBuilder.Sql("UPDATE competitions SET sort_order = sort_order + 1000;");

            // Close the gaps, keeping each generation in the order it already read in.
            migrationBuilder.Sql("""
                WITH packed AS (
                    SELECT id, row_number() OVER (PARTITION BY parent_id ORDER BY sort_order) AS position
                    FROM competitions
                )
                UPDATE competitions SET sort_order = packed.position
                FROM packed WHERE competitions.id = packed.id;
                """);

            // A sort path reads down the whole chain, so closing a gap above rewrites everything below it.
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

            // A shadow FK that only ever existed because the category entity carried a problems navigation.
            // Every row is null and nothing reads it.
            migrationBuilder.DropForeignKey(
                name: "fk_problems_categories_category_id",
                table: "problems");

            migrationBuilder.DropIndex(
                name: "ix_problems_category_id",
                table: "problems");

            migrationBuilder.DropColumn(
                name: "category_id",
                table: "problems");

            // The competition an instance points at already carries the whole taxonomy, at the depth the round
            // sits, so the round it was raised from is dead weight.
            migrationBuilder.DropForeignKey(
                name: "fk_round_instances_rounds_round_id",
                table: "round_instances");

            migrationBuilder.DropIndex(
                name: "ux_round_instance_round_season",
                table: "round_instances");

            migrationBuilder.DropColumn(
                name: "round_id",
                table: "round_instances");

            // Nothing references either table now. They go before the rename, which needs the name back.
            migrationBuilder.DropTable(
                name: "rounds");

            migrationBuilder.DropTable(
                name: "categories");

            // An instance of a round is simply a round now: one sitting of one contest in one season.
            migrationBuilder.RenameTable(
                name: "round_instances",
                newName: "rounds");

            // Renaming a table renames none of the constraints and indexes hanging off it.
            migrationBuilder.Sql("""
                ALTER TABLE rounds RENAME CONSTRAINT pk_round_instances TO pk_rounds;
                ALTER TABLE rounds RENAME CONSTRAINT fk_round_instances_competitions_competition_id
                    TO fk_rounds_competitions_competition_id;
                ALTER TABLE rounds RENAME CONSTRAINT fk_round_instances_seasons_season_id
                    TO fk_rounds_seasons_season_id;
                """);

            migrationBuilder.RenameIndex(
                name: "ix_round_instances_season_id",
                table: "rounds",
                newName: "ix_rounds_season_id");

            migrationBuilder.RenameIndex(
                name: "ux_round_instance_competition_season",
                table: "rounds",
                newName: "ux_round_competition_season");

            // The problem's own reference follows the entity it names.
            migrationBuilder.RenameColumn(
                name: "round_instance_id",
                table: "problems",
                newName: "round_id");

            migrationBuilder.RenameIndex(
                name: "ux_problem_round_instance_number",
                table: "problems",
                newName: "ux_problem_round_number");

            migrationBuilder.Sql("""
                ALTER TABLE problems RENAME CONSTRAINT fk_problems_round_instances_round_instance_id
                    TO fk_problems_rounds_round_id;
                """);

            // Every sitting that stood before the drops has to still be standing after them.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF (SELECT count(*) FROM rounds) <> (SELECT instances FROM flatten_taxonomy_guard) THEN
                        RAISE EXCEPTION 'Flattening lost rounds: % remain of %',
                            (SELECT count(*) FROM rounds), (SELECT instances FROM flatten_taxonomy_guard);
                    END IF;
                END $$;
                """);

            migrationBuilder.Sql("DROP TABLE flatten_taxonomy_guard;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The three-level shape can only hold a contest three deep, which is the whole reason it went.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM competitions competition
                        WHERE array_length(string_to_array(competition.path, '-'), 1) > 3
                          AND EXISTS (SELECT 1 FROM rounds round WHERE round.competition_id = competition.id)
                    ) THEN
                        RAISE EXCEPTION 'A contest deeper than three levels carries rounds, which competition/category/round cannot express.';
                    END IF;
                END $$;
                """);

            // Give the name back to the round definitions, and the sittings their old one.
            migrationBuilder.Sql("""
                ALTER TABLE problems RENAME CONSTRAINT fk_problems_rounds_round_id
                    TO fk_problems_round_instances_round_instance_id;
                """);

            migrationBuilder.RenameIndex(
                name: "ux_problem_round_number",
                table: "problems",
                newName: "ux_problem_round_instance_number");

            migrationBuilder.RenameColumn(
                name: "round_id",
                table: "problems",
                newName: "round_instance_id");

            migrationBuilder.RenameIndex(
                name: "ux_round_competition_season",
                table: "rounds",
                newName: "ux_round_instance_competition_season");

            migrationBuilder.RenameIndex(
                name: "ix_rounds_season_id",
                table: "rounds",
                newName: "ix_round_instances_season_id");

            migrationBuilder.Sql("""
                ALTER TABLE rounds RENAME CONSTRAINT pk_rounds TO pk_round_instances;
                ALTER TABLE rounds RENAME CONSTRAINT fk_rounds_competitions_competition_id
                    TO fk_round_instances_competitions_competition_id;
                ALTER TABLE rounds RENAME CONSTRAINT fk_rounds_seasons_season_id
                    TO fk_round_instances_seasons_season_id;
                """);

            migrationBuilder.RenameTable(
                name: "rounds",
                newName: "round_instances");

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.id);
                    table.CheckConstraint("ck_category_sort_order_positive", "\"sort_order\" > 0");
                });

            migrationBuilder.CreateTable(
                name: "rounds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    competition_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<Guid>(type: "uuid", nullable: true),
                    slug = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    composite_slug = table.Column<string>(
                        type: "character varying(100)", maxLength: 100, nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_default = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rounds", x => x.id);
                    table.CheckConstraint("ck_round_sort_order_positive", "\"sort_order\" > 0");
                    table.ForeignKey(
                        name: "fk_rounds_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_rounds_competitions_competition_id",
                        column: x => x.competition_id,
                        principalTable: "competitions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            // A category is a node one level under a root, and the global order it used to carry is the order
            // those nodes read in across the tree.
            migrationBuilder.Sql("""
                INSERT INTO categories (id, slug, sort_order)
                SELECT gen_random_uuid(), ranked.slug, ranked.position
                FROM (
                    SELECT node.slug, row_number() OVER (ORDER BY min(node.sort_path)) AS position
                    FROM competitions node
                    WHERE array_length(string_to_array(node.path, '-'), 1) = 2
                      AND EXISTS (
                          SELECT 1 FROM competitions grandchild WHERE grandchild.parent_id = node.id)
                    GROUP BY node.slug
                ) ranked;
                """);

            // A round is a node that carries sittings: its path is the composite slug, its competition the root
            // it descends from, and its category the level between them when there is one. A node sitting at a
            // root is what a default round used to be — an empty slug, sorting first.
            migrationBuilder.Sql("""
                INSERT INTO rounds (id, competition_id, category_id, slug, composite_slug, sort_order, is_default)
                SELECT gen_random_uuid(),
                       root.id,
                       category.id,
                       CASE WHEN depth.value = 1 THEN '' ELSE node.slug END,
                       node.path,
                       CASE WHEN depth.value = 1 THEN 1 ELSE node.sort_order END,
                       depth.value = 1
                FROM competitions node
                CROSS JOIN LATERAL (SELECT array_length(string_to_array(node.path, '-'), 1)) AS depth(value)
                JOIN competitions root ON root.path = split_part(node.path, '-', 1)
                LEFT JOIN categories category
                  ON depth.value = 3 AND category.slug = split_part(node.path, '-', 2)
                WHERE EXISTS (SELECT 1 FROM round_instances instance WHERE instance.competition_id = node.id);
                """);

            // Nullable while the backfill runs; every instance has a round by the time it is tightened.
            migrationBuilder.AddColumn<Guid>(
                name: "round_id",
                table: "round_instances",
                type: "uuid",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE round_instances
                SET round_id = round.id
                FROM competitions competition
                JOIN rounds round ON round.composite_slug = competition.path
                WHERE competition.id = round_instances.competition_id;
                """);

            migrationBuilder.AlterColumn<Guid>(
                name: "round_id",
                table: "round_instances",
                type: "uuid",
                nullable: false);

            migrationBuilder.AddColumn<Guid>(
                name: "category_id",
                table: "problems",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_problems_category_id",
                table: "problems",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ix_rounds_category_id",
                table: "rounds",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "ux_category_slug",
                table: "categories",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_category_sort_order",
                table: "categories",
                column: "sort_order",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_round_composite_slug",
                table: "rounds",
                column: "composite_slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_round_competition_category_slug",
                table: "rounds",
                columns: new[] { "competition_id", "category_id", "slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_round_competition_category_sort_order_when_category_not_null",
                table: "rounds",
                columns: new[] { "competition_id", "category_id", "sort_order" },
                unique: true,
                filter: "\"category_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ux_round_competition_category_sort_order_when_category_null",
                table: "rounds",
                columns: new[] { "competition_id", "sort_order" },
                unique: true,
                filter: "\"category_id\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_round_instance_round_season",
                table: "round_instances",
                columns: new[] { "round_id", "season_id" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_problems_categories_category_id",
                table: "problems",
                column: "category_id",
                principalTable: "categories",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_round_instances_rounds_round_id",
                table: "round_instances",
                column: "round_id",
                principalTable: "rounds",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // The gaps the flattening closed are not recoverable: the flat registry's competition-wide round
            // list is what put them there, and it no longer exists to read them back out of. The next apply
            // renumbers to whatever the registry says, which is what these orders meant in the first place.
        }
    }
}
