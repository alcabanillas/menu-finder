# Roadmap

> **Qué es este documento:** el **orden de trabajo** del autor: fases, qué entra en cada una y cuándo se da por cerrada. **No es normativo.** Las decisiones viven en [Fuente-de-Verdad.md](Fuente-de-Verdad.md) y las specs de cada tarea en [`tareas/`](tareas/). Aquí solo se **ordenan** y se enlazan.
>
> Si algo de aquí contradice a la fuente de verdad, manda la fuente de verdad y este fichero se corrige.
>
> **Leyenda:** ✅ hecho · ⬜ pendiente · 📝 necesita spec en `tareas/` antes de escribir código (SDD).

---

## Calendario

| Bloque | Fechas | Contenido |
|---|---|---|
| Fase 1 | semana 1 · 2026-09-24 → 10-01 | Datos, golden sets, buscador y evaluación de recuperación |
| Fase 2 | semana 2 · 10-01 → 10-08 | Frontend y app desplegada |
| Fase 3 | semana 3 · 10-08 → 10-15 | Evaluación del flujo LLM y observabilidad |
| Memoria | semana 4 · 10-15 → 10-22 | Memoria, presentación y vídeo de defensa |

Las fechas son orientativas. Lo que no se mueve es el **orden** dentro de la fase 1.

## Regla de orden: etiquetar antes de construir

Los golden sets se etiquetan **a ciegas y antes de ver resultados** (EVAL-golden-sets). Si el buscador existe antes que ellos, el etiquetado deja de ser ciego y la comparativa pierde valor ante el tribunal. Por eso el etiquetado es lo primero de la fase 1, no lo último del proyecto.

---

## Fase 1 — Datos y evaluación de recuperación

**Sale de la fase:** el dataset está en la BD de producción y hay una tabla léxica vs. semántica vs. híbrida, **por tipo de consulta**, medida contra el golden set.

**Datos**
- ✅ Parser del menú → `data/menu-platos.json` (ING-menu-json, ING-parser-menu, [T2 §2](tareas/T2-esquema-json-ingesta.md))
- ✅ Parser de recetas → `data/recetas.json` (ING-determinista, [T2 §4](tareas/T2-esquema-json-ingesta.md))
- ⬜ Parser de la lista de la compra: revisar y documentar (ING-lista-compra, ING-lista-dato-primario, [T2 §3](tareas/T2-esquema-json-ingesta.md))

**Golden sets (antes de tocar el buscador)**
- ⬜ 📝 T4: ground truth de extracción por adjudicación ciega de discrepancias parser ↔ LLM, 30 recetas + 5 menús (EVAL-ground-truth). Primera tarea tras el setup del repo
- ⬜ 📝 Etiquetar 40 consultas de recuperación, ~8 por tipo de BUS-superficie-consulta, con los menús relevantes esperados (EVAL-golden-sets)
- ⬜ Etiquetar 50 peticiones → estructura tipada esperada, para el descomponedor (EVAL-golden-sets)

**Buscador**
- ⬜ 📝 Spike T3: descomponer + ranquear los 36 en consola, sin BD ni app (Fuente-de-Verdad §7). Fija el schema del descomponedor (§6.1)

**Repo del producto y carga**
- ✅ Repo del producto creado: Next.js 16 + TypeScript + Tailwind v4 con pnpm (ARQ-nextjs, OPS-paquetes, UI-estilos), estructura de `src/` de [ADR-001](adr/ADR-001-arquitectura-interna.md) y OpenSpec con `openspec/config.yaml` (PROC-sdd)
- ⬜ Terminar la revisión de [OWASP-Top10.md](OWASP-Top10.md): l.96 (MFA para administradores) y l.110 (cambios de privilegios) ya no aplican con un solo rol (SEG-roles)
- ⬜ Activar el workflow `verify` de OpenSpec (`openspec config profile`): el perfil por defecto no lo instala y PROC-sdd lo incluye
- ⬜ Reglas de arquitectura en ESLint (ARQ-hexagonal, ADR-001 §3), CI base con `pnpm install --frozen-lockfile`, tests negativos de autorización, escaneo de secretos y de paquetes maliciosos, y Dependabot con periodo de espera (OPS-ci-cd, [safety-first §2.4, §2.5 y §3](safety-first.md))
- ⬜ 📝 CLI de ingesta idempotente, con limpieza de marca y enriquecimiento (ING-cli-local, SEG-datos-nutricionista, BUS-superficie-consulta (c))
- ⬜ BD de producción con el modelo de ARQ-modelo-datos y el dataset cargado; en Neon, sin Data API y con RLS en todas las tablas ([safety-first §2.4](safety-first.md))

