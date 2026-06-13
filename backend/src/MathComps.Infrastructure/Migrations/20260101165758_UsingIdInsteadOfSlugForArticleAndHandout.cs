using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MathComps.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UsingIdInsteadOfSlugForArticleAndHandout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_news_article_slug",
                table: "news_articles");

            migrationBuilder.DropIndex(
                name: "ux_handout_slug",
                table: "handouts");

            migrationBuilder.DropColumn(
                name: "slug",
                table: "news_articles");

            migrationBuilder.DropColumn(
                name: "slug",
                table: "handouts");

            migrationBuilder.AddColumn<string>(
                name: "content_id",
                table: "news_articles",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "content_id",
                table: "handouts",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ux_news_article_content_id",
                table: "news_articles",
                column: "content_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_handout_content_id",
                table: "handouts",
                column: "content_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_news_article_content_id",
                table: "news_articles");

            migrationBuilder.DropIndex(
                name: "ux_handout_content_id",
                table: "handouts");

            migrationBuilder.DropColumn(
                name: "content_id",
                table: "news_articles");

            migrationBuilder.DropColumn(
                name: "content_id",
                table: "handouts");

            migrationBuilder.AddColumn<string>(
                name: "slug",
                table: "news_articles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "slug",
                table: "handouts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ux_news_article_slug",
                table: "news_articles",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_handout_slug",
                table: "handouts",
                column: "slug",
                unique: true);
        }
    }
}
