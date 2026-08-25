# Competitions CLI

Declares a hosted group: the batch of rounds the site runs itself as one competition, and the terms it runs on. A single-command tool: pass it the group manifest, no subcommand.

It imports nothing. The rounds are ordinary bulk-import drafts, applied by the [Bulk Import CLI](../MathComps.Cli.BulkImport/README.md) first; this only links what is already there and sets the clock, the window and whether the group takes re-entries.

## Usage

```bash
dotnet run --project backend/src/MathComps.Cli.Competitions -- ./data/problems/mc-2026-1.group.json
dotnet run --project backend/src/MathComps.Cli.Competitions -- ./data/problems/mc-2026-1.group.json --dry-run
```

`--dry-run` runs every check and reports what would happen, writing nothing. There's no separate `validate` command: a manifest is only ever checked against rounds that already exist, so the dry run is the whole check.

Exits `0` when the group is declared (or would be), `1` on anything else: a refused manifest, a manifest that will not parse, or no file at the path given.

## The manifest

```json
{
  "slug": "mc-2026-1",
  "opensAt": "2026-09-14T18:00:00+02:00",
  "closesAt": "2026-09-28T23:00:00+02:00",
  "clockMinutes": 120,
  "allowsReentry": false,
  "rounds": [
    { "competitionPath": "mc-elementary-1", "seasonYear": 2026 },
    { "competitionPath": "mc-intermediate-1", "seasonYear": 2026 },
    { "competitionPath": "mc-advanced-1", "seasonYear": 2026 }
  ]
}
```

Leave `closesAt` out for a group that never closes, the way `mc-practice.group.json` does.

The slug is what the group is addressed by, so re-running the manifest updates the same group, and a round the manifest no longer names is released. That freedom lasts until somebody enters: from the first entry on, the window, the clock and the re-entry rule can no longer change, and a round that has been entered can no longer be dropped. Everything else stays editable, and re-running an unchanged manifest is always fine.

A group carries no name of its own. Its rounds hang off competition nodes the taxonomy already names, and the heading is read off whichever of them sorts first in the taxonomy. Nothing checks that the rest agree, so registering every category of a group under the same name is on you.

## Declaring a group

Three steps, in order.

**1. Register the group's nodes.** In [`metadata.shared.json`](../MathComps.Infrastructure/Resources/metadata.shared.json), plus a `shortName` and `fullName` per node in `metadata.sk.json`, `metadata.cs.json` and `metadata.en.json`. A group is whatever the program runs as one batch. One run at every level gets one `mc-<category>-<group>` node per category, like `mc-elementary-1`, `mc-intermediate-1` and `mc-advanced-1`. A one-off at a single level is instead a single node directly under `mc`, like `mc-practice`, and carries no category at all. Names must be season-independent, `3. súťaž` and never `October 2026`, since the same node runs again next year. This is a code change, so build before running either CLI.

**2. Apply one draft per round** with the [Bulk Import CLI](../MathComps.Cli.BulkImport/README.md). Each draft's `_meta.yaml` points at the group node, not at the category above it: a category node stops being a leaf once it has group children, and the registry check requires the draft to name the deepest node.

**3. Run this tool** with the group manifest.

## What it refuses

Every refusal fires before anything is written, so a manifest is applied whole or not at all.

The document on its own, before the database is opened at all:

- A manifest carrying no `slug`, no `opensAt`, or a `clockMinutes` that isn't positive. A field the JSON never named arrives as a blank rather than as a complaint, so each of these is checked by hand.
- A `closesAt` at or before `opensAt`.
- A manifest naming no rounds, or an entry in `rounds` carrying no `competitionPath`.
- A round outside the `mc` root, which would have the group claiming rounds of a competition the site only carries.

Then against what has actually landed:

- A round whose draft hasn't landed yet, since the group would otherwise stand without it and nothing would say so.
- A round whose `visibleSince` disagrees with `closesAt`. The embargo is what actually holds the problems back, so a group promising a closing date its rounds don't keep is refused. A group with no `closesAt` promises no date at all, so its rounds may carry any `visibleSince` — a date far enough out keeps a practice group's problems out of the archive for good.
- A round holding a problem without a statement or a solution in one of the site's languages. Nothing downstream has a fallback for a language a problem was never written in.
- Rounds holding different numbers of problems. They are one competition run at several levels, so picking a harder one must not mean a longer paper.
- Rounds holding no problems at all, which would declare a group with nothing in it to solve.
- A round another group already claims, since a round belongs to one group and moving it would silently start reading its clock off the group it landed in.

And the group as it already stands, once anyone has entered it:

- A manifest changing the window, the clock or the re-entry rule of a group somebody has already entered. An entry was spent on the terms that stood when it was spent.
- A manifest dropping a round somebody has already entered. A round the manifest no longer names is released, and a released round's problems are closed to everybody, so dropping an entered one takes back what the entry bought.

## Setup

**Database** — set the connection string in user secrets (see the [main backend README](../../README.md)). The manifest is applied against rounds that are already in the database, so a reachable DB is required even for `--dry-run`.
