# Roadmap

> **Qué es este documento:** el **orden de trabajo** del autor: sprints, qué entra en cada uno y cuándo se da por cerrada. **No es normativo.** Es el **backlog** del proyecto: solo contiene lo **decidido**. Lo que falta por decidir está en [decisiones.md §2](decisiones.md); al decidirse, genera aquí su ítem. Las decisiones viven en [decisiones.md](decisiones.md), el alcance en [producto.md](producto.md) y los contratos previos a OpenSpec en [`tareas/`](tareas/). Aquí solo se **ordenan** y se enlazan.
>
> Si algo de aquí contradice a [decisiones.md](decisiones.md), manda decisiones.md y este fichero se corrige.
>
> **IDs:** cada ítem tiene un ID neutro `MF-<nn>`, independiente del sprint. Es inmutable: no se renumera al reordenar, al borrar ni al cambiar de sprint, y un ítem nuevo toma el siguiente número libre. El sprint es la sección donde está el ítem: moverlo de sprint es moverlo de sección.
>
> **Enlace con OpenSpec:** un ítem 📝 se empieza con `/opsx:propose`, y el nombre del cambio empieza por su ID en minúsculas (`mf-14-spike-buscador`). Su *definition of done* son los escenarios de su spec. Al archivarse el cambio, el ítem pasa a ✅ con el enlace a su carpeta en `openspec/changes/archive/`. Así queda la cadena backlog → proposal → spec → código → tests.
>
> **Leyenda:** ✅ hecho · ⬜ pendiente · 📝 necesita spec en `tareas/` antes de escribir código (SDD).

---

## Calendario

| Bloque | Fechas | Contenido |
|---|---|---|
| Sprint 1 | semana 1 · 2026-09-24 → 10-01 | Datos, golden sets, buscador y evaluación de recuperación |
| Sprint 2 | semana 2 · 10-01 → 10-08 | Frontend y app desplegada |
| Sprint 3 | semana 3 · 10-08 → 10-15 | Evaluación del flujo LLM y observabilidad |
| Sprint 4 | semana 4 · 10-15 → 10-22 | Memoria, presentación y vídeo de defensa |

Las fechas son orientativas. Lo que no se mueve es el **orden** dentro del sprint 1.

## Regla de orden: etiquetar antes de construir

Los golden sets se etiquetan **a ciegas y antes de ver resultados** (EVAL-golden-sets). Si el buscador existe antes que ellos, el etiquetado deja de ser ciego y la comparativa pierde valor ante el tribunal. Por eso el etiquetado es lo primero del sprint 1, no lo último del proyecto.

---

## Sprint 1 — Datos y evaluación de recuperación

**Sale del sprint:** el dataset está en la BD de producción y hay una tabla léxica vs. semántica vs. híbrida, **por tipo de consulta**, medida contra el golden set.

**Setup del repo (antes de la primera línea de `src/`)**
- ✅ **MF-01** Repo del producto creado: Next.js 16 + TypeScript + Tailwind v4 con pnpm (ARQ-nextjs, OPS-paquetes, UI-estilos), estructura de `src/` de [ADR-001](adr/ADR-001-arquitectura-interna.md) y OpenSpec con `openspec/config.yaml` (PROC-sdd)
- ⬜ **MF-02** Terminar la revisión de [OWASP-Top10.md](OWASP-Top10.md): l.96 (MFA para administradores) y l.110 (cambios de privilegios) ya no aplican con un solo rol (SEG-roles)
- ✅ **MF-03** Activar el workflow `verify` de OpenSpec (`openspec config profile`), con soporte para Claude Code y Antigravity
- ✅ **MF-04** Reglas de arquitectura en ESLint con `eslint-plugin-boundaries` (ARQ-hexagonal, ADR-001 §3, incluida la Scope Rule de la UI) y pre-commit con Husky + lint-staged que ejecuta lint y tests (OPS-calidad)
- ✅ **MF-05** Testing: Vitest (unit en Node, UI en jsdom con Testing Library) y Playwright para E2E, con un test de humo por nivel (OPS-calidad, PROC-tdd)
- ✅ **MF-06** CI base: `pnpm install --frozen-lockfile`, lint, tests, build y E2E, con `permissions` mínimos (OPS-ci-cd, [safety-first §2.4](safety-first.md))
- ✅ **MF-07** Completar la CI: typecheck explícito; OSV-Scanner para CVE y paquetes maliciosos; secret scanning con push protection; Dependabot con 7 días de espera (OPS-ci-cd, [safety-first §2.4 y §2.5](safety-first.md))
- ✅ **MF-37** Calidad: `eslint-plugin-sonarjs` en `src/` y cobertura con `@vitest/coverage-v8` en CI: 100 % en lógica de negocio, 80 % en lo que ve el usuario, sin umbral en infraestructura (OPS-calidad). Scripts: `test` (watch), `test:run`, `test:coverage`

