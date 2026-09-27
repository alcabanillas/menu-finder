# TFM — Fuente de verdad del proyecto

> **Qué es este documento:** la referencia normativa de visión, alcance y decisiones **vigentes**. Si algo contradice este fichero, este fichero manda.
>
> **Cómo se mantiene (regla dura, 2026-09-20):**
> 1. Aquí se escribe **solo lo que es verdad ahora**, en presente y sin tachones.
> 2. Una decisión derogada **desaparece de aquí**. Su historia —qué se creía, qué la tumbó, qué arrastró— va a [historial-de-decisiones.md](historial-de-decisiones.md), que es append-only y es material directo de la memoria.
> 3. La argumentación académica (por qué esto es un TFM de IA y no un CRUD) vive en [enfoque-academico.md](enfoque-academico.md), no aquí.
> 4. Si para saber qué hacer tienes que leer dos de los tres ficheros, la separación ha fallado: arréglala.
>
> **Última actualización:** 2026-09-27.

---

## 1. Idea en una frase

Aplicación web (responsive, uso principal en móvil) para elegir el menú semanal del hogar a partir de una base de **~36 menús históricos en PDF**, elaborados por un nutricionista profesional para el autor, con su lista de la compra asociada como checklist. La IA se usa para **extraer, estructurar y recuperar** información existente, no para generar menús nuevos.

Sustituye el flujo actual del autor en Notion.

**Enfoque (PROC-enfoque): proyecto de IA aplicada; la app es la interfaz.** El sistema es **hybrid retrieval + grounded generation**, no RAG documental clásico: no hay chunking, ni problema de ventana de contexto, ni de escala, y en la memoria se describe así. El peso académico descansa en cuatro pilares, por orden: (1) **extracción estructurada del menú** medida contra ground truth etiquetado a ciegas (EVAL-ground-truth, ING-parser-menu); (2) **evaluación comparada de recuperación** —léxica vs. semántica vs. híbrida— sobre el golden dataset (EVAL-estrategia); (3) **faithfulness de la explicación** con LLM-as-judge (EVAL-estrategia); (4) **flujo SDD con agentes** documentado como proceso (PROC-sdd-memoria). Sin (1) y (2) el proyecto es un CRUD con un embedding, así que los cuatro se protegen frente a cualquier recorte de alcance. Argumentación completa en [enfoque-academico.md](enfoque-academico.md).

## 2. Restricciones duras

| Restricción | Valor |
|---|---|
| Plazo | **3 semanas** de desarrollo + **1 semana** para memoria, presentación y vídeo de defensa |
| Contexto | TFM de Máster en Desarrollo con IA. Debe demostrar: desarrollo asistido por IA, arquitectura, web moderna, LLM/RAG, testing, despliegue, seguridad, observabilidad |
| Modo de trabajo | Desarrollo asistido por agentes bajo **SDD (Spec-Driven Development)**: las especificaciones viven en el repo y son la entrada de los agentes. Reglas de seguridad en [safety-first.md](safety-first.md) |
| Coste | Proveedor LLM y hosting con capa gratuita o coste muy reducido |
| Datos | Mono-cuenta. Estructura `Dieta/Menu N/` con `menu.pdf`, `Lista_de_la_compra.pdf` y **un PDF por plato con su receta**. Copia local en `data/raw/Dieta/` (710 PDF + 710 TXT vía `pdftotext -layout`, gitignoreado). La app **no accede a Drive** (ING-cli-local). No multi-tenant |

## 3. Fuera de alcance (MVP)

- Generación de menús o recetas (ING-menu-json). Mostrar el texto de una receta existente **sí** entra (UI-card-receta).
- Búsqueda dentro del texto de las recetas, escalado de raciones, cálculo nutricional (UI-card-receta).
- **Integración con Google Drive** en cualquier forma (Service Account, OAuth, adaptador). Los ficheros se descargan a mano (ING-cli-local).
- Subida manual de ficheros; detección automática de cambios en origen; versionado del índice (ING-sin-subida).
- **Usuario anónimo** y registro de usuarios (SEG-sistema-cerrado).
- **"Sorpréndeme" / menú aleatorio**. El único camino para elegir menú es el buscador de `/planner`.
- Multi-tenant, perfiles premium, pagos, gestión de usuarios.
- App nativa, notificaciones, PWA offline.
- OCR, imágenes, nutrición avanzada, supermercados, precios, pedidos.
- Multiidioma, social. Microservicios, Kubernetes.
- **Batch cooking** en cualquier forma: reordenar los platos entre días, generar un plan de preparación del domingo o reescribir recetas. Descartado el 2026-09-20 porque no es evaluable (no hay ground truth de una semana reordenada ni de la caducidad/batchabilidad de cada plato). Se documenta en la memoria como **línea futura con diseño esbozado**; el porqué, en el historial.
- **URL Shortener**: plan B de TFM si esta idea resulta inviable en plazo.

## 4. Los datos reales

