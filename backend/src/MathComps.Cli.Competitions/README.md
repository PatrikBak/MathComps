# Competitions CLI

Declares a hosted group: the batch of rounds the site runs itself as one competition, and the terms it runs on. A single-command tool: pass it the group manifest, no subcommand.

It imports no problems. It does raise the rows a competition needs to exist: the taxonomy nodes its path names, the season, and the round itself, each created only if the database has not met it yet. Then it sets the window, the clock, the size and whether the group takes re-entries. The problems land later, through the [Bulk Import CLI](../MathComps.Cli.BulkImport/README.md), onto the rounds this tool raised.

So a month goes on the site the day its dates are decided, months before anybody picks what it will ask.

## Usage

```bash
dotnet run --project backend/src/MathComps.Cli.Competitions -- ./data/problems/mc-2026-1.group.json
dotnet run --project backend/src/MathComps.Cli.Competitions -- ./data/problems/mc-2026-1.group.json --dry-run
```

`--dry-run` runs every check and reports what would happen, writing nothing. There's no separate `validate` command: every refusal fires before the run commits either way, so the dry run is the whole check.

Exits `0` when the group is declared (or would be), `1` on anything else: a refused manifest, a manifest that will not parse, or no file at the path given.

## The manifest

```json
{
  "slug": "mc-2026-1",
  "opensAt": "2026-09-14T18:00:00+02:00",
  "closesAt": "2026-09-28T23:00:00+02:00",
  "clockMinutes": 120,
  "allowsReentry": false,
  "problemCount": 4,
  "rounds": [
    { "competitionPath": "mc-elementary-1", "seasonYear": 2026 },
    { "competitionPath": "mc-intermediate-1", "seasonYear": 2026 },
    { "competitionPath": "mc-advanced-1", "seasonYear": 2026 }
  ]
}
```

Leave `closesAt` out for a group that never closes, the way `mc-practice.group.json` does.

`problemCount` is how many problems each of the group's competitions asks. It is announced rather than counted, because a group goes on the site the day its dates are set and the problems are picked later. Every round the manifest names then holds either nothing yet or exactly that many, and a student is refused an entry into one still short of it.

The slug is what the group is addressed by, so re-running the manifest updates the same group, and a round the manifest no longer names is released. That freedom lasts until somebody enters: from the first entry on, the window, the clock, the re-entry rule and the size can no longer change, and a round that has been entered can no longer be dropped. Everything else stays editable, and re-running an unchanged manifest is always fine.

A group carries no name of its own. Its rounds hang off competition nodes the taxonomy already names, and the heading is read off whichever of them sorts first in the taxonomy. Nothing checks that the rest agree, so registering every category of a group under the same name is on you.

## Declaring a group

Two steps.

**1. Register the group's nodes.** In [`metadata.shared.json`](../MathComps.Infrastructure/Resources/metadata.shared.json), plus a `shortName` and `fullName` per node in `metadata.sk.json`, `metadata.cs.json` and `metadata.en.json`. A group is whatever the program runs as one batch. One run at every level gets one `mc-<category>-<group>` node per category, like `mc-elementary-1`, `mc-intermediate-1` and `mc-advanced-1`. A one-off at a single level is instead a single node directly under `mc`, like `mc-practice`, and carries no category at all. Names must be season-independent, `3. súťaž` and never `October 2026`, since the same node runs again next year. This is a code change, so build before running the tool.

**2. Run this tool** with the group manifest. It raises whatever the manifest names that is not there, and refuses a path step 1 did not register.

The problems are their own job, whenever they are ready: one bulk-import draft per round, naming the same node. Re-run this tool afterwards to check what landed matches what the group announced.

## What it refuses

The whole run sits in one transaction, and every refusal fires before it commits, so a manifest is carried out whole or not at all. That covers the rows raising a node writes on its way down, which land mid-walk and are rolled back with everything else.

The document on its own, before the database is opened at all:

- A manifest carrying no `slug`, no `opensAt`, or a `clockMinutes` or `problemCount` that isn't positive. A field the JSON never named arrives as a blank rather than as a complaint, so each of these is checked by hand.
- A `closesAt` at or before `opensAt`.
- A manifest naming no rounds, or an entry in `rounds` carrying no `competitionPath` or no `seasonYear`.
- A round outside the `mc` root, which would have the group claiming rounds of a competition the site only carries.

Then against what has actually landed:

- A competition path the taxonomy cannot place a round on: one it does not register at all, one missing a name in some locale, or one it gives competitions below it, which is a container rather than a sitting. Registering and naming a node is a code change, so it is not the tool's to invent; every other row on the path it raises itself.
- A round holding problems whose `visibleSince` disagrees with `closesAt`. The embargo is what actually holds the problems back, so a group promising a closing date its rounds don't keep is refused. A round still holding nothing carries the embargo this tool wrote for it, and a corrected manifest moves it. A group with no `closesAt` promises no date at all, so its rounds may carry any `visibleSince` — a date far enough out keeps a practice group's problems out of the archive for good.
- A round holding a problem without a statement or a solution in one of the site's languages. Nothing downstream has a fallback for a language a problem was never written in.
- A round holding problems, but not the `problemCount` the manifest announces. A round holding nothing yet passes: that is the case this tool exists for. The card promises that number to everybody who reads it, and every level of a group runs the same paper, so a draft that landed short has to be fixed rather than announced around.
- A round another group already claims, since a round belongs to one group and moving it would silently start reading its clock off the group it landed in.

And the group as it already stands, once anyone has entered it:

- A manifest changing the window, the clock, the re-entry rule or the size of a group somebody has already entered. An entry was spent on the terms that stood when it was spent.
- A manifest dropping a round somebody has already entered. A round the manifest no longer names is released, and a released round's problems are closed to everybody, so dropping an entered one takes back what the entry bought.

## Setup

**Database** — set the connection string in user secrets (see the [main backend README](../../README.md)). Every check reads what has actually landed, so a reachable DB is required even for `--dry-run`.
