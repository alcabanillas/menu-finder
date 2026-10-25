# menu-finder LLM Instructions

## Principios no negociables

| Principio | Regla |
|---|---|
| Sin spec, no hay código | Todo cambio pasa por OpenSpec: `propose` → `apply` → `verify` → `archive` (PROC-sdd) |
| TDD first | Red → Green → Refactor: el test de cada escenario se escribe primero y se ve fallar (PROC-tdd) |
| Arquitectura verificable | Hexagonal en el backend y Scope Rule en la UI; las reglas de dependencia las comprueba ESLint (ARQ-hexagonal, ADR-001) |
| Security by Design | Least privilege, validación en servidor y escenarios negativos en cada spec (SEG-owasp, `context/seguridad/safety-first.md`) |
| Datos del nutricionista fuera | Los PDF solo viven en `data/`, que nunca se sube. Su marca, email y eslogan no llegan al repo, a la BD ni a Sentry (SEG-datos-nutricionista) |
| La IA no inventa | Extrae, estructura y recupera; no genera menús ni recetas (`context/producto.md` §1) |

## Stack

NextJS: React + TypeScript + Tailwind CSS v4 
Testing: Vitest + Playwright

## TDD - MANDATORY

Red-Green-Refactor cycle, applied to ALL functions and components from here on:

1. RED: Write test FIRST → run → MUST FAIL
2. GREEN: Implement MINIMUM code to pass the test
3. REFACTOR: Improve the code while keeping tests green


## Roadmap

Fase actual: **setup del repositorio**. Después del setup van, por este orden: los golden sets de búsqueda y el spike T3 (`context/roadmap.md`).

## Project context
This TFM is a part-time personal project. Estimate work in hours, not full-time sprint weeks. Check the actual PR and commit history before judging the timeline. The user decides the current priority task. When asked for the next task, give one plain recommendation instead of arguing against the user's stated priority.

## Carga de contexto: solo lo que vas a tocar

**Regla (no negociable):** no leas documentos de `context/` enteros por defecto. Lee `context/producto.md` (alcance, corto) y, después, **solo** lo que indica la tabla para tu tarea. En `context/decisiones.md`, localiza las secciones con `grep -n "^#" context/decisiones.md` y lee únicamente las indicadas. Si la tarea cruza varias filas, suma sus lecturas.

**Excepción:** al consolidar o revisar documentos, se leen enteros; sin eso no se detectan contradicciones.

**Precedencia:** las specs archivadas en `openspec/specs/` son la verdad de su capacidad. Para lo demás manda `context/decisiones.md`. Los ADR (`context/adr/`) son normativos. El historial nunca lo es. **Sin spec, no hay código.**

| Tarea | En `decisiones.md` (por título) | Además |
|---|---|---|
| Estructura de `src/`, dependencias, refactor | Arquitectura | `context/adr/ADR-001-arquitectura-interna.md` |
| Frontend: componentes, páginas | Frontend | ADR-001 §2 Estructura, §3 Reglas de dependencia y §5 Decisiones específicas de Next.js; pantallas en `producto.md` |
| Buscador, retrieval, scoring | Buscador · Arquitectura (modelo de datos) | `context/presentacion/ConceptosRAG-y-agentes.md`; `context/datos/datos.md` |
| Ingesta: PDFs, parsers, CLI | Ingesta | `context/datos/datos.md`; `context/datos/T2-esquema-json-ingesta.md`; runbook local en `context/runbooks/T0-extraccion-previa.md` |
| LLM: prompts, Genkit, agentes | IA transversal | `context/presentacion/ConceptosRAG-y-agentes.md`; `context/seguridad/safety-first.md` §2.6 |
| Evaluación: golden sets | Evaluación | Los resultados en `evals/` |
| Tests, CI, despliegue, observabilidad | Despliegue y calidad | Para publicar o tocar el despliegue, `context/runbooks/despliegue.md` |
| Seguridad: auth, roles, validación, límites | Seguridad | `context/seguridad/safety-first.md`; `context/seguridad/OWASP-Top10.md` por categoría |
| Cambios con OpenSpec | Proceso | `openspec/config.yaml`, la spec afectada en `openspec/specs/` y el cambio activo en `openspec/changes/` |
| Proponer algo nuevo o decidir | Lo abierto | — |
| Qué toca ahora | — | `context/roadmap.md`: backlog, solo lo decidido |
| Por qué algo es como es | — | El proposal del cambio archivado; antes del 2026-09-27, `context/archivo/historial-de-decisiones.md` (congelado) |