Medidos sobre los 36 menús en el análisis T1 (repo `tfm-brainstorm`, no viaja). Los tres tipos de PDF son **texto** generado por TCPDF, sin OCR necesario. **El menú y las recetas se extraen directamente del PDF**, sin paso intermedio por TXT: el menú con `pdf-parse` (`getTable()`, §4.1) y las recetas con `pdfjs-dist` (texto con coordenadas, §4.3); ver [T2](tareas/T2-esquema-json-ingesta.md). Solo la lista de la compra sigue extrayéndose vía TXT con `pdftotext -layout` ([T0](tareas/T0-extraccion-previa.md)).

### 4.1 `menu.pdf` (1 página)

- Tabla de 7 columnas (L–D) × 5 filas: Desayuno, Almuerzo, Comida, Merienda, Cena.
- **Todos los menús van de lunes a sábado.** El domingo se deja libre a propósito, como día de descanso: así lo genera la herramienta del nutricionista. **No es un hueco de extracción**, es una regla del dominio. Consecuencias: (a) la regla "6 días" del validador de ING-determinista es normativa —un menú con domingo relleno es un error de extracción—; (b) una semana son **12 slots de comida/cena**, y los 629 slots totales (17.5 por menú) cuadran con las cenas de 2 platos de los menús ≥17; (c) la UI **no pinta 7 días**.
- Almuerzo está vacío. Desayuno y Merienda son celdas fusionadas iguales para todos los días (texto genérico, no son "platos").
- Cada celda de Comida/Cena tiene 1–2 platos marcados con `*`, más relleno fijo ("una pieza de fruta", "un yogur sin azúcares añadidos") que hay que filtrar.
- Los platos marcados con `*` tienen una receta, en un PDF independiente de la misma carpeta (§4.3).
- **No hay ninguna indicación de temporada**: ni en el PDF ni en el número de menú.
- Las celdas no son triviales de leer: nombres de plato partidos en varias líneas, el `*` a veces solo en una línea, y en los menús ≥17 las cenas traen 2 platos apilados sin separador. Cómo se resuelve: [T2 §2.3–2.4](tareas/T2-esquema-json-ingesta.md).

### 4.2 `Lista_de_la_compra.pdf` (1 página)

- Estructura muy regular: `Categoría` → líneas `- Ingrediente: cantidad unidad [(opcional)]`. **13 categorías**, ~70 ítems.
- Especias y Grasas usan otro formato (lista separada por comas, sin cantidades).
- Hay duplicados (Sésamo ×2, Ajo ×2 con y sin "opcional") que hay que fusionar o mantener como filas distintas.
- Cantidades en gramos por persona, estilo nutricionista ("Fruta: 1050g"). Válidas para checklist; poco naturales para "comprar".
- **Se parsea de forma determinista (regex), sin LLM.** Buen contraste académico frente al menú.

### 4.3 Recetas individuales (un PDF por plato)

- **639 ficheros PDF**, uno por plato, en la misma carpeta que `menu.pdf`. El nombre del fichero es el nombre del plato. **434 distintos**; 146 se repiten en varios menús y 105 de ellos con **versiones** distintas (ediciones del nutricionista: sal 5 g → 2 g, "180º" → "180ºC"). Ver [T2 §4.5](tareas/T2-esquema-json-ingesta.md).
- Se extraen a JSON con **parser posicional determinista** (`parse-recetas-pdfjs.js`, [T2 §4](tareas/T2-esquema-json-ingesta.md)): título, tiempos en minutos, **4.929 ingredientes** con nombre / medida casera / gramos / opcional, preparación en párrafos. 100 % de líneas parseadas, 0 anomalías estructurales, sin `pdftotext`.
- El pie (marca, email, eslogan) y el bloque de contacto del nutricionista no llegan al JSON (SEG-datos-nutricionista). Cómo se leen las recetas: [T2 §4.1](tareas/T2-esquema-json-ingesta.md).
- Cobertura medida sobre `data/menu-platos.json` (T2, ING-parser-menu): **608 platos**, **591 con receta marcada por asterisco y fichero resuelto**, 17 sin receta (relleno tipo "tomate y cebolla asada"). Las 176 celdas con 2+ platos vienen ya separadas; no queda ningún plato concatenado.
- Consecuencia: la búsqueda opera **a nivel de plato**, no de semana agregada. Es lo que hace viable el buscador (BUS-unidad-plato, BUS-discrimina-plato).

## 5. Decisiones vigentes

> Cada decisión tiene un **código inmutable** con la forma `ÁREA-tema`: el prefijo es el área (ARQ, OPS, UI, ING, BUS, IA, EVAL, SEG, PROC) y el tema dice de qué trata. **El código nombra el tema, nunca el veredicto**, para que siga siendo cierto aunque la decisión cambie. Dentro de cada bloque, el orden va de lo más estructural a lo más concreto. **PROC-enfoque** (enfoque del proyecto) vive fuera de esta tabla, en §1. Las decisiones derogadas no aparecen aquí; están en [historial-de-decisiones.md](historial-de-decisiones.md), que conserva la numeración antigua `D<n>` y su tabla de correspondencia.

