# Roadmap

> **Qué es este documento:** el **orden de trabajo** del autor: sprints, qué entra en cada uno y cuándo se da por cerrada. **No es normativo.** Es el **backlog** del proyecto: solo contiene lo **decidido**. Lo que falta por decidir está en [decisiones.md §2](decisiones.md); al decidirse, genera aquí su ítem. Las decisiones viven en [decisiones.md](decisiones.md), el alcance en [producto.md](producto.md) y los contratos previos a OpenSpec en [`tareas/`](tareas/). Aquí solo se **ordenan** y se enlazan.
>
> Si algo de aquí contradice a [decisiones.md](decisiones.md), manda decisiones.md y este fichero se corrige.
>
> **IDs:** cada ítem tiene un ID neutro `MF-<nn>`, independiente del sprint. Es inmutable: no se renumera al reordenar, al borrar ni al cambiar de sprint, y un ítem nuevo toma el siguiente número libre. El sprint es la sección donde está el ítem: moverlo de sprint es moverlo de sección. **Subtasks:** un ítem de más de 2 h se divide en subtasks `MF-<nn>.<k>` de 2 h o menos, en líneas con sangría bajo el ítem, cada una con su **Resultado** (algo que se ve o se ejecuta al terminar). El ítem conserva su ID y la estimación total; las horas de las subtasks suman esa estimación. `pnpm roadmap` ignora las subtasks y cuenta solo el ítem.
>
> **Enlace con OpenSpec:** un ítem 📝 se empieza con `/opsx:propose`, y el nombre del cambio empieza por su ID en minúsculas (`mf-14-buscador`). Su *definition of done* son los escenarios de su spec. Si el ítem tiene subtasks, cada subtask es un cambio con su ID en minúsculas (`mf-20-1-auth-server`) y el ítem pasa a ✅ cuando están archivados todos. Al archivarse el cambio, el ítem pasa a ✅ con el enlace a su carpeta en `openspec/changes/archive/`. Así queda la cadena backlog → proposal → spec → código → tests.
>
> **Leyenda:** ✅ hecho · ⬜ pendiente · 📝 necesita spec en `tareas/` antes de escribir código (SDD).

---

## Calendario

| Bloque | Fechas | Contenido |
|---|---|---|
| Sprint 1 | semana 1 · 2026-09-24 → 10-01 | Datos, golden sets, buscador y evaluación de recuperación |
| Sprint 2 | semana 2 · 10-01 → 10-08 | Frontend y app desplegada |
| Sprint 3 | semana 3 · 10-08 → 10-15 | Evaluación del flujo LLM y observabilidad |
| Sprint 4 | semana 4 · 10-15 → 10-25 | Entregables: diapositivas, vídeo y README |

**Fecha límite:** 2026-10-25

Las fechas son orientativas, salvo la fecha límite. Lo que no se mueve es el **orden** dentro del sprint 1. El estado del plan se ve con `pnpm roadmap`, que genera `reports/roadmap.html` (MF-39).

## Regla de orden: etiquetar antes de construir

Los golden sets se etiquetan **a ciegas y antes de ver resultados** (EVAL-golden-sets). Si el buscador existe antes que ellos, el etiquetado deja de ser ciego y la comparativa pierde valor. Por eso el etiquetado es lo primero del sprint 1, no lo último del proyecto.

---

## Sprint 1 — Datos y evaluación de recuperación

**Sale del sprint:** el dataset está en la BD de producción y hay una tabla léxica vs. semántica vs. híbrida, **por tipo de consulta**, medida contra el golden set.

