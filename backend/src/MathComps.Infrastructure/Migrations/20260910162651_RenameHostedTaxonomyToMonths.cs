using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameHostedTaxonomyToMonths : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every leaf of the hosted tree moves from the ordinal it was keyed by to the month it runs in, and
            // the root from an abbreviation to the spelled-out name. The map is written out node by node, so
            // the rewrite can reach nothing outside the tree it is for.
            CreateRenameMap(migrationBuilder);

            // A problem's slug embeds its competition's path, so it moves with the node it names. Rewriting it
            // before the nodes move is what lets the map still find the competition by its old path.
            migrationBuilder.Sql(
                """
                UPDATE problems AS problem
                SET slug = replace(problem.slug, rename.old_path, rename.new_path)
                FROM rounds AS round
                JOIN competitions AS competition ON competition.id = round.competition_id
                JOIN hosted_taxonomy_rename AS rename ON rename.old_path = competition.path
                WHERE problem.round_id = round.id;
                """);

            // The new paths share no name with the old ones, so the unique index on path never sees a duplicate
            // part-way through the statement.
            migrationBuilder.Sql(
                """
                UPDATE competitions AS competition
                SET path = rename.new_path,
                    slug = rename.new_slug
                FROM hosted_taxonomy_rename AS rename
                WHERE competition.path = rename.old_path;
                """);

            migrationBuilder.Sql("DROP TABLE hosted_taxonomy_rename;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            CreateRenameMap(migrationBuilder);

            migrationBuilder.Sql(
                """
                UPDATE problems AS problem
                SET slug = replace(problem.slug, rename.new_path, rename.old_path)
                FROM rounds AS round
                JOIN competitions AS competition ON competition.id = round.competition_id
                JOIN hosted_taxonomy_rename AS rename ON rename.new_path = competition.path
                WHERE problem.round_id = round.id;
                """);

            migrationBuilder.Sql(
                """
                UPDATE competitions AS competition
                SET path = rename.old_path,
                    slug = rename.old_slug
                FROM hosted_taxonomy_rename AS rename
                WHERE competition.path = rename.new_path;
                """);

            migrationBuilder.Sql("DROP TABLE hosted_taxonomy_rename;");
        }

        /// <summary>
        /// Raises the temporary table both directions read the rename off, one row per node of the hosted tree.
        /// </summary>
        /// <remarks>
        /// A database carrying only some of these nodes renames only those: every statement joins on a path, so
        /// a row matching nothing does nothing, and the whole migration is a no-op where the tree never landed.
        /// </remarks>
        /// <param name="migrationBuilder">The builder the statements are written to.</param>
        private static void CreateRenameMap(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(
                """
                CREATE TEMP TABLE hosted_taxonomy_rename (
                    old_path text PRIMARY KEY,
                    new_path text NOT NULL,
                    old_slug text NOT NULL,
                    new_slug text NOT NULL);

                INSERT INTO hosted_taxonomy_rename (old_path, new_path, old_slug, new_slug) VALUES
                    ('mc',                'mathcomps',                        'mc',           'mathcomps'),
                    ('mc-practice',       'mathcomps-practice',               'practice',     'practice'),
                    ('mc-elementary',     'mathcomps-elementary',             'elementary',   'elementary'),
                    ('mc-elementary-1',   'mathcomps-elementary-september',   '1',            'september'),
                    ('mc-elementary-2',   'mathcomps-elementary-october',     '2',            'october'),
                    ('mc-elementary-3',   'mathcomps-elementary-november',    '3',            'november'),
                    ('mc-intermediate',   'mathcomps-intermediate',           'intermediate', 'intermediate'),
                    ('mc-intermediate-1', 'mathcomps-intermediate-september', '1',            'september'),
                    ('mc-intermediate-2', 'mathcomps-intermediate-october',   '2',            'october'),
                    ('mc-intermediate-3', 'mathcomps-intermediate-november',  '3',            'november'),
                    ('mc-advanced',       'mathcomps-advanced',               'advanced',     'advanced'),
                    ('mc-advanced-1',     'mathcomps-advanced-september',     '1',            'september'),
                    ('mc-advanced-2',     'mathcomps-advanced-october',       '2',            'october'),
                    ('mc-advanced-3',     'mathcomps-advanced-november',      '3',            'november');
                """);
    }
}