## Decisions and documentation style
- Never record a technology or design decision (Dxx, ADR) until the user has explicitly chosen it. Present the options and ask first.
- Always use fully qualified cross-references, such as 'context/decisiones.md §4'. Never write a bare '§4' or 'ese documento'.
- Keep doc entries concise, but not so compressed that they stop reading as clear prose.
- Before editing, check that task and decision codes (T1, MF-13, D38) actually match what they refer to.


## Estructura del código

Arquitectura hexagonal con un solo hexágono y dos adaptadores primarios, la web (`app/`) y la CLI (`cli/`) (ARQ-hexagonal). **La estructura de `src/`, las reglas de dependencia y qué merece un puerto están solo en [ADR-001](context/adr/ADR-001-arquitectura-interna.md).** Léelo antes de crear o mover ficheros en `src/`. Las reglas las verifica ESLint (`pnpm lint`) en el pre-push y en CI, no en cada commit: si una importación rompe una regla, el fallo está en el diseño, no en la regla.

### Rule: reuse a port before creating one (mandatory)

Before designing a new port, read every file in `src/application/ports/` and the archived proposals that created them (`openspec/changes/archive/`). Reuse an existing port with a new adapter whenever one fits. Create a new port only for an external boundary no existing port covers, and say in `design.md` why none of the existing ones fits. A design that adds a port beside an existing one for the same data is a deviation: list it under "Deviations" and tell the author before `apply`.

| | Example | Why |
|---|---|---|
| ❌ | `SearchIndexWriter.replace(content)` to store menus and recipes | `MenuRepository.saveAll` and `RecipeRepository.saveAll` already existed for that data, created in MF-11 and MF-38 for the database adapter |
| ❌ | `DatasetSource.readMenus()` to read the menus again | A second way to reach data a repository already handles |
| ✅ | `PostgresMenuRepository implements MenuRepository` | Same port, new adapter: `ingestMenus` does not change |
| ✅ | `RecipeEmbeddingRepository`, new | No existing port stored vectors; `design.md` says so |
| ✅ | `EmbeddingsPort`, `MigrationRunner`, new | New external boundaries: the Gemini API and the SQL migrations |

### Rule: name by domain concept (mandatory)

Folders in `domain/` and `application/`, ports, use cases and CLI commands are named after what they are or do in the domain (menu, recipe, dish, search, embedding). Never after the OpenSpec change or capability that created them, and never after a technology: Postgres, JSON, Genkit and the like appear only in `infrastructure/` names. A CLI command file has the name of its command.

| | Example | Why |
|---|---|---|
| ❌ | `domain/search-index/` | `search-index` is the name of an OpenSpec capability, not a domain concept |
| ❌ | `use-cases/load-search-index.ts` | Says neither what is loaded nor where |
| ❌ | `cli/commands/search-index.ts` holding `migrate` and `load` | The file is not named after its commands |
| ❌ | `use-cases/load-json-to-pg.ts` | A technology in the core |
| ✅ | `domain/menu/dish-recipe.ts` | Dishes and recipes are domain concepts |
| ✅ | `domain/search/embedding-text.ts` | A rule of the search |
| ✅ | `use-cases/ingest/embed-recipes.ts`, `cli/commands/embed.ts` | Says what it does; the command and its file share the name |
| ✅ | `infrastructure/postgres/postgres-menu-repository.ts` | The technology appears only in infrastructure |