### 5.1 Arquitectura

| Código | Decisión | Fuente |
|---|---|---|
| ARQ-app-desplegada | Aplicación web real desplegada, no notebook ni demo | Estado del arte §9 |
| ARQ-nextjs | **Next.js (App Router) + TypeScript**, frontend y backend en el mismo proyecto | Todas |
| ARQ-hexagonal | **Arquitectura interna: hexagonal (puertos y adaptadores)**, con Next.js App Router como capa de adaptadores primarios. Las reglas de dependencia son **verificables por ESLint en pre-commit y CI**; no se adopta norma de arquitectura que no se pueda verificar automáticamente. Detalle en [ADR-001](adr/ADR-001-arquitectura-interna.md) | Autor 2026-09-19 |
| ARQ-modelo-datos | **Modelo de datos.** La unidad es **`Recipe`** (434 ficheros distintos, con versiones entre menús: qué versión se carga lo fija la spec de ingesta, recomendación en [T2 §4.5](tareas/T2-esquema-json-ingesta.md); los 17 platos sin receta son filas con texto nulo). `Menu(number, season, seasonEvidence)` → `Meal(menuId, day, type)` → `MenuDish(mealId, recipeId, position)`, que es el slot. `RecipeIngredient(recipeId, ingredientId, qty, unit, optional)` → `Ingredient(name, foodGroupId)` → `FoodGroup`. La lista de la compra va **aparte** (ING-lista-dato-primario): `ShoppingItem(menuId, category, name, qty, unit)` y `UserShoppingItem(userId, shoppingItemId, checked)`. `Selection(userId, menuId, selectedAt)`: la actual es la última, el historial son todas ("sin los últimos N", BUS-superficie-consulta). `RecipeEmbedding(recipeId, variant, vector)` con `variant` para la ablación de EVAL-golden-sets. `User(email)`. PostgreSQL + pgvector en **Neon, plan gratuito** (no caduca, no pausa el proyecto, sin API automática sobre las tablas y con ramas de BD para las previews de Vercel); el vector store solo lo usa el tipo difuso/hiperónimo y sale si la comparativa por tipo no lo justifica | Autor 2026-09-21; proveedor fijado 2026-09-24 (historial) |

### 5.2 Despliegue y calidad

| Código | Decisión | Fuente |
|---|---|---|
| OPS-vercel | Despliegue en **Vercel** (Render como alternativa). Kubernetes: no | README, Estado del arte |
| OPS-ci-cd | CI/CD con GitHub Actions: test → build → deploy. Dependabot / `pnpm audit` en CI | README |
| OPS-paquetes | **pnpm** como gestor de paquetes. Instala con lockfile congelado y, desde pnpm 10, no ejecuta scripts de instalación salvo los permitidos en `pnpm-workspace.yaml` (safety-first §2.5) | Autor 2026-09-27 |
| OPS-calidad | Linter, Husky, pirámide de testing (unit / integration / E2E), Sentry | README |
| OPS-observabilidad | **Sentry para producción; Developer UI de Genkit en local.** Sentry recoge errores y trazas. Las trazas de los flujos LLM las genera Genkit con OpenTelemetry y se exportan a Sentry por OTLP: **por verificar en el spike T3**, incluido que en Vercel se envíen antes de que termine la función. En local, la Developer UI de Genkit muestra cada ejecución y las decisiones del descomponedor. No hay consola de debug en la app. **Qué viaja a Sentry:** la estructura de cada ejecución (tiempos, modelo, tokens, errores) y las decisiones del descomponedor como atributos propios (restricción relajada, vuelta, candidatos restantes); **no** las entradas ni salidas de los pasos, que llevan texto de recetas y peticiones de usuario (SEG-datos-nutricionista) | Autor 2026-09-27 |

### 5.3 Frontend

| Código | Decisión | Fuente |
|---|---|---|
| UI-flujo-semanal | Flujo semanal: el usuario elige un menú → "menú actual" → su lista pasa a "lista actual" → marca ítems → la nueva semana reemplaza el estado actual, histórico intacto | ResumenIdeas |
| UI-estilos | **Tailwind CSS v4.** Lo trae el scaffold de Next.js | Autor 2026-09-27 |
| UI-home-sin-login | **`/` tiene dos estados.** Sin sesión: home informativa, sin datos del catálogo ni del usuario, con acceso al login; el login no bloquea la landing. Con sesión: dashboard (§8). El estado lo decide el servidor a partir de la sesión, no el cliente (safety-first §2.2). La home **no ofrece registro** (SEG-sistema-cerrado) | Notion TFM raíz; dos estados 2026-09-27 |
| UI-planner-buscador | **`/planner` es un buscador de menús con explicación, no un chat generativo.** Petición en lenguaje natural → candidatos ranqueados + por qué encaja cada uno. El usuario elige uno de los 36; el sistema no compone menús día a día | Autor 2026-09-19 |
| UI-card-receta | **Alcance de las recetas: fuente de datos + tarjeta, no pantalla propia.** La receta se usa (a) como fuente de ingredientes por plato para el buscador y (b) como **card desplegable dentro de `/menu`** al pulsar un plato. **No** hay ruta propia, ni búsqueda dentro del texto de la receta, ni escalado de raciones, ni cálculo nutricional | Autor 2026-09-19 |