**Datos**
- ✅ **MF-08** Parser del menú → `data/menu-platos.json` (ING-menu-json, ING-parser-menu, [T2 §2](tareas/T2-esquema-json-ingesta.md))
- ✅ **MF-09** Parser de recetas → `data/recetas.json` (ING-determinista, [T2 §4](tareas/T2-esquema-json-ingesta.md))
- ⬜ **MF-10** Parser de la lista de la compra: revisar y documentar (ING-lista-compra, ING-lista-dato-primario, [T2 §3](tareas/T2-esquema-json-ingesta.md))
- ✅ **MF-11** Parser del menú migrado a la CLI de `src/`: `pnpm ingest menu` (adelanto parcial de MF-16, ING-cli-local; [T2 §2](tareas/T2-esquema-json-ingesta.md)). `data/menu-platos.json` pasa a `WeeklyMenu[]`, y la QA ya no presenta como match un candidato descartado. Paridad plato a plato con el script anterior; los 2 platos del menú 10 sin receta eran PDF que faltaban en esa copia de `data/raw`
- ✅ **MF-38** Parser de recetas migrado a la CLI de `src/`: `pnpm ingest recipes` (adelanto parcial de MF-16, ING-cli-local; [T2 §4](tareas/T2-esquema-json-ingesta.md)). `data/recetas.json` pasa a `Recipe[]`, una por fichero con la versión del menú de número más alto (cierra T2 §4.5); las versiones descartadas salen en la QA. Paridad receta a receta con el script anterior (0 diferencias en 434). [Cambio archivado](../openspec/changes/archive/2026-09-27-mf-38-migrar-parser-recetas-cli/)

**Golden sets (antes de tocar el buscador)**
- ✅ **MF-12** Golden set de recuperación: 43 consultas en cinco tipos, con nota 0/1/2 por menú calculada a partir de etiquetas por plato revisadas por el autor; se reconstruye con `pnpm evals:golden-set` (EVAL-golden-sets, spec `retrieval-golden-set`). [Cambio archivado](../openspec/changes/archive/2026-09-28-mf-12-golden-set-recuperacion/)
- ⬜ **MF-13** Etiquetar 50 peticiones → estructura tipada esperada, para el descomponedor (EVAL-golden-sets)

**Buscador**
- ⬜ **MF-14** 📝 Spike T3: descomponer + ranquear los 36 en consola. Código tirable, fuera de la app: un script local lee `data/menu-platos.json` (formato `WeeklyMenu[]`, T2 §2) y `data/recetas.json` (formato `Recipe[]`, T2 §4), descompone con el LLM contra el schema Zod y ranquea en consola; sin BD, sin Next, sin Genkit. Su spec, breve, en `context/tareas/T3-spike-buscador.md` antes de escribirlo. Fija el schema del descomponedor ([decisiones.md §2](decisiones.md), punto 1)

**Evaluación de la extracción (después de T3)**
- ⬜ **MF-15** 📝 T4: ground truth de extracción por adjudicación ciega de discrepancias parser ↔ LLM, 30 recetas + 5 menús ampliable a 10 (EVAL-ground-truth, semilla en [T4](tareas/T4-evaluacion-extraccion.md)). No bloquea nada del producto: alimenta el pilar 1 de la memoria y el experimento de ING-determinista

**Carga**
- ⬜ **MF-16** 📝 CLI de ingesta idempotente, con limpieza de marca y enriquecimiento (ING-cli-local, ING-parser-menu, ING-trazabilidad, SEG-datos-nutricionista, BUS-superficie-consulta (c)). Parsers del menú y de recetas terminados ([T2](tareas/T2-esquema-json-ingesta.md) patas 1 y 3); pendientes el parser de la lista (pata 2) y la trazabilidad, solo de lista y recetas. Enriquecimiento: `totalTimeMin`, tabla ingrediente → grupo, temporada. Se escribe después del spike T3, con lo que este mida
- ⬜ **MF-17** BD de producción con el modelo de ARQ-modelo-datos y el dataset cargado; en Neon, sin Data API y con RLS en todas las tablas ([safety-first §2.4](safety-first.md))