### Rule: short functions, most important first (mandatory)

Keep functions short: each does one thing that its name says. When a function grows steps, extract each step into a function named after what it does. Order a file top-down: imports, types and constants, then the exported function, then its helpers in the order they are called. A reader learns what the file does in the first function and reads down only for the detail. Helpers are `function` declarations, so they can sit below their caller.

| | Example | Why |
|---|---|---|
| ❌ | `toQaRow`, `emptyTotals`, `addCounts` and then `ingestMenus` at the bottom | The reader meets the detail before knowing what it is for |
| ❌ | A use case with a 30-line loop that reads, builds and counts inline | The steps have no names |
| ❌ | `const visit = (node) => { … }` defined inside a loop or a function body, called at its end | A hidden helper: the reader parses it before knowing why. Make it a named `function` below its caller |
| ❌ | A script whose main loop sits at the bottom of the file | Scripts follow the same order: `main()` first, then its steps |
| ✅ | `ingestMenus` first, then `readMenus`, `toQaRow`, `matchEvidence`, `addCounts` | Main flow first, each step named, in call order |

## Datos

- Los PDF y los JSON generados viven en `data/`, que **nunca se sube** (SEG-datos-nutricionista). Se generan en local con el runbook T0 (`pnpm datos:*`).
- Nada del nutricionista (marca, email, eslogan) llega al repo, a la BD ni a Sentry. Tampoco al código: los patrones para filtrarlo se leen de `data/marca.json`.
- Los tests usan fixtures con nombres ficticios generados por script, nunca datos reales.

## Método: SDD con OpenSpec

Cada cambio sigue `explore` (opcional) → `propose` → `apply` → `verify` → `archive` (PROC-sdd). Lo obligatorio lo impone CI, no `verify`.

- **Refactor pequeño, sin cambio propio:** un refactor que no cambia el comportamiento (ningún requisito, escenario ni test de comportamiento nuevo) entra en el cambio abierto, con una tarea en su `tasks.md`. No se abre un cambio de OpenSpec para él (PROC-sdd).
- **Cambio solo de documentación, sin OpenSpec:** un cambio que solo toca documentación (el README o `context/`), sin código, tests ni configuración, no necesita cambio de OpenSpec (PROC-sdd).

