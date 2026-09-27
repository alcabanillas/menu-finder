# menu-finder LLM Instructions

## Principios no negociables

| Principio | Regla |
|---|---|
| Sin spec, no hay código | Todo cambio pasa por OpenSpec: `propose` → `apply` → `verify` → `archive` (PROC-sdd) |
| TDD first | Red → Green → Refactor: el test de cada escenario se escribe primero y se ve fallar (PROC-tdd) |
| Arquitectura verificable | Hexagonal en el backend y Scope Rule en la UI; las reglas de dependencia las comprueba ESLint (ARQ-hexagonal, ADR-001) |
| Security by Design | Least privilege, validación en servidor y escenarios negativos en cada spec (SEG-owasp, `context/safety-first.md`) |
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

Fase actual: **setup del repositorio**. Después del setup van, por este orden: los golden sets de búsqueda, el spike T3 y T4, la evaluación de la extracción (`context/roadmap.md`).

## Carga de contexto: solo lo que vas a tocar

**Regla (no negociable):** no leas documentos de `context/` enteros por defecto. Lee `context/producto.md` (alcance, corto) y, después, **solo** lo que indica la tabla para tu tarea. En `context/decisiones.md`, localiza las secciones con `grep -n "^#" context/decisiones.md` y lee únicamente las indicadas. Si la tarea cruza varias filas, suma sus lecturas.

**Excepción:** al consolidar o revisar documentos, se leen enteros; sin eso no se detectan contradicciones.

**Precedencia:** las specs archivadas en `openspec/specs/` son la verdad de su capacidad. Para lo demás manda `context/decisiones.md`. Los ADR (`context/adr/`) son normativos. El historial nunca lo es. **Sin spec, no hay código.**

| Tarea | En `decisiones.md` (por título) | Además |
|---|---|---|
| Estructura de `src/`, dependencias, refactor | Arquitectura | `context/adr/ADR-001-arquitectura-interna.md` |
| Frontend: componentes, páginas | Frontend | ADR-001 §2 Estructura, §3 Reglas de dependencia y §5 Decisiones específicas de Next.js; pantallas en `producto.md` |
| Buscador, retrieval, scoring | Buscador · Arquitectura (modelo de datos) | `context/ConceptosRAG-y-agentes.md`; `context/datos.md` |
| Ingesta: PDFs, parsers, CLI | Ingesta | `context/datos.md`; `context/tareas/T2-esquema-json-ingesta.md`; runbook local en `context/tareas/T0-extraccion-previa.md` |
| LLM: prompts, Genkit, agentes | IA transversal | `context/ConceptosRAG-y-agentes.md`; `context/safety-first.md` §2.6 |
| Evaluación: golden sets, ground truth | Evaluación | `context/tareas/T4-evaluacion-extraccion.md` |
| Tests, CI, despliegue, observabilidad | Despliegue y calidad | — |
| Seguridad: auth, roles, validación, límites | Seguridad | `context/safety-first.md`; `context/OWASP-Top10.md` por categoría |
| Cambios con OpenSpec | Proceso | `openspec/config.yaml`, la spec afectada en `openspec/specs/` y el cambio activo en `openspec/changes/` |
| Proponer algo nuevo o decidir | Lo abierto | — |
| Qué toca ahora | — | `context/roadmap.md`: backlog, solo lo decidido |
| Por qué algo es como es | — | El proposal del cambio archivado; antes del 2026-09-27, `context/historial-de-decisiones.md` (congelado) o `context/enfoque-academico.md` |

## Estructura del código

Arquitectura hexagonal con un solo hexágono y dos adaptadores primarios, la web (`app/`) y la CLI (`cli/`) (ARQ-hexagonal). **La estructura de `src/`, las reglas de dependencia y qué merece un puerto están solo en [ADR-001](context/adr/ADR-001-arquitectura-interna.md).** Léelo antes de crear o mover ficheros en `src/`. Las reglas las verifica ESLint en pre-commit y CI: si una importación rompe una regla, el fallo está en el diseño, no en la regla.

## Datos

- Los PDF y los JSON generados viven en `data/`, que **nunca se sube** (SEG-datos-nutricionista). Se generan en local con el runbook T0 (`pnpm datos:*`).
- Nada del nutricionista (marca, email, eslogan) llega al repo, a la BD ni a Sentry. Tampoco al código: los patrones para filtrarlo se leen de `data/marca.json`.
- Los tests usan fixtures con nombres ficticios generados por script, nunca datos reales.

## Método: SDD con OpenSpec

Cada cambio sigue `explore` (opcional) → `propose` → `apply` → `verify` → `archive` (PROC-sdd). Lo obligatorio lo impone CI, no `verify`.

- **La seguridad entra por la spec:** el proposal identifica los datos tocados, los posibles abusos y las categorías OWASP que aplican. Cada endpoint o comando trae sus escenarios negativos de autorización y validación. Antes del `archive` se repasa la checklist de `safety-first.md` §4.
- La memoria documenta este flujo **como proceso**: qué se delega a los agentes y qué se revisa (PROC-sdd-memoria).

## Cómo trabajar conmigo (el autor)

- **No me des la razón por defecto.** Si me equivoco, dímelo y explica por qué. Explora alternativas aunque yo ya tenga una preferencia.
- **Avísame si algo es demasiado complejo** para el plazo, y también **si es demasiado simple** para tener valor en un máster de IA.
- En decisiones abiertas de alcance o arquitectura: plantea preguntas y hazme razonar antes de proponer; después, da una valoración técnica clara. En tareas de ejecución (editar, revisar, implementar algo ya decidido): hazlo directamente.
- Al consolidar o revisar documentos, **expón las contradicciones entre fuentes**; no las resuelvas por tu cuenta.
- Lo que se decida en una conversación se escribe en el documento que corresponda. No se queda en el chat.

**Regla al escribir en `context/`:** la decisión vigente va en `decisiones.md`, y su porqué, en el proposal del cambio de OpenSpec. Cuando una capacidad tiene spec archivada, sus decisiones salen de `decisiones.md`. Lo derogado se borra, sin tachar. Lo que falta por hacer va a `roadmap.md`, y solo si está decidido. El historial está congelado: no se escribe en él.

## Restricciones

- Plazo: 3 semanas de desarrollo + 1 de memoria y vídeo.
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
