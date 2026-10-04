## Context

See proposal.md for the motivation. Current state, checked in the repo and on the 36 PDFs:

- `DocumentSource` (`src/application/ports/document-source.ts`) already reads menus and recipes from `data/raw/Dieta`; `LocalDocumentSource` implements it with `pdf-parse` (menu table) and `pdfjs-dist` (recipes, text with coordinates). Recipes are parsed by the pure `parseRecipePage` over `PositionedText[]`, with the footer cut by `y` (`FOOTER_MAX_Y`).
- `readPositionedText` (private in `local-document-source.ts`) reads at most N pages; the list needs all of them.
- The list PDF has two fixed columns (`pdf-parse` flattens them into one flow, but the coordinates keep them apart); page 2, when it exists, continues each column of page 1 (a category can be split across the page break) and ends with the footer. Free-text categories (`Especias`, `Grasas y aceites`) wrap across lines with names separated by ` , `.
- Ports in `src/application/ports/`: `MenuRepository`, `RecipeRepository`, `RecipeEmbeddingRepository`, `DishTextSearch`, `MigrationRunner`, `AccountCreator`, `EmbeddingsPort`, `GoldenSetSource`, `DocumentSource`. None stores shopping items.
- Migrations live in `postgres/migrations/` (`001` search schema, `002` auth, `003` dish text search), every table with row-level security and no policy.
- CLI: `run-cli.ts` dispatches `migrate | recipes | menu | embed | account | search | evaluate-search`; `ingest recipes` is the model for a command (summary, QA file under `data/qa`, `isInside` check, `MissingVariables`).

## Goals / Non-Goals

**Goals:**
- A tested parser of the list PDF, over every page, outside the old script.
- The list in the database as relational rows keyed by menu, idempotent, with the pages-per-list figure in the report.
- The same shape as `ingest recipes`, so a reader who knows one knows the other.

**Non-Goals:**
- Normalizing names or assigning food groups (MF-16), the per-user checked state and the checklist (MF-24), the recipes ⊆ list cross-check, a JSON dataset, an LLM.
- Reading lists from anything but the local `data/raw` folder.

## Decisions

**D1. Reading goes through the existing `DocumentSource`, with a new method `readShoppingList(folder)`.** The rule "reuse a port before creating one" applies: the port already is the boundary to the nutritionist's documents. The method returns `SourceShoppingList = { pages, items, anomalies }`; `pages` is the number of PDF pages read. *Alternative:* a separate `ShoppingListSource` port: rejected, it would sit beside `DocumentSource` for the same files.

**D2. A new port `ShoppingListRepository` (`saveAll(lists)`).** No existing port covers this data: `MenuRepository.saveAll` stores `WeeklyMenu`s and `RecipeRepository.saveAll` stores `Recipe`s, and the list belongs to neither (ING-lista-dato-primario: it is not derived from the dishes). *Alternative:* add the items to `MenuRepository`: rejected, it mixes two aggregates and would make `ingestMenus` write data it does not read.

**D3. Foreign key to `menu`.** `shopping_item.menu_number` references `menu(number)` with `ON DELETE CASCADE`, like `meal`. A list for a menu not in the database fails the save with a message naming the menu and pointing to `ingest menu`. The CLI order becomes `migrate → recipes → menu → shopping-list → embed`. *Alternative:* no FK, so the command works alone: rejected, orphan items would be possible and `MenuRepository` is the owner of which menus exist.

**D4. Free-text categories as items without quantity or unit** (confirmed by the author). Names are the text split on ` , ` after joining the wrapped lines, so `Laurel, hoja` stays whole. `ShoppingItem.quantity` and `unit` are nullable, the same as `RecipeIngredient`. *Alternatives:* a second structure `freeform: Record<category, string>` as the old script had (two shapes for the checklist to handle) or dropping the two categories (the list is primary data, ING-lista-dato-primario, and spices are what the author buys).

**D5. The footer is cut by position.** The parser discards text below a `y` threshold, like `recipe-page.ts`, so the slogan and the generator line never need to be written in code or in `data/marca.json` (SEG-datos-nutricionista). The threshold is measured on the real PDFs in the first implementation task and fixed in a constant with a comment, as `FOOTER_MAX_Y`. The title `Lista de la compra` is a fixed public string and is dropped by text.

**D6. Parsing is a pure function over lines.** `shopping-list-page.ts` takes the positioned text of all pages, splits each page in two columns by `x`, groups items into lines top to bottom (same-line tolerance as in recipes), chains the left column of every page and then the right column of every page, and runs a small state machine: category header → mode `items` or `free-text`; in `items`, an item line, a standalone `(opcional)`, or the continuation of a wrapped name. Helpers go below the exported function, in call order (AGENTS.md). Grouping into lines reuses `readingOrder` from `recipe-page.ts` if it fits; if it needs changing, it moves to a shared file in `local-documents/pdf/` rather than being copied.

**D7. One shared positioned-text reader.** `readPositionedText` leaves `local-document-source.ts` for its own file in `local-documents/pdf/` and takes `maxPages` as an option (recipes: 2, list: all). The recipe behavior does not change; its tests stay green.

**D8. Names by domain concept.** Domain folder `shopping/`, port `shopping-list-repository.ts`, use case `ingest-shopping-lists.ts`, table `shopping_item`, CLI command `shopping-list` with the file `ingest-shopping-list.ts` as its siblings (`ingest-recipes.ts`). Postgres appears only in `infrastructure/postgres/`.

**D9. Saving.** `PostgresShoppingListRepository.saveAll` runs, in one transaction, `DELETE FROM shopping_item WHERE menu_number = ANY($1)` and an `INSERT … SELECT FROM jsonb_to_recordset($2)`, the pattern of `PostgresRecipeRepository`. Values travel as one JSON parameter, never concatenated into SQL. Primary key `(menu_number, position)`. A foreign key violation is translated by `describeDatabaseError` into the missing-menu message.

**D10. Use case.** `ingestShoppingLists({ source, shoppingLists })` lists the menu folders, reads each list in numeric order, records failures and anomalies per menu, saves the lists read, and returns the summary (per menu: pages, items; totals; failures; anomalies). `no-list-parsed` when none could be read, as `ingestRecipes` does for recipes.

## Risks / Trade-offs

- **A layout the parser misreads on one of the 36 PDFs** → the anomalies list is the check: the acceptance run over the real PDFs must give 0 anomalies, and the item count per menu is compared with the old script's output (`data/qa`, if still generated) before the script is deleted.
- **Footer threshold wrong on some PDF** → measured over all 36, and the spec scenario guards it with a synthetic footer; a footer line leaking would show as an anomaly.
- **`pdfjs-dist` text item order differs between pages or between PDFs** → ordering is by page and then `y`, never by the order PDF.js returns; tested with scrambled input.
- **Wrapped free-text lines split a name wrongly** (a line break right before a comma) → the join happens before the split; covered by the wrapped-list scenario and the 36-PDF run.
- **The migration needs the menu rows** → documented in the usage text and in the error; the order of the commands is in `USAGE`.
- **Deviation:** the change exceeds 2 h; it is delivered in four phases of `tasks.md`, each with its own commit, so it can stop after any of them with green tests.

## Migration Plan

1. Apply `004-shopping-list.sql` with `pnpm ingest migrate` (a new table; nothing existing changes).
2. Run `pnpm ingest shopping-list` against the development database first, then the production one (MF-17 owns production); rerunning is safe.
3. Rollback: `DROP TABLE shopping_item` in a new migration; nothing else depends on it until MF-24.