- **El lint completo corre en el pre-push (obligatorio):** `pnpm lint` (ESLint con `boundaries` e `import/no-cycle`, más `knip`) tarda minutos, y `import/no-cycle` consume el 98 % del tiempo de ESLint (medido el 2026-10-14: lintar los 5 ficheros de `src/composition` tardó unos 190 s). La regla se queda, porque la exige `context/adr/ADR-001-arquitectura-interna.md` (sección 3, "Reglas de dependencia"). Por eso: (1) durante `apply` y los refactores no se corre `pnpm lint`; si hace falta lintar algo, solo los ficheros tocados y sin esa regla: `pnpm exec eslint <ficheros> --rule "import/no-cycle: off"`; (2) `pnpm typecheck` y `pnpm test:run` se corren por separado y solo sobre lo afectado, sin encadenarlos con el lint; (3) el pre-commit (`.husky/pre-commit`) ya no ejecuta ESLint ni la suite entera: corre `pnpm knip` y `vitest related` sobre los `.ts` y `.tsx` preparados, y la suite entera (`pnpm test:run`) corre en `.husky/pre-push`; (4) `pnpm test:run` y `pnpm lint` completos corren en `.husky/pre-push`, antes de cada push, y en la CI (`.github/workflows/ci.yml`); ni `verify` ni el paso previo a `gh pr create` lo repiten (decidido por el autor el 2026-10-14).
- **Tamaño antes de `propose` (obligatorio):** cuando el autor elige un ítem de `context/roadmap.md`, antes de `/opsx:propose` se reevalúa su estimación. Si pasa de 2 h, se propone al autor dividirlo (el umbral es una recomendación: decide el autor) y, si acepta, se divide en subtasks `MF-nn.k` de 2 h o menos, con sangría bajo el ítem en `context/roadmap.md`. Cada subtask lleva un **Resultado** (algo que se ve o se ejecuta al terminar), se hace, se prueba y se archiva por separado, y es un cambio de OpenSpec propio (`mf-20-1-…`). El ítem conserva su ID y la estimación total. Se divide solo el ítem elegido, no los lejanos. Un ítem con cambio activo en `openspec/changes/` no se divide en el roadmap: su descomposición es su `tasks.md`.
- **La seguridad entra por la spec:** el proposal identifica los datos tocados, los posibles abusos y las categorías OWASP que aplican. Cada endpoint o comando trae sus escenarios negativos de autorización y validación. Antes del `archive` se repasa la checklist de `safety-first.md` §4.
- **Cobertura antes de abrir la PR (obligatorio):** antes de `gh pr create`, el agente corre `pnpm test:coverage`, que aplica los mismos umbrales que la CI. El pre-commit no mide cobertura, para que los commits parciales sigan siendo rápidos, y la falta de cobertura solo salía en la CI (MF-40, decidido por el autor el 2026-10-12). Si el autor ha pedido preguntar antes de correr tests, se le pregunta igual. Una PR que solo toca documentación no corre la cobertura (decidido por el autor el 2026-10-24, en MF-36).
- **Versión antes de abrir la PR (obligatorio):** antes de `gh pr create`, el agente pregunta al autor si la PR sube `"version"` en `package.json`, y a cuál. Si la sube, el cambio va en esa misma PR. Así, después del merge solo queda `pnpm release`, sin una PR aparte solo para la versión (decidido por el autor el 2026-10-12, tras la PR de MF-40).
- La presentación y el vídeo cuentan este flujo **como proceso**: qué se delega a los agentes y qué se revisa (PROC-sdd-memoria).

## Cómo trabajar conmigo (el autor)

- **No me des la razón por defecto.** Si me equivoco, dímelo y explica por qué. Explora alternativas aunque yo ya tenga una preferencia.
- **Avísame si algo es demasiado complejo** para el plazo, y también **si es demasiado simple** para tener valor en un máster de IA.
- En decisiones abiertas de alcance o arquitectura: plantea preguntas y hazme razonar antes de proponer; después, da una valoración técnica clara. En tareas de ejecución (editar, revisar, implementar algo ya decidido): hazlo directamente.
- Al consolidar o revisar documentos, **expón las contradicciones entre fuentes**; no las resuelvas por tu cuenta.
- Lo que se decida en una conversación se escribe en el documento que corresponda. No se queda en el chat.

**Regla al escribir en `context/`:** la decisión vigente va en `decisiones.md`, y su porqué, en el proposal del cambio de OpenSpec. Cuando una capacidad tiene spec archivada, sus decisiones salen de `decisiones.md`. Lo derogado se borra, sin tachar. Lo que falta por hacer va a `roadmap.md`, y solo si está decidido. El historial está congelado: no se escribe en él.

## Restricciones

- Plazo: 3 semanas de desarrollo + 1 para los entregables: diapositivas, vídeo y README (sin memoria escrita).
- Stack: Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, pnpm, Neon (PostgreSQL + pgvector), Gemini vía Genkit, Vercel, Sentry. Detalle en `context/decisiones.md`; lo pendiente, en `context/roadmap.md`.
- Un solo rol: usuario registrado. Sin registro: las cuentas las crea la CLI. Sin usuario anónimo (SEG-roles, SEG-sistema-cerrado).
- No se generan menús ni recetas. La IA extrae, estructura y recupera.

## Idioma

Documentación y comunicación en español. Artefactos en inglés: los de OpenSpec (proposal, specs, design, tasks), código, identificadores, skills y configuración de agentes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
