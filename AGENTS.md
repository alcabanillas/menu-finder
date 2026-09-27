# menu-finder LLM Instructions

## Stack

NextJS: React + TypeScript + Tailwind CSS v4 
Testing: Vitest + Playwright

## TDD - MANDATORY

Red-Green-Refactor cycle, applied to ALL functions and components from here on:

1. RED: Write test FIRST → run → MUST FAIL
2. GREEN: Implement MINIMUM code to pass the test
3. REFACTOR: Improve the code while keeping tests green

Trabajo Fin de Máster en Desarrollo con IA. App web para elegir el menú semanal a partir de 36 menús en PDF de un nutricionista, con la lista de la compra como checklist. Es un **buscador en lenguaje natural sobre un catálogo estructurado** (hybrid retrieval + grounded generation), no un RAG documental.

Fase actual: **setup del repositorio**. Después del setup van, por este orden: los golden sets de búsqueda, el spike T3 y T4, la evaluación de la extracción (`context/roadmap.md`).

## Lee esto antes de cualquier tarea

1. `context/Fuente-de-Verdad.md`: visión, datos, **decisiones vigentes** y lo que está abierto. **Manda sobre cualquier otro documento.**
2. `context/safety-first.md`: reglas de seguridad obligatorias para todo el código.
3. `context/ConceptosRAG-y-agentes.md`: qué entendemos por RAG y por agente en este proyecto.

Solo si necesitas saber *por qué* algo es como es:

- `context/historial-de-decisiones.md`: qué se creía antes y qué lo tumbó. Append-only. **Nunca es normativo.**
- `context/enfoque-academico.md`: la argumentación del TFM. Semilla de la memoria.

Antes de escribir código:

- `context/adr/`: decisiones de arquitectura. **Normativas.**
- `openspec/`: specs y cambios (PROC-sdd). **Sin spec, no hay código.**
- `context/tareas/`: contratos y runbooks previos a OpenSpec. T2 es el contrato de los JSON de ingesta; T0, el runbook para generarlos en local.
- `context/OWASP-Top10.md`: guía de seguridad por categoría, complementa `safety-first.md`.

Para saber qué toca: `context/roadmap.md` (orden de trabajo, no normativo).

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

**Regla al escribir en `context/`:** una decisión se escribe en la fuente de verdad **o** en el historial, nunca en los dos. Lo derogado se borra de la fuente de verdad y se cuenta en el historial. No se tacha texto en la fuente de verdad.

## Restricciones

- Plazo: 3 semanas de desarrollo + 1 de memoria y vídeo.
- Stack: Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, pnpm, Neon (PostgreSQL + pgvector), Gemini vía Genkit, Vercel, Sentry. Detalle y lo pendiente, en la fuente de verdad.
- Un solo rol: usuario registrado. Sin registro: las cuentas las crea la CLI. Sin usuario anónimo (SEG-roles, SEG-sistema-cerrado).
- No se generan menús ni recetas. La IA extrae, estructura y recupera.

## Idioma

Documentación y comunicación en español. Código e identificadores en inglés.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