**Evaluación de recuperación**
- ⬜ Léxica vs. semántica vs. híbrida, por tipo de consulta (EVAL-estrategia, BUS-superficie-consulta (d))
- ⬜ Decidir si el vector store entra o sale, a la vista de la tabla (ARQ-modelo-datos)

## Fase 2 — Frontend y app

**Sale de la fase:** la app está desplegada en Vercel, con login, y el flujo semanal funciona de principio a fin.

- ⬜ 📝 Autenticación con email y contraseña, cuentas creadas por el CLI y sin registro, un solo rol, cuenta de demo para el tutor entregada en el formulario del máster (SEG-roles, SEG-sistema-cerrado; librería pendiente, §6.2)
- ⬜ 📝 Límites de uso: login, buscador y tope global diario del LLM, con tests de abuso (SEG-rate-limit)
- ⬜ `/planner` como buscador con chips y explicación (UI-planner-buscador, BUS-superficie-consulta (e))
- ⬜ `/menu` con la card de receta (UI-card-receta)
- ⬜ `/shopping-list` como checklist contra la BD (ING-lista-compra, UI-flujo-semanal)
- ⬜ `/` dashboard (UI-home-sin-login)
- ⬜ Despliegue en Vercel con CI test → build → deploy (OPS-vercel, OPS-ci-cd), revisando [safety-first §2.4](safety-first.md)
- ⬜ Tests: unit de parsers, integración, E2E del flujo semanal (OPS-calidad, §6.3)

## Fase 3 — Evaluación del flujo LLM

**Sale de la fase:** están todas las cifras que necesita la memoria.

- ⬜ Precisión/recall del descomponedor contra las 50 peticiones (EVAL-golden-sets)
- ⬜ Faithfulness de la explicación con juez de otra familia (EVAL-estrategia, IA-proveedor)
- ⬜ Ablaciones: frase entera vs. descomponer y agregar; tres variantes del texto vectorizado (EVAL-golden-sets)
- ⬜ Experimento de comparación: parser vs. LLM en extracción de recetas (ING-determinista)
- ⬜ Observabilidad: latencia y coste por llamada, trazas Genkit exportadas a Sentry (OPS-observabilidad, §6.4). La exportación se verifica antes, en el spike T3

## Semana 4 — Memoria

- ⬜ Estructura de la memoria y criterios de éxito (§6.5). Semilla: [enfoque-academico.md](enfoque-academico.md)
- ⬜ Capítulo del proceso SDD con agentes (PROC-sdd-memoria)
- ⬜ Presentación y vídeo de defensa

---

## Si no da tiempo: qué se suelta primero

> **Propuesta, pendiente de validar por el autor.** Nada de esta lista está decidido.

De lo más prescindible a lo menos:

1. Temporada (ING-temporada, que ya se declara recortable)
2. Ablación (b): de tres variantes del texto vectorizado a dos
3. Ground truth ampliado: se quedan 5 menús, sin ampliar a 10

El experimento parser vs. LLM en extracción **ya no se puede soltar por separado**: desde 2026-09-27 es el método de EVAL-ground-truth. Soltarlo es soltar también la evaluación de la extracción.

Lo que **no se recorta**: los golden sets de recuperación y la comparativa por tipo (pilares 1 y 2 de PROC-enfoque), ni autenticación, despliegue y tests, que el máster pide demostrar.