### 5.4 Ingesta

| Código | Decisión | Fuente |
|---|---|---|
| ING-menu-json | El menú se extrae a **JSON estructurado** (día → comida/cena → platos). Ese JSON es la fuente de verdad de la app. La app **no genera** menús ni recetas. **✅ Cerrado 2026-09-20:** `scripts/datos/parse-menu-pdftable.js` genera el JSON de los 36 menús desde `menu.pdf` (0 anomalías estructurales sobre 504 slots); esquema documentado en [T2](tareas/T2-esquema-json-ingesta.md). El JSON vive en `data/menu-platos.json`, gitignoreado por SEG-datos-nutricionista — no se sube al repo | ResumenIdeas |
| ING-parser-menu | **El parser determinista del menú es el sistema, no el plan B.** `scripts/datos/parse-menu-pdftable.js` (`pdf-parse`/`getTable()`, [T2](tareas/T2-esquema-json-ingesta.md)) reconstruye la tabla real del PDF, separa celdas de 2+ platos y resuelve receta por el asterisco del propio PDF, con **0 anomalías estructurales** sobre los 504 slots de los 36 menús. Falta medirlo contra ground truth etiquetado a mano (EVAL-ground-truth) para conocer su precisión real. Un LLM extrayendo el menú no aporta nada que medir salvo perder contra una regex; el LLM se emplea donde hay riesgo (ING-determinista) | Autor 2026-09-21; era "plan B" (historial) |
| ING-recetas | **Las recetas entran en el dataset.** Un PDF por plato (~620) en la carpeta del menú, con sección `INGREDIENTES` en el mismo formato que la lista de la compra → parser determinista, sin LLM. Cobertura 621/629 slots | T1, autor 2026-09-19 |
| ING-determinista | **La extracción es determinista en las tres patas; el agente extractor es un experimento, no el sistema.** Menú ([T2 §2](tareas/T2-esquema-json-ingesta.md), ING-parser-menu) y recetas ([T2 §4](tareas/T2-esquema-json-ingesta.md)) se parsean por posición desde el PDF con 0 anomalías estructurales; la lista de la compra sigue siendo regex (ING-lista-compra). Un LLM extrayendo lo que ya casa al 100 % no tiene nada que corregir, así que **no entra en la ingesta**. Queda como **experimento de comparación** para la memoria: mismo ground truth de 30 recetas (EVAL-ground-truth), parser vs. LLM con structured output (Zod) y agente con reintento, medido en precisión y coste. El pilar (1) de PROC-enfoque se documenta como "extracción evaluada contra ground truth", con el hallazgo de que el LLM no hacía falta | Autor 2026-09-21; antes el agente era sistema sobre recetas (historial) |
| ING-lista-compra | La lista de la compra se parsea de forma determinista, se normaliza y **persiste en BD relacional** asociada al menú. La checklist trabaja contra BD, nunca contra el LLM | Exploración §2.A, §4.2 |
| ING-lista-dato-primario | **`Lista_de_la_compra.pdf` es dato primario y nunca se recalcula.** Incluye ítems de desayuno, merienda y relleno fijo que **no corresponden a ningún plato con receta**, así que no se deriva de los platos del menú ni se contrasta como si fueran equivalentes. La única relación esperable es *ingredientes de las recetas ⊆ lista de la compra*. Refuerza ING-lista-compra | Autor 2026-09-19 |
| ING-cli-local | **Ingesta por CLI local, no desde la app.** Un comando del repo (p. ej. `pnpm ingest ./data/raw`) recorre `Dieta/Menu N/`, extrae menú, lista y recetas a JSON y los carga en la **BD de producción** desde la máquina del autor. La app desplegada solo conoce la BD: no hay job, ni botón "Sincronizar", ni acceso a Drive. El pipeline vive en el hexágono (ADR-001): un puerto `DocumentSource` para escanear directorios y leer ficheros, con una única implementación contra el sistema de ficheros local. El CLI es **idempotente por número de menú** y las credenciales de producción van en `.env` local, nunca en el repo | Autor 2026-09-20 |
| ING-trazabilidad | **Hace falta trazabilidad de la ingesta — pero no para el menú.** El menú va directo **PDF → JSON** (`parse-menu-pdftable.js`, [T2](tareas/T2-esquema-json-ingesta.md)): no hay paso por TXT ni por un LLM que corregir, así que no hay cadena que trazar más allá de lo que ya cubren los tests deterministas y el contraste contra ground truth (EVAL-ground-truth). Sigue haciendo falta para **lista de la compra y recetas**, si acaban pasando por TXT o por LLM: poder comparar, por documento, la cadena PDF → TXT → JSON extraído → JSON corregido → filas en BD y ver dónde se pierde o cambia algo. Es el soporte operativo de EVAL-ground-truth para esas dos patas. **Forma (cierra C7):** un **informe estático por documento** que genera el CLI (TXT → JSON extraído → JSON corregido → filas en BD, con diff), y las **correcciones son un fichero JSON en `data/`** que el CLI aplica de forma idempotente en cada ejecución. El informe **no se ve en la app**: se abre en local y se enseña en la memoria y el vídeo. No hay edición in situ (costaba días para un flujo que el autor ejecuta una vez). **Genkit sí**, confinado en `infrastructure/` tras un puerto: sus trazas cubren los tres flujos LLM (extractor, descomponedor, explicador; OPS-observabilidad); lo determinista lo cubre el informe | Autor 2026-09-20; forma fijada 2026-09-21; fuera de la app 2026-09-27 (historial) |
| ING-sin-subida | **Sin subida manual de PDFs.** La detección de cambios en origen y el versionado del índice quedan fuera del MVP | Autor 2026-09-18 |
| ING-temporada | **Temporada: campo opcional del schema de extracción** (`season` + evidencia), inferido por el LLM a partir de los ingredientes; el autor la corrige en el JSON de `data/`, fuera de la app (SEG-roles). Feature adicional: si compromete plazo, se elimina sin afectar al resto | Autor 2026-09-18 |