**Setup del repo (antes de la primera línea de `src/`)**
- ✅ **MF-01** Repo del producto creado: Next.js 16 + TypeScript + Tailwind v4 con pnpm (ARQ-nextjs, OPS-paquetes, UI-estilos), estructura de `src/` de [ADR-001](adr/ADR-001-arquitectura-interna.md) y OpenSpec con `openspec/config.yaml` (PROC-sdd)
- ⬜ **MF-02** (~0,5 h · A) Terminar la revisión de [OWASP-Top10.md](OWASP-Top10.md): l.96 (MFA para administradores) y l.110 (cambios de privilegios) ya no aplican con un solo rol (SEG-roles)
- ✅ **MF-03** Activar el workflow `verify` de OpenSpec (`openspec config profile`), con soporte para Claude Code y Antigravity
- ✅ **MF-04** Reglas de arquitectura en ESLint con `eslint-plugin-boundaries` (ARQ-hexagonal, ADR-001 §3, incluida la Scope Rule de la UI) y pre-commit con Husky + lint-staged que ejecuta lint y tests (OPS-calidad)
- ✅ **MF-05** Testing: Vitest (unit en Node, UI en jsdom con Testing Library) y Playwright para E2E, con un test de humo por nivel (OPS-calidad, PROC-tdd)
- ✅ **MF-06** CI base: `pnpm install --frozen-lockfile`, lint, tests, build y E2E, con `permissions` mínimos (OPS-ci-cd, [safety-first §2.4](safety-first.md))
- ✅ **MF-07** Completar la CI: typecheck explícito; OSV-Scanner para CVE y paquetes maliciosos; secret scanning con push protection; Dependabot con 7 días de espera (OPS-ci-cd, [safety-first §2.4 y §2.5](safety-first.md))
- ✅ **MF-37** Calidad: `eslint-plugin-sonarjs` en `src/` y cobertura con `@vitest/coverage-v8` en CI: 100 % en lógica de negocio, 80 % en lo que ve el usuario, sin umbral en infraestructura (OPS-calidad). Scripts: `test` (watch), `test:run`, `test:coverage`
- ✅ **MF-39** (~1 h · A) Panel del roadmap: `pnpm roadmap` genera una página local con el progreso por sprint, las horas pendientes por responsable, los ítems listos o bloqueados y el ritmo necesario hasta la fecha límite. Cada ítem lleva detrás del ID `(~N h · H|A|H→A · tras MF-xx)`, todo opcional [Cambio archivado](../openspec/changes/archive/2026-10-01-mf-39-roadmap-dashboard/)

**Datos**
- ✅ **MF-08** Parser del menú → `data/menu-platos.json` (ING-menu-json, ING-parser-menu, [T2 §2](tareas/T2-esquema-json-ingesta.md))
- ✅ **MF-09** Parser de recetas → `data/recetas.json` (ING-determinista, [T2 §4](tareas/T2-esquema-json-ingesta.md))
- ⬜ **MF-10** (~2,5 h · A) Parser de la lista de la compra: revisar y documentar (ING-lista-compra, ING-lista-dato-primario, [T2 §3](tareas/T2-esquema-json-ingesta.md))
- ✅ **MF-11** Parser del menú migrado a la CLI de `src/`: `pnpm ingest menu` (adelanto parcial de MF-16, ING-cli-local; [T2 §2](tareas/T2-esquema-json-ingesta.md)). `data/menu-platos.json` pasa a `WeeklyMenu[]`, y la QA ya no presenta como match un candidato descartado. Paridad plato a plato con el script anterior; los 2 platos del menú 10 sin receta eran PDF que faltaban en esa copia de `data/raw`
- ✅ **MF-38** Parser de recetas migrado a la CLI de `src/`: `pnpm ingest recipes` (adelanto parcial de MF-16, ING-cli-local; [T2 §4](tareas/T2-esquema-json-ingesta.md)). `data/recetas.json` pasa a `Recipe[]`, una por fichero con la versión del menú de número más alto (cierra T2 §4.5); las versiones descartadas salen en la QA. Paridad receta a receta con el script anterior (0 diferencias en 434). [Cambio archivado](../openspec/changes/archive/2026-09-27-mf-38-migrar-parser-recetas-cli/)

**Golden sets (antes de tocar el buscador)**
- ✅ **MF-12** Golden set de recuperación: 43 consultas en cinco tipos, con nota 0/1/2 por menú calculada a partir de etiquetas por plato revisadas por el autor; se reconstruye con `pnpm evals:golden-set` (EVAL-golden-sets, spec `retrieval-golden-set`). [Cambio archivado](../openspec/changes/archive/2026-09-28-mf-12-golden-set-recuperacion/)
- ✅ **MF-13** Golden set del descomponedor: 61 peticiones (las 54 de recuperación y 7 largas generadas a ciegas) con su estructura tipada esperada, redactada por un LLM y revisada por el autor; lo valida un test en CI (EVAL-golden-sets, spec `decomposer-golden-set`). [Cambio archivado](../openspec/changes/archive/2026-09-30-mf-13-golden-set-descomponedor/)