**Evaluación de recuperación**
- ⬜ **MF-18** Léxica vs. semántica vs. híbrida, por tipo de consulta (EVAL-estrategia, BUS-superficie-consulta (d))
- ⬜ **MF-19** Decidir si el vector store entra o sale, a la vista de la tabla (ARQ-modelo-datos)

## Sprint 2 — Frontend y app

**Sale del sprint:** la app está desplegada en Vercel, con login, y el flujo semanal funciona de principio a fin.

- ⬜ **MF-20** 📝 Autenticación con email y contraseña, cuentas creadas por el CLI y sin registro, un solo rol, cuenta de demo para el tutor entregada en el formulario del máster. Sus tests negativos de autorización (sin sesión y contra datos de otro usuario) corren en CI y bloquean el merge ([safety-first §3](safety-first.md)) (SEG-roles, SEG-sistema-cerrado; librería pendiente, [decisiones.md §2](decisiones.md), punto 2)
- ⬜ **MF-21** 📝 Límites de uso: login, buscador y tope global diario del LLM, con tests de abuso (SEG-rate-limit)
- ⬜ **MF-22** `/planner` como buscador con chips y explicación, sobre el modelo de ARQ-modelo-datos (UI-planner-buscador, BUS-superficie-consulta (e))
- ⬜ **MF-23** `/menu` con la card de receta (UI-card-receta)
- ⬜ **MF-24** `/shopping-list` como checklist contra la BD (ING-lista-compra, UI-flujo-semanal)
- ⬜ **MF-25** `/` dashboard (UI-home-sin-login)
- ⬜ **MF-26** Despliegue en Vercel con CI test → build → deploy (OPS-vercel, OPS-ci-cd), revisando [safety-first §2.4](safety-first.md)
- ⬜ **MF-27** Tests: unit de parsers, integración, E2E del flujo semanal (OPS-calidad; qué se prueba en cada nivel, [decisiones.md §2](decisiones.md), punto 3)

## Sprint 3 — Evaluación del flujo LLM

**Sale del sprint:** están todas las cifras que necesita la memoria.

- ⬜ **MF-28** Precisión/recall del descomponedor contra las 50 peticiones (EVAL-golden-sets)
- ⬜ **MF-29** Faithfulness de la explicación con juez de otra familia (EVAL-estrategia, IA-proveedor)
- ⬜ **MF-30** Ablaciones: frase entera vs. descomponer y agregar; tres variantes del texto vectorizado (EVAL-golden-sets)
- ⬜ **MF-31** Experimento de comparación: parser vs. LLM en extracción de recetas (ING-determinista)
- ⬜ **MF-32** Observabilidad: latencia y coste por llamada, trazas Genkit exportadas a Sentry (OPS-observabilidad; qué se mide, [decisiones.md §2](decisiones.md), punto 4). La exportación se verifica antes, en el spike T3

## Sprint 4 — Memoria

- ⬜ **MF-33** Estructura de la memoria y criterios de éxito ([decisiones.md §2](decisiones.md), punto 5). Semilla: [enfoque-academico.md](enfoque-academico.md)
- ⬜ **MF-34** Capítulo del proceso SDD con agentes (PROC-sdd-memoria)
- ⬜ **MF-35** Presentación y vídeo de defensa
- ⬜ **MF-36** Checklist de evaluación para el tribunal, en el repo y enlazado desde el README: acceso a la app desplegada con la cuenta de demo (sin publicar sus credenciales, SEG-sistema-cerrado), qué revisar en la UI y cómo ejecutar los tests en local

---

## Si no da tiempo: qué se suelta primero

> **Propuesta, pendiente de validar por el autor.** Nada de esta lista está decidido.

De lo más prescindible a lo menos:

1. Temporada (ING-temporada, que ya se declara recortable)
2. Ablación (b): de tres variantes del texto vectorizado a dos
3. Ground truth ampliado: se quedan 5 menús, sin ampliar a 10

El experimento parser vs. LLM en extracción **ya no se puede soltar por separado**: desde 2026-09-27 es el método de EVAL-ground-truth. Soltarlo es soltar también la evaluación de la extracción.

Lo que **no se recorta**: los golden sets de recuperación y la comparativa por tipo (pilares 1 y 2 de PROC-enfoque), ni autenticación, despliegue y tests, que el máster pide demostrar.