### 5.5 Buscador

| Código | Decisión | Fuente |
|---|---|---|
| BUS-superficie-consulta | **Superficie de consulta del buscador (cierra C9).** El buscador **puntúa los 36 menús en cada petición**, no recupera unos pocos de muchos: el resultado es siempre un ranking, y "0 resultados" solo puede salir de un filtro duro. **(a) La conjunción "y" separa restricciones; "con" las une.** "Pollo y brócoli" son dos restricciones, cada una satisfecha por *algún plato de la semana*; "arroz con pollo" es *una* restricción que debe cumplir un mismo plato. Puntuación del menú = agregación, por restricción, del mejor plato que la cubre, con penalización por restricción no cubierta. **(b) Las exclusiones tienen ámbito.** Ligada a una restricción ("arroz *sin pescado*") se aplica al plato que la satisface. Global ("nada de cerdo") se aplica a la semana como **penalización blanda** por número de platos que la incumplen, y el explicador lo dice. Motivo medido (2026-09-20): ningún menú de los 36 está libre de pescado, huevo, legumbre o lácteo; solo 9 sin cerdo y 5 sin gluten; "todas las cenas ≤ 25 min" deja 2/36. El filtro duro es **opt-in** por restricción (`hard: true`) y, si vacía la lista, lo relaja el descomponedor (BUS-descomponedor). **(c) Capa de enriquecimiento en la ingesta (CLI, ING-cli-local)**, calculada una vez y auditable: `totalTimeMin` por plato (determinista, del campo `Total:` de la receta; plato sin receta = elaboración trivial, cuenta como rápido); **grupo alimentario por ingrediente** (tabla de ~220 filas, borrador por LLM y **curada a mano**), de la que salen la fuente de proteína y los grupos de exclusión; **temporada** por menú inferida de los ingredientes de sus recetas (es ING-temporada, con esta evidencia). El **método de cocción no se enriquece**: se resuelve por texto sobre el nombre del plato (lo lleva el 59 %) y por similitud. **(d) Cuatro tipos de restricción, cada uno con su mecanismo**: inclusión literal → full-text sobre nombre de plato + ingredientes de receta, con límite de palabra ("salmón" no es "salmonete"); exclusión → tabla de grupos; atributo → **historial del usuario** ("sin los últimos N menús", el criterio real del autor; exige guardar cada selección, no solo la actual), temporada, `meal_filter` por comida/cena y `totalTimeMin` (se enriquece porque es gratis y determinista, pero no es un criterio de ejemplo: al autor no le ha influido nunca al elegir); intención difusa o hiperónimo ("marisco", "de cuchara") → embeddings. La comparativa léxica/semántica/híbrida (EVAL-estrategia) se hace **por tipo**. **(e) Sin chat multi-turno.** La petición se descompone en restricciones tipadas que la UI muestra como chips editables; refinar = editar y relanzar, sin estado conversacional. **La petición acumula**: el texto nuevo pasa por el descomponedor solo, y sus restricciones se anexan a los chips existentes (una restricción sobre el mismo término reemplaza a la anterior y el chip lo muestra). No existe "demasiados resultados": existe un ranking plano, y la UI lo dice con un contador ("N menús empatan en cabeza"); si N es alto, se añade restricción; si es 0 con `hard`, entra BUS-descomponedor. **(f)** Las variantes de nombre ("alitas" ↔ "Pollo (ala)") las resuelve la normalización de ingredientes, no el embedding. El LLM **nunca genera la consulta**: emite la estructura tipada, Zod la valida y el SQL se construye desde ella (frontera contra prompt injection, SEG-owasp) | Autor 2026-09-20 |
| BUS-descomponedor | **El descomponedor de peticiones es un agente pleno.** Con el filtro a nivel de plato aparecen consultas con **0 resultados**: descompone → consulta → si está vacío **decide qué restricción relajar** y reconsulta → para al haber candidatos o al agotar las relajaciones. **Política (2026-09-21):** solo se dispara con un filtro `hard` que vacía (BUS-superficie-consulta). El agente recibe, por restricción dura, cuántos menús elimina, y **decide** entre dos movimientos: pasarla a blanda o sustituirla por su hiperónimo ("garbanzos" → legumbre); siempre lo avisa en el chip. Máximo **2 vueltas**; después muestra el mejor ranking parcial. "Soltar la restricción menos cubierta" no existe: con todo blando por defecto no aporta | T1, autor 2026-09-19; política 2026-09-21 |
| BUS-unidad-plato | **Unidad de indexación: el plato**, con los ingredientes de su receta. No la semana agregada, no el documento, no chunks. La lista de la compra **no se indexa**: alimenta la checklist (ING-lista-compra) | T1, autor 2026-09-19 |
| BUS-discrimina-plato | **El dataset discrimina a nivel de plato.** Medido: una consulta proteína+verdura devuelve mediana de **2 menús de 36** filtrando por plato, frente a **15.5** filtrando por semana agregada. Consecuencia: el prompt del explicador se queda en *por qué encaja*, no hay que invertirlo a *en qué se diferencia* | T1, autor 2026-09-19 |
| BUS-vector-derivado | El vector store es un **índice semántico derivado**, no la fuente de verdad. Su unidad es el plato (BUS-unidad-plato) | ResumenIdeas, afinada por BUS-unidad-plato |
| BUS-sin-despensa | **El usuario no declara lo que tiene en casa.** "Ingredientes semanales" se refiere a la lista de la compra del menú, no a un input adicional. *(Sobre qué índice se resuelve la consulta: BUS-superficie-consulta.)* | Autor 2026-09-18 |