**Buscador**
- ✅ **MF-41** (~5 h · H→A) 📝 Índice de búsqueda en Neon: esquema por migraciones con RLS en todas las tablas (`pnpm ingest migrate`); adaptadores de Postgres para `MenuRepository` y `RecipeRepository`, de modo que `ingest recipes` e `ingest menu` guardan en el JSON y en la BD (recetas con su elaboración, para MF-23), y `pnpm ingest embed` calcula los embeddings, sin enriquecimiento (ARQ-modelo-datos, IA-proveedor, ING-cli-local) [Cambio archivado](../openspec/changes/archive/2026-10-03-mf-41-search-index/)
- ⬜ **MF-42** (~5 h · H→A · tras MF-41) 📝 Buscador sin LLM, código definitivo en el hexágono y usado desde la CLI (sustituye al spike tirable T3). `searchMenus` recibe la estructura tipada, puntúa los 36 menús con estrategia léxica, semántica o híbrida y devuelve los 5 primeros más cuántos menús elimina cada restricción dura (BUS-descomponedor); `pnpm ingest search` lo ejecuta
- ⬜ **MF-14** (~3 h · H→A · tras MF-42) 📝 Evaluación del buscador: `pnpm ingest evaluate-search` lo ejecuta con la estructura esperada de MF-13 como entrada y lo mide contra MF-12 con nDCG@5 y hit@5: léxica vs. semántica vs. híbrida, por tipo de consulta (EVAL-estrategia, BUS-superficie-consulta (d)). La tabla se sube a `evals/search/results.md`
- ⬜ **MF-40** (~7 h · H→A) 📝 Descomponedor: petición → estructura tipada con una llamada a Gemini vía Genkit, validada con Zod y sin bucle (BUS-descomponedor), usado desde la CLI. Un comando de evaluación mide su precisión/recall por restricción y por tipo contra las 61 peticiones de `evals/decomposer/golden-set.json` (EVAL-golden-sets). Fija el schema pendiente ([decisiones.md §2](decisiones.md), punto 1) y verifica la exportación de trazas Genkit a Sentry (OPS-observabilidad). Revisa las vulnerabilidades aceptadas de Genkit (`osv-scanner.toml`, proposal de MF-41)

**Evaluación de la extracción (después de MF-14)**
- ⬜ **MF-15** (~10,5 h · H→A · tras MF-14) 📝 T4: ground truth de extracción por adjudicación ciega de discrepancias parser ↔ LLM, 30 recetas + 5 menús ampliable a 10 (EVAL-ground-truth, semilla en [T4](tareas/T4-evaluacion-extraccion.md)). Incluye el experimento de comparación de ING-determinista: precisión por campo, coste y latencia del parser, del LLM con structured output y del agente con reintento. No bloquea nada del producto: alimenta el pilar 1 de la presentación

**Carga**
- ⬜ **MF-16** (~7 h · A · tras MF-14, MF-10) 📝 CLI de ingesta idempotente, con limpieza de marca y enriquecimiento (ING-cli-local, ING-parser-menu, ING-trazabilidad, SEG-datos-nutricionista, BUS-superficie-consulta (c)). Parsers del menú y de recetas terminados ([T2](tareas/T2-esquema-json-ingesta.md) patas 1 y 3); pendientes el parser de la lista (pata 2) y la trazabilidad, solo de lista y recetas. Enriquecimiento: `totalTimeMin`, tabla ingrediente → grupo y temporada por plato (ING-temporada; se salta si en MF-14 la búsqueda ya acierta en A03 y A04). Se escribe después de MF-14, con lo que este mida
- ⬜ **MF-17** (~3 h · H→A · tras MF-16) BD de producción con el modelo de ARQ-modelo-datos y el dataset cargado; en Neon, sin Data API y con RLS en todas las tablas ([safety-first §2.4](safety-first.md))

**Evaluación de recuperación**
- ⬜ **MF-19** (~1 h · H · tras MF-14) Decidir si el vector store entra o sale, a la vista de la tabla (ARQ-modelo-datos)

