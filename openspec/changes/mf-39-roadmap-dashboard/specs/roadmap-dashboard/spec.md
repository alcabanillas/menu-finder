## Purpose

Gives the author a visual, reproducible view of the project plan, generated from `context/roadmap.md`: progress per sprint, who does each item, which pending items are ready or blocked, remaining estimated hours and the daily pace needed to meet the deadline.

## ADDED Requirements

### Requirement: Roadmap notation
The roadmap SHALL mark each item as a list line starting with `✅` (done) or `⬜` (pending) followed by a bold ID `**MF-<nn>**`. An item MAY carry one metadata block right after its ID, in parentheses, with up to three fields in this order, separated by `·`, each optional:
- estimate: `~N h`, where N is a positive number with `.` or `,` as decimal separator;
- owner: `H` (human), `A` (agent) or `H→A` (the human decides, then an agent executes);
- dependencies: `tras ` followed by one or more `MF-<nn>` separated by commas.

Items belong to the sprint of the nearest preceding `## Sprint <n>` heading. The roadmap SHALL contain one line `**Fecha límite:** YYYY-MM-DD`.

#### Scenario: Item with all fields
- **WHEN** the roadmap contains `- ⬜ **MF-16** (~10 h · A · tras MF-14, MF-10) CLI de ingesta` under `## Sprint 1`
- **THEN** the command reads MF-16 as pending, in Sprint 1, estimated at 10 hours, owned by the agent and depending on MF-14 and MF-10

#### Scenario: Partial metadata
- **WHEN** an item carries `(~0,5 h)` only, or `(H)` only
- **THEN** the first is read as 0.5 hours with no owner and no dependencies, and the second as owned by the human with no estimate and no dependencies

#### Scenario: Item without metadata
- **WHEN** a pending item has no metadata block
- **THEN** the page marks it as not estimated and without owner, and the summary shows how many pending items lack an estimate and how many lack an owner

### Requirement: Generate the dashboard page
`pnpm roadmap` SHALL write `reports/roadmap.html` as one self-contained page that loads nothing from the network. The page SHALL show:
- the items done and the total;
- the remaining hours (the sum of the estimates of the pending items), and the same sum split by owner: `H`, `H→A`, `A` and no owner;
- the days left from the run date to the deadline, both included, and the hours per day needed (remaining hours divided by days left);
- one block per sprint with its progress (done items out of total) and each item with its ID, status, estimate, owner and dependencies.

#### Scenario: Summary figures
- **WHEN** the roadmap has 3 items, 1 done and 2 pending estimated at 4 h (`H`) and 6 h (`A`), the deadline is 2026-10-25 and the command runs on 2026-10-21
- **THEN** the page shows 1 of 3 done, 10 remaining hours (4 h `H`, 6 h `A`), 5 days left and 2 hours per day

#### Scenario: Sprint blocks
- **WHEN** the roadmap has items under `## Sprint 1` and `## Sprint 2`
- **THEN** the page shows one block per sprint, in roadmap order, each with its own progress and items

#### Scenario: Deadline passed
- **WHEN** the run date is after the deadline
- **THEN** the page shows 0 days left and flags the deadline as passed instead of a pace figure

### Requirement: Ready and blocked items
The page SHALL show each pending item as ready when all its dependencies are done, and as blocked otherwise, naming the pending dependencies that block it. A pending item with no dependencies is ready. The page SHALL list the ready items together, so the items that can be worked on in parallel are visible at once.

#### Scenario: Ready item
- **WHEN** MF-16 depends on MF-14 and MF-10, and both are done
- **THEN** MF-16 appears as ready and in the list of ready items

#### Scenario: Blocked item
- **WHEN** MF-16 depends on MF-14 (pending) and MF-10 (done)
- **THEN** MF-16 appears as blocked by MF-14 and is not in the list of ready items

### Requirement: Reject invalid input
The command SHALL exit with a non-zero code, print a message naming the problem and its line, and write no page when the roadmap is missing or invalid.

#### Scenario: Roadmap missing
- **WHEN** `context/roadmap.md` does not exist
- **THEN** the command fails with a message naming the missing file and writes no page

#### Scenario: Malformed estimate
- **WHEN** an item carries `(~abc h)`, `(~0 h)` or `(~-3 h)`
- **THEN** the command fails naming the item ID and its line

#### Scenario: Unknown owner
- **WHEN** an item carries `(~2 h · X)`
- **THEN** the command fails naming the item ID, its line and the accepted owners

#### Scenario: Unknown dependency
- **WHEN** an item depends on an `MF-<nn>` that no item in the roadmap has
- **THEN** the command fails naming the item, its line and the unknown ID

#### Scenario: Self-dependency
- **WHEN** MF-16 carries `tras MF-16`
- **THEN** the command fails naming MF-16 and its line

#### Scenario: Dependency cycle
- **WHEN** MF-16 depends on MF-17 and MF-17 depends on MF-16
- **THEN** the command fails naming the IDs in the cycle

#### Scenario: Missing or invalid deadline
- **WHEN** the roadmap has no `**Fecha límite:**` line, or its date is not a valid `YYYY-MM-DD`
- **THEN** the command fails naming the problem

#### Scenario: Duplicate ID
- **WHEN** two items share the same `MF-<nn>`
- **THEN** the command fails naming the ID and both lines

### Requirement: Escape roadmap text
Every piece of roadmap text written into the page SHALL be HTML-escaped, so no roadmap content runs as markup or script.

#### Scenario: Markup in an item
- **WHEN** an item's text contains `<script>alert(1)</script>`
- **THEN** the page shows that text literally and contains no `<script>` element built from it