### 5.6 IA transversal

| Código | Decisión | Fuente |
|---|---|---|
| IA-criterio-agente | **Criterio de "agente" del proyecto.** Es agente pleno solo lo que cumple la definición de `ConceptosRAG-y-agentes.md` §2.1: **bucle + decisión + condición de parada**. Cumplen: el **extractor** (ING-determinista) y el **descomponedor** (BUS-descomponedor) — dos agentes plenos. No cumplen y se documentan como pipeline: el **juez de evaluación** (LLM-as-judge es un patrón, una llamada con schema en batch), el **explicador** (genera una vez, su control de calidad es externo), los parsers, los embeddings, el ranking y el CLI de ingesta | Autor 2026-09-19 |
| IA-proveedor | **Proveedor.** Gemini vía Genkit para los tres flujos: Flash para descomponer y explicar (latencia); el extractor es batch y da igual. Embeddings `gemini-embedding-001` (multilingüe; la dimensión la fija el modelo, no la tabla). **El juez de evals es de otra familia** (p. ej. Claude Haiku 4.5): un modelo evaluándose a sí mismo es una objeción fácil del tribunal. Claves solo en `.env` local y en los secretos de Vercel | Autor 2026-09-21 |

### 5.7 Evaluación

| Código | Decisión | Fuente |
|---|---|---|
| EVAL-estrategia | Evaluación con **golden dataset** (`evals.json`) + **LLM-as-judge** (faithfulness, answer relevance) + comparativa de estrategias de recuperación | Exploración §2.C |
| EVAL-ground-truth | **Ground truth por adjudicación ciega de discrepancias.** Muestra sorteada **al inicio** y reproducible por semilla (`scripts/datos/sorteo-ground-truth.js`), excluyendo lo que el autor ya haya revisado a mano de la salida de los parsers: **30 recetas** y **5 menús, ampliable a 10**. El parser determinista y el extractor LLM (ING-determinista) extraen la muestra; el LLM recibe el **PDF**, no el texto del parser, para que sus errores sean independientes. Donde coinciden, el valor se da por bueno; donde discrepan, el autor decide mirando el PDF **sin saber qué valor es de quién**. Se guardan la salida cruda de cada extractor, el ground truth resultante y el registro de adjudicación. Métricas: precisión del parser y del LLM por campo, y coste y latencia del LLM. **Limitación, declarada en la memoria:** un error idéntico en los dos extractores no se detecta. Spec: T4, primera tarea tras el setup del repo del producto | Autor 2026-09-19; ampliada 2026-09-21; adjudicación 2026-09-27 (historial) |
| EVAL-golden-sets | **Golden sets y ablaciones.** Dos golden sets etiquetados **a ciegas por el autor antes de ver resultados**: **50 peticiones** → estructura tipada esperada (descomponedor; precisión/recall por restricción y por tipo) y **40 consultas** de recuperación, ~8 por tipo de BUS-superficie-consulta, con menús relevantes esperados. Ablaciones: (a) embedding de la frase entera vs. descomponer y agregar; (b) texto a vectorizar en tres variantes — solo nombre (línea base), nombre + ingredientes, nombre + ingredientes + preparación — sobre el subconjunto difuso/hiperónimo. Juez de otra familia (IA-proveedor) para faithfulness de la explicación | Autor 2026-09-21 |