## Sprint 2 — Frontend y app

**Sale del sprint:** la app está desplegada en Vercel, con login, y el flujo semanal funciona de principio a fin.

- ⬜ **MF-20** (~5,5 h · H→A) 📝 Autenticación con email y contraseña, cuentas creadas por el CLI y sin registro, un solo rol, cuenta de demo para el tutor entregada en el formulario del máster. Sus tests negativos de autorización (sin sesión y contra datos de otro usuario) corren en CI y bloquean el merge ([safety-first §3](safety-first.md)) (SEG-auth con Better Auth, SEG-roles, SEG-sistema-cerrado). El test contra datos de otro usuario va en MF-43, que crea la `Selection`
  - ✅ MF-20.1 (~2 h) Better Auth en `infrastructure/` con `disableSignUp: true`, sesión en BD y migración de sus tablas. Primero verifica que se pueden crear cuentas por la API de servidor con el registro desactivado (SEG-auth). **Resultado:** un test crea una cuenta por la API de servidor e inicia sesión con ella, y el registro público se rechaza [Cambio archivado](../openspec/changes/archive/2026-10-04-mf-20-1-auth-server/)
  - ✅ MF-20.2 (~1,5 h · tras MF-20.1) Comando de la CLI para crear cuentas, incluida la de demo (SEG-sistema-cerrado). **Resultado:** el comando crea una cuenta y con ella se inicia sesión [Cambio archivado](../openspec/changes/archive/2026-10-04-mf-20-2-cli-create-account/)
  - ⬜ MF-20.3 (~2 h · tras MF-20.1) `/login`, logout y sesión comprobada en servidor para proteger rutas, con el test negativo «sin sesión». **Resultado:** en el navegador inicias sesión con una cuenta de MF-20.2 y ves una ruta protegida; sin sesión no entras
- ⬜ **MF-44** (~1 h · H→A) Tests de integración con Postgres en CI: una rama de Neon solo para CI (nunca `production`) y su URL directa como secreto de GitHub `DATABASE_URL_TEST`, pasada a `pnpm test:coverage` en `.github/workflows/ci.yml`. Hoy esos tests se saltan en CI, también los negativos de autenticación de MF-20.1, y eso incumple [safety-first §3](safety-first.md): MF-20 no pasa a ✅ sin esto (OPS-ci-cd). **Resultado:** en el log de CI de un PR, los tests de `src/infrastructure/auth/` y `src/infrastructure/postgres/` se ejecutan y no salen como *skipped*
- ⬜ **MF-45** (~1 h · A · tras MF-20.2) 📝 Comando de la CLI para cambiar la contraseña de una cuenta existente, sin cambiar su id de usuario (volver a crearla lo cambiaría y dejaría huérfanas sus sesiones y, desde MF-43, sus `Selection`). Con el registro cerrado la librería no ofrece una llamada pública de servidor para hacerlo: el primer paso es comprobar el mecanismo (`internalAdapter.updatePassword` con el hash de la librería, una superficie interna como la opción (b) de D1 en MF-20.1) y que el autor lo elija, y decidir si revoca las sesiones abiertas (SEG-auth, SEG-sistema-cerrado). **Resultado:** el comando cambia la contraseña de una cuenta, con la nueva se inicia sesión y con la antigua ya no
- ⬜ **MF-46** (~0,5 h · A · tras MF-20, MF-44) Autenticación en producción: aplicar la migración `002-auth-schema.sql` con `pnpm ingest migrate` apuntando `DATABASE_URL_UNPOOLED` a `production` (solo cuando MF-20 esté archivada entera, como dejó dicho MF-20.1), crear la cuenta del autor y la de demo con `pnpm ingest account`, y poner `BETTER_AUTH_SECRET` (32 caracteres o más) en Vercel. La contraseña de la cuenta de demo va solo en el formulario de entrega del máster (SEG-sistema-cerrado, SEG-auth). **Resultado:** en la web desplegada inicias sesión con la cuenta de demo y entras en una ruta protegida
- ⬜ **MF-43** (~3 h · A · tras MF-41, MF-20) 📝 `/planner` provisional: lista de los 36 menús con «elegir», que guarda la Selection del usuario. Sin buscador; MF-22 lo sustituye. Es la app de plan B si el buscador no llega (UI-flujo-semanal). Incluye el test negativo de autorización contra la `Selection` de otro usuario (MF-20)
- ⬜ **MF-21** (~1,5 h · A · tras MF-20) 📝 Límites de uso: el rate limit de login de Better Auth con contadores en Neon y el tope global diario del LLM, con tests de abuso (SEG-rate-limit)
- ⬜ **MF-22** (~8 h · A · tras MF-19, MF-40, MF-43) `/planner` como buscador con chips, top 5 y explicación, sobre el modelo de ARQ-modelo-datos (UI-planner-buscador, BUS-superficie-consulta (e)). Sustituye al `/planner` provisional de MF-43. Revisa las vulnerabilidades aceptadas de Genkit (`osv-scanner.toml`, proposal de MF-41)
- ⬜ **MF-23** (~3,5 h · A) `/menu` con la card de receta (UI-card-receta)
- ⬜ **MF-24** (~4,5 h · A · tras MF-10) `/shopping-list` como checklist contra la BD (ING-lista-compra, UI-flujo-semanal)
- ⬜ **MF-25** (~2,5 h · A) `/` dashboard (UI-home-sin-login)
- ⬜ **MF-26** (~2,5 h · H→A) Despliegue en Vercel con CI test → build → deploy (OPS-vercel, OPS-ci-cd), revisando [safety-first §2.4](safety-first.md)
- ⬜ **MF-27** (~5,5 h · H→A · tras MF-22, MF-23, MF-24) Tests: unit de parsers, integración, E2E del flujo semanal (OPS-calidad; qué se prueba en cada nivel, [decisiones.md §2](decisiones.md), punto 2)

## Sprint 3 — Evaluación del flujo LLM

**Sale del sprint:** están todas las cifras que necesitan las diapositivas y el vídeo.

- ⬜ **MF-29** (~4,5 h · A · tras MF-22) Faithfulness de la explicación con juez de otra familia (EVAL-estrategia, IA-proveedor)
- ⬜ **MF-30** (~4 h · A · tras MF-14, MF-40) Ablaciones: frase entera vs. descomponer y agregar; tres variantes del texto vectorizado (EVAL-golden-sets)
- ⬜ **MF-32** (~3 h · H→A · tras MF-26) Observabilidad: latencia y coste por llamada, trazas Genkit exportadas a Sentry (OPS-observabilidad; qué se mide, [decisiones.md §2](decisiones.md), punto 3). La exportación se verifica antes, en MF-40

## Sprint 4 — Entregables

- ⬜ **MF-33** (~3 h · H) Guion de la presentación y criterios de éxito ([decisiones.md §2](decisiones.md), punto 4). Semillas: [enfoque-academico.md](enfoque-academico.md) y [presentacion/](presentacion/)
- ⬜ **MF-34** (~2 h · A) El proceso SDD con agentes, contado en las diapositivas y el vídeo (PROC-sdd-memoria)
- ⬜ **MF-35** (~9 h · H · tras MF-33) Diapositivas y vídeo explicativo
- ⬜ **MF-36** (~2 h · A · tras MF-26) README expresivo: qué hace el producto, cómo instalarlo y ejecutarlo en local (incluidos los tests y la generación de datos), cómo acceder a la app desplegada con la cuenta de demo (sin publicar sus credenciales, SEG-sistema-cerrado) y qué revisar en la UI

---

## Si no da tiempo: qué se suelta primero

> **Propuesta, pendiente de validar por el autor.** Nada de esta lista está decidido.

De lo más prescindible a lo menos:

1. Ablación (b): de tres variantes del texto vectorizado a dos
2. Ground truth ampliado: se quedan 5 menús, sin ampliar a 10

La temporada ya no está en la lista: cuesta ~1–2 h y su entrada la decide MF-14 (ING-temporada).

El experimento parser vs. LLM en extracción **ya no se puede soltar por separado**: desde 2026-09-27 es el método de EVAL-ground-truth. Soltarlo es soltar también la evaluación de la extracción.

Lo que **no se recorta**: los golden sets de recuperación y la comparativa por tipo (pilares 1 y 2 de PROC-enfoque), ni autenticación, despliegue y tests, que el máster pide demostrar.