### 5.8 Seguridad

| Código | Decisión | Fuente |
|---|---|---|
| SEG-owasp | Security by Design / by Default, OWASP Top 10, protección contra prompt injection. Reglas operativas en [safety-first.md](safety-first.md) | README |
| SEG-roles | **Un solo rol: usuario registrado.** No hay admin en la app: el informe de trazabilidad se ve fuera de ella (ING-trazabilidad) y la depuración de los flujos LLM va por Sentry y la Developer UI de Genkit (OPS-observabilidad). Las correcciones de lo ingestado se hacen en el JSON de `data/` y se cargan con el CLI (ING-cli-local, EVAL-ground-truth). Nada de premium ni gestión de usuarios. Sin usuario anónimo (SEG-sistema-cerrado) | Autor 2026-09-18; acotado 2026-09-24; un solo rol 2026-09-27 (historial) |
| SEG-datos-nutricionista | **Repo público; nada del nutricionista en el repo ni en la BD.** La marca, el email de contacto, el eslogan y el pie de copyright **se eliminan en la ingesta**, antes de cargar en BD; `valoracion-*.pdf` se ignora. Los PDF/TXT originales solo viven en `data/` (gitignoreado). Se **conservan nombres de plato e ingredientes**: son hechos y frases cortas, y sin ellos no hay nada sobre lo que buscar. **El texto de elaboración de las recetas sí se carga en BD** para la card de UI-card-receta: el proyecto es educativo y de uso personal, sin explotación comercial, y el aviso de copyright solo aparece en `menu.pdf`. Se asume que el uso educativo reduce el riesgo práctico, no que sea una excepción legal — y por eso el sistema es cerrado (SEG-sistema-cerrado). Fixtures de test: 2–3 menús con nombres sustituidos por ficticios **mediante script**, conservando el layout. **Cita obligatoria** en memoria y README, sin nombre del profesional: *"Los datos (36 menús semanales, listas de la compra y recetas) fueron elaborados por un nutricionista profesional para el autor y se usan con fines exclusivamente educativos y personales. No se redistribuyen: no forman parte del repositorio ni de ningún entregable público."* | Autor 2026-09-20 |
| SEG-sistema-cerrado | **Sistema cerrado: sin registro en la app.** Las cuentas (email y contraseña) las crea el CLI; la app no tiene formulario de alta ni recuperación de contraseña, y quien no tenga cuenta no puede iniciar sesión. Motivo: la BD contiene el texto de elaboración de ~640 recetas de un profesional (SEG-datos-nutricionista) y con registro abierto el material quedaría **redistribuido**, que es justo lo que la cita de SEG-datos-nutricionista afirma que no ocurre. Para la entrega se da al tutor una **cuenta de demo** (usuario y contraseña) en el **formulario de entrega del máster**, nunca en la memoria ni en el repo. Es además un caso real de **control de acceso y reducción de superficie por diseño**: sin alta, sin recuperación y sin envío de correos (SEG-owasp) | Autor 2026-09-20; sin registro desde 2026-09-24 (historial); canal de la demo 2026-09-27 |
| SEG-rate-limit | **Límites de uso en servidor, con tres niveles.** (1) Login: intentos fallidos por cuenta y por IP (fuerza bruta). (2) Buscador: peticiones por usuario y ventana de tiempo (abuso de una cuenta). (3) **Tope global diario de llamadas al LLM**, que protege los créditos aunque el abuso se reparta entre cuentas o IPs; la cuenta de demo (SEG-sistema-cerrado) es el caso de riesgo. Al superar un límite se responde `429`. Los contadores viven en una **tabla de Neon** detrás de un puerto `RateLimiter` (ARQ-hexagonal): en Vercel no hay proceso de larga vida y un contador en memoria no sirve; sin proveedor nuevo, y cambiable a Redis sin tocar el dominio. Los valores concretos los fija la spec. Tests de abuso en CI (safety-first §3) | Autor 2026-09-24 |

### 5.9 Proceso

| Código | Decisión | Fuente |
|---|---|---|
| PROC-sdd | **SDD con OpenSpec.** Sin spec no hay código. Cada cambio sigue `explore` (opcional) → `propose` (proposal, specs, design, tasks) → `apply` → `verify` → `archive`. `verify` comprueba que cada requisito y escenario de la spec tiene código y test; en OpenSpec es opcional y no bloquea el `archive`, así que **lo obligatorio lo impone CI**, no verify. **La seguridad entra por la spec** (SEG-owasp, P1 de [safety-first.md](safety-first.md)): el proposal identifica datos tocados, posibles abusos y categorías OWASP aplicables; cada endpoint trae sus escenarios negativos de autorización y validación, que verify comprueba como cualquier otro requisito; antes del `archive` se repasa la checklist de safety-first §4. Se configura en `openspec/config.yaml` del repo del producto (`context`, `rules` por artefacto y guía de `archive`) | Autor 2026-09-24 |
| PROC-sdd-memoria | La memoria documenta el flujo SDD con agentes **como proceso**: qué se delega a los agentes y qué se revisa, no un listado de "tareas que funcionan con agentes" | Antes D14; hasta 2026-09-24 vivía en `AGENTS.md` |

## 6. Lo abierto

Una sola lista, ordenada por lo que bloquea. Los identificadores `C` son históricos y se mantienen por compatibilidad con lo ya escrito. **No queda ninguna contradicción abierta**: C7 se cerró con la forma de ING-trazabilidad el 2026-09-21.

1. **Schema definitivo del descomponedor** (tipos, `scope`, `hard`, atributos). Boceto en BUS-superficie-consulta; se fija en el spike T3 con peticiones reales.
2. **Autenticación.** Cookies httpOnly + sesión; un solo rol (SEG-roles); email y contraseña, con cuentas creadas por el CLI y sin registro (SEG-sistema-cerrado). Falta elegir librería.
3. **Testing.** Parsers de lista y recetas (unit, determinista), extracción contra ground truth (EVAL-ground-truth), retrieval (golden sets, EVAL-golden-sets), E2E del flujo semanal.
4. **Observabilidad.** Latencia y coste por llamada: qué se mide y dónde se muestra (OPS-observabilidad).
5. **Estructura de la memoria y criterios de éxito** medibles.

### Oportunidades detectadas en T1 (no bloquean, sí aportan)

- **Validación cruzada parcial.** Los ingredientes de las recetas de una semana deberían estar **contenidos** en su lista de la compra (nunca al revés, ING-lista-dato-primario). Solo ese sentido sirve como señal de calidad de extracción, y con ruido por variantes de nombre. Es un *nice to have*, no una métrica limpia.
- **Riesgo sin verificar.** En las recetas, un nombre de ingrediente puede partirse en dos líneas con los dos puntos en la continuación. `m5-plato.js` cuenta una receta como leída con que exista la sección `INGREDIENTES`, no con que todas sus líneas parseen: puede haber pérdidas silenciosas. Medir cuántas líneas no casan con el patrón esperado.

## 7. Ejecución pendiente (decidido, sin hacer)

> El **orden** en que se ejecuta esto, por fases, está en [roadmap.md](roadmap.md). Aquí solo se dice qué está decidido.

- **Spec de la tarea de ingesta** (ING-cli-local + ING-parser-menu + ING-trazabilidad): CLI idempotente, limpieza de marca (SEG-datos-nutricionista), parsers del menú y de recetas **terminados** ([T2](tareas/T2-esquema-json-ingesta.md) patas 1 y 3), parser de lista de la compra **pendiente** (T2 pata 2), política de versiones de receta (T2 §4.5), trazabilidad (solo lista/recetas, ING-trazabilidad). Incluye la capa de enriquecimiento de BUS-superficie-consulta (c): `totalTimeMin`, tabla ingrediente → grupo, temporada. *Desbloqueada: se escribe después del spike T3, con lo que este mida.*
- **Spike T3 (código tirable, fuera de la app):** script local que lee `data/menu-platos.json` y `data/recetas.json`, descompone con el LLM contra el schema Zod y ranquea los 36 en consola. Sin BD, sin Next, sin Genkit. Su spec, breve, en `context/tareas/T3-spike-buscador.md` antes de escribirlo.
- Rehacer `/planner` como buscador (UI-planner-buscador), sobre el modelo de datos de ARQ-modelo-datos.
- Añadir la card de receta a `/menu` (UI-card-receta).

## 8. Pantallas previstas

| Ruta | Pantalla | Estado |
|---|---|---|
| `/` | Sin sesión, home informativa; con sesión, dashboard (UI-home-sin-login): menú activo, "qué toca hoy", progreso de la compra | ✅ |
| `/planner` | **Buscador de menús**: petición en lenguaje natural → candidatos con explicación | ⚠️ rehacer (UI-planner-buscador). Forma fijada por **BUS-superficie-consulta**: caja de texto que permanece, chips de restricciones editables que acumulan, ranking de los 36 con contador de empates en cabeza, evidencia por chip y explicación. Modelo de datos: ARQ-modelo-datos |
| `/menu` | Menú semanal activo, rejilla L–S / tabs en móvil. Card de receta desplegable al pulsar un plato (UI-card-receta) | ⚠️ añadir card |
| `/shopping-list` | Checklist agrupada por las 13 categorías del PDF (§4.2) | ✅ |
