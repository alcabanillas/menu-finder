# Historial de decisiones — qué se creyó, qué lo tumbó

> **Congelado el 2026-09-27.** No se añade nada más. Desde esa fecha, el porqué de cada cambio vive en el proposal de su cambio de OpenSpec (`openspec/changes/archive/`). Las entradas mencionan `Fuente-de-Verdad.md`, el documento que ese día se partió en [producto.md](producto.md), [decisiones.md](decisiones.md) y [datos.md](datos.md); los números de sección que citan son los de entonces.
>
> **Para qué sirve:** [decisiones.md](decisiones.md) dice lo que es verdad **ahora**. Este fichero dice **por qué cambió**. Es *append-only*: nada se edita ni se borra, solo se añade encima.
>
> **No es un archivo muerto.** Es la materia prima del capítulo "evolución del diseño" de la memoria, que es donde se demuestra lo que el máster evalúa: que las decisiones se tomaron **contra evidencia** y se revocaron cuando la evidencia las contradijo. Tres de estas entradas son el mejor material del TFM — D18, D22 y M5 cayeron por medición, no por opinión.
>
> Lo más reciente, arriba. Formato fijo: **qué se creía · qué lo tumbó · qué se decidió · qué arrastró**.

---

## 2026-09-27 — Se parte la fuente de verdad y se congela este historial

**Qué se creía.** `Fuente-de-Verdad.md` concentraba todo: visión y alcance, hechos medidos sobre los PDF, decisiones técnicas, lo abierto, lo pendiente de ejecutar y el estado de cada pantalla. Cada decisión se escribía allí **o** aquí, y este historial recogía el porqué de lo derogado.

**Qué lo tumbó.**
- El fichero nació como embudo de ideas recogidas de varias fuentes, y se le pedían tres trabajos: alcance, backlog y decisiones. Con 200 líneas, un agente lo cargaba entero para cualquier tarea.
- La §7 (ejecución pendiente) y el estado de las pantallas duplicaban `roadmap.md`: lo mismo se revisaba en dos sitios.
- Con OpenSpec, la spec archivada de una capacidad es la verdad de esa capacidad, y el proposal de cada cambio ya guarda su porqué. Mantener también este historial era doble escritura.

**Qué se decidió.**
- Partir el documento por propósito: `producto.md` (visión, restricciones, fuera de alcance, pantallas), `decisiones.md` (decisiones técnicas vigentes y lo abierto) y `datos.md` (hechos de los PDF).
- `decisiones.md` adelgaza con el tiempo: cuando una capacidad tiene spec archivada, sus decisiones salen de allí.
- `roadmap.md` es el backlog y solo contiene lo decidido; sus ítems ✅ enlazan al cambio archivado de OpenSpec.
- Este historial se congela como material del capítulo de evolución del diseño de la memoria.

**Qué arrastró.** Enlaces actualizados en AGENTS.md, README, ADR-001, `openspec/config.yaml`, T2 y los documentos de `context/`. AGENTS.md pasa a enrutar la lectura por tipo de tarea.

---

## 2026-09-27 — ARQ-hexagonal: la Scope Rule entra, pero solo en la UI; TDD y herramientas de test

**Qué se creía.** El prompt con el que se arrancó el setup pedía dos cosas que no llegaron a los documentos:
- **Scope Rule** para todo `src/`: `features/X/` para el código de una feature, `shared/` para lo usado en varias, `context/` e `infrastructure/` globales.
- **TDD** con Vitest, Testing Library y Playwright.

Leída como vertical slices (cada feature con todas sus capas), la Scope Rule contradecía ADR-001, que los había descartado el 2026-09-19. TDD no figuraba en PROC-sdd ni en `openspec/config.yaml`.

**Qué lo tumbó.**
- El prompt venía de un ejemplo **solo de frontend**: su Scope Rule organiza componentes, no dominio. Y ADR-001 no decía dónde va la UI, así que la Scope Rule ocupa un hueco, no pisa una regla.
- Aplicada al backend, la propia Scope Rule se desmonta: `Menu`, `Recipe`, `ShoppingList` y `MenuRepository` los usan casi todas las pantallas, así que subirían a `shared/` y las features quedarían con un caso de uso cada una. Es un solo modelo, sin contextos separados.
- Página y feature no son lo mismo: el dashboard de `/` compone piezas del menú semanal y de la lista de la compra. Dividir la UI por rutas duplicaría esos componentes.

**Qué se decidió.**
- **Scope Rule solo en la UI:** `features/<feature>/` y `shared/ui/`. El backend sigue hexagonal por capas, agrupado por capacidad. `app/` queda como capa de entrada: es la única que toca el `web-container`, y las features reciben datos y acciones por props. Segunda enmienda de ADR-001 (§2, §3, §5).
- **PROC-tdd** en la fuente de verdad, y las herramientas concretas en OPS-calidad.

**Qué arrastró.**
- Reglas nuevas en ESLint para `features/` y `shared/ui/`.
- `openspec/config.yaml` exige el test antes de la implementación en `tasks` y la Scope Rule en `design`.
- La página de historial de selecciones queda como decisión de alcance pendiente: no está en la §8 de la fuente de verdad.

---

## 2026-09-27 — ADR-001 enmendado: la CLI es un segundo adaptador primario; el historial viaja

**Qué se creía.** Dos cosas.
- ADR-001 tenía un solo composition root (`composition/container.ts`) y a Next.js como único adaptador primario. La CLI de ingesta (ING-cli-local) existía como decisión, pero no tenía sitio en la estructura ni en las reglas de dependencia.
- La auditoría documental había dejado este historial en `tfm-brainstorm` como material de memoria, sin llevarlo al repo del producto.

**Qué lo tumbó.**
- El autor fijó la estructura de `src/` del repo nuevo: `cli/` junto a `app/`, y dos containers (`cli-container.ts` y `web-container.ts`). La tabla de reglas de ADR-001 §3, que es la que se traduce a ESLint, no decía qué podía importar `cli/`.
- La regla de la FdV ("lo derogado se cuenta en el historial") necesita un historial en el repo donde las decisiones van a seguir cambiando.

**Qué se decidió.**
- Enmendar ADR-001, en vez de escribir un ADR-002, porque aún no hay código que dependa de la versión anterior:
  - `cli/` tiene las mismas reglas que `app/`, cada uno con su container y sin cruzarse;
  - el container web se cachea de forma perezosa y el de la CLI se construye al arrancar.
- El historial viaja entero al repo del producto.

**Qué arrastró.**
- La entrada de la auditoría documental de más abajo dice que este historial "se queda aquí". Esa parte queda superada por esta entrada.
- Los enlaces de la FdV y de `enfoque-academico` al historial siguen valiendo.

---

## 2026-09-27 — EVAL-ground-truth: de etiquetar a mano a adjudicar discrepancias

**Qué se creía.** El ground truth de extracción se etiquetaba a mano y a ciegas **antes de ejecutar el extractor**: 5 menús (ampliable a 10) y 30 recetas, copiados del PDF al formato de T2.

**Qué lo tumbó.** Dos cosas.
1. La regla ya no se podía cumplir: los parsers de menú y recetas se habían ejecutado y su salida estaba en `data/`, así que "antes de ejecutar" era imposible. El roadmap lo recogía como contradicción, mientras la FdV afirmaba que no quedaba ninguna.
2. Al concretar el etiquetado salieron 4–6 horas de transcripción, casi todo en los ~240 ingredientes de las 30 recetas. El autor lo consideró desproporcionado.

Se valoraron tres salidas:
- recortar la muestra a 10 recetas (~1,5 h, cifra poco precisa);
- adjudicar las discrepancias entre parser y LLM (~1–1,5 h);
- quitar la evaluación de la extracción (0 h, pero cae el pilar 1 de PROC-enfoque).

**Qué se decidió.** Adjudicación ciega de discrepancias. Parser y extractor LLM extraen la muestra sorteada; donde coinciden, se da por bueno; donde discrepan, el autor decide mirando el PDF sin saber qué valor es de quién. El LLM recibe el PDF, no el texto del parser, para que sus errores sean independientes. Motivo del autor: es un máster de desarrollo con IA, y el método usa la IA para abaratar la evaluación sin dejar de medirla. El sorteo excluye lo que el autor ya haya revisado a mano, y así la muestra queda limpia aunque los parsers se ejecutaran antes.

**Qué arrastró.**
- El experimento parser vs. LLM (ING-determinista) pasa de anexo prescindible a pieza del método. Ya no se puede recortar por separado (roadmap).
- Limitación que se declara en la memoria: un error idéntico en los dos extractores no se ve.
- Nace T4 como primera tarea tras el setup del repo del producto, con cuatro piezas: sorteo (hecho, `sorteo-ground-truth.js`), extractor LLM, comparador y adjudicador.
- Sale de la lista de contradicciones del roadmap.

---

## 2026-09-27 — SEG-roles: desaparece el rol admin; la trazabilidad sale de la app

**Qué se creía.** Que la app tenía dos roles: registrado y admin. El admin, en solo lectura desde 2026-09-24, consultaba en `/admin/rag` el informe de trazabilidad de la ingesta y una consola de debug (`/admin/rag/explorer`). Quedaba abierto, a la espera del formato de entrega, si ese informe debía verse dentro de la app y si la cuenta de demo del tutor sería admin o registrado.

**Qué lo tumbó.** Se publicó el formato de entrega. El informe es estático y lo genera el CLI en local: se enseña igual de bien en la memoria y en el vídeo, sin ser una pantalla que construir, proteger y probar. La consola de debug la cubren mejor herramientas que ya están en el stack: la Developer UI de Genkit en local y Sentry en producción, que recibe las trazas de Genkit por OpenTelemetry. Sin esas dos pantallas, al admin no le quedaba nada que hacer.

**Qué se decidió.**
- Un solo rol: usuario registrado.
- Fuera `/admin/rag` y `/admin/rag/explorer`.
- Observabilidad con Sentry en producción y la Developer UI de Genkit en local (OPS-observabilidad, nueva). La exportación a Sentry se verifica en el spike T3.
- Las credenciales de la demo van en el formulario de entrega del máster.

**Qué arrastró.**
- Ya no hay endpoints de administración: menos superficie de ataque en A01, y un test negativo de autorización menos en CI ("registrado contra endpoint de admin").
- `User` pierde el campo `role` (ARQ-modelo-datos).
- La duda de si la demo sería admin desaparece.
- A cambio, el tribunal no ve la trazabilidad dentro de la app. Queda en la memoria y el vídeo.
- Abre una pregunta nueva (FdV §6.4): qué contenido de las trazas llega a Sentry. Por defecto van las entradas y salidas de cada paso, con texto de recetas, y eso sale a un tercero (SEG-datos-nutricionista).
- Cambian SEG-roles, ING-trazabilidad, SEG-sistema-cerrado, ARQ-modelo-datos, FdV §6–§8, safety-first, OWASP A01, ConceptosRAG §2.4, roadmap y AGENTS.

---

## 2026-09-24 → 2026-09-27 — Auditoría documental antes de mudarse al repo del producto

**Qué se creía.** Que la documentación estaba lista para llevarse al repositorio nuevo: la definición se había cerrado y solo faltaba copiar `context/`. Pero había crecido a ~38.000 palabras en 26 ficheros y el autor notaba verborrea y ficheros que hacían varias cosas a la vez.

**Qué lo tumbó.** Una auditoría con dos reglas: **una función por fichero** (normativa, spec, evidencia, historia, argumentación, operativa, archivo) y la **prueba por párrafo** (si lo borro, ¿se pierde algo que no esté en otro sitio?). Salieron diez hallazgos estructurales:
- Tres índices de documentos: README, AGENTS y FdV §9.
- La ejecución de T1 contada cuatro veces.
- Las reglas de trabajo en dos sitios, ya divergentes: AGENTS y `prompts/follow-up.md`.
- Referencias rotas a decisiones derogadas.
- Una contradicción interna en FdV §4: las recetas salían vía TXT o directamente del PDF según el párrafo.
- Google Drive citado en cinco ficheros vivos, cuando ya había salido del sistema.
- `ConceptosRAG-y-agentes.md` contradiciendo IA-criterio-agente: llamaba agente al explicador.
- SEG-roles diciendo que el admin corrige en la app, cuando FdV §8 decía que solo consulta.

Ninguno se veía leyendo un fichero suelto; todos aparecían al cruzarlos.

**Qué se decidió.**
- `AGENTS.md` es el único mapa de lectura.
- Un solo informe de T1 (`analisis-dataset.md`, de 1.939 a 595 palabras).
- Las reglas de trabajo, solo en `AGENTS.md`.
- `ConceptosRAG` reescrito con el descomponedor como único agente en producción.
- El admin, solo lectura (entrada de SEG-roles de 2026-09-24).
- Se mantienen `safety-first.md` y `OWASP-Top10.md`, con reparto explícito: reglas del proyecto frente a guía por categoría.
- En lo que viaja, la FdV guarda los **hechos de los datos** y las specs guardan **cómo se extraen**:
  - FdV §4.1 y §4.3 pierden el detalle de parsers y cifras que no deciden nada: la base de plato por día, que tampoco hacía falta para descartar el batch cooking (basta "no evaluable").
  - T2 §2.4 y §4.5 quedan como contrato.

**Qué arrastró.**
- Unas 3.200 palabras menos antes de pulir la prosa.
- Queda fijado qué viaja al repo nuevo: FdV, AGENTS, README, ADR, safety-first, OWASP, T2, T0 (como runbook de generación local), roadmap, ConceptosRAG y `enfoque-academico`.
- Se quedan aquí: este historial, `sesiones/`, T1, `analisis-dataset`, `analisis-output/`, `prompts/` y los wireframes. Este historial es materia prima de la memoria, no documentación del producto.
- La auditoría destapó tres decisiones que el autor cierra aparte:
  - el método del etiquetado ciego (EVAL-ground-truth);
  - la salida del informe de trazabilidad de la app, que se lleva el rol admin;
  - Sentry como observabilidad.

**Para la memoria (PROC-sdd-memoria).** Con SDD la documentación es la entrada de los agentes, así que su deuda se paga igual que la del código. Una contradicción entre dos ficheros normativos hace que el agente elija uno al azar. La auditoría la hizo un agente contra reglas explícitas y el autor decidió cada hallazgo: reparto de trabajo que el flujo SDD aplica también al código.

**Detalle rescatado de T2 §2.4 (parser del menú).** Antes de `pdf-parse`/`getTable()` se descartaron dos caminos:
1. El parser posicional sobre `pdftotext -layout` (`parse-menu.js`, de T1). Reconstruía columnas a partir de huecos de espacios en texto ya degradado y fallaba con las celdas de 2 platos.
2. Las coordenadas reales vía `pdftotext -bbox-layout`. Era viable: las etiquetas de fila y columna se localizan por texto, así que la altura variable de las filas entre PDFs no molesta. Pero añadía Poppler/WSL, una dependencia que `pdf-parse` no necesita.

---

## 2026-09-24 — SEG-sistema-cerrado: sin registro en la app

**Qué se creía.** Que el alta era por allowlist de correos: quien estuviera en la lista se registraba desde la app. Se defendía además como control visible ante el tribunal.

**Qué lo tumbó.** Dos cosas. (1) Una allowlist de correos sin verificar el correo no protege: cualquiera que conozca un correo de la lista se registra con él antes que su dueño. Verificarlo exige un servicio de envío de correos, más código y más superficie. (2) El tutor no va a registrarse: hay que entregarle usuario y contraseña. Se valoró Supabase Auth, que resuelve registro, allowlist (hook "Before User Created") y verificación, pero exige SMTP propio igualmente, pausa el proyecto tras 7 días sin actividad (también el login) y obliga a llevar los datos a Supabase, deshaciendo Neon.

**Qué se decidió.** Sin registro. Las cuentas (email y contraseña) las crea el CLI; el tutor recibe una cuenta de demo por canal privado. Se sigue en Neon.

**Qué arrastró.** Desaparecen formulario de alta, recuperación de contraseña y envío de correos. La seguridad visible ante el tribunal pasa de "hay registro con allowlist" a "no hay superficie de alta": login con límite de intentos y respuesta uniforme, contraseñas con hash de la librería y credenciales de demo fuera de cualquier documento público (safety-first §2.2 y §2.4).

---

## 2026-09-24 — ARQ-modelo-datos: Neon, no Supabase

**Qué se creía.** Que la BD sería PostgreSQL + pgvector "en Supabase o Neon", sin preferencia.

**Qué lo tumbó.** Al traducir a este stack una checklist de configuración segura salió que Supabase publica por defecto una API REST sobre las tablas del esquema `public`, con una llave pública; sin RLS, cualquiera leería las recetas del nutricionista sin pasar por la app (SEG-sistema-cerrado). Con eso se revisaron alternativas con una condición del autor: **gratis y para siempre**, porque la app se queda para uso personal tras el TFM.

- **MongoDB Atlas:** encaja con el menú como documento, pero el resto del modelo es relacional (recetas compartidas, ingrediente → grupo, historial) y no hace la BD menos pública: con Vercel sin IPs fijas, el endpoint queda abierto igual.
- **Render:** red privada real entre app y BD, pero la BD gratuita caduca a los 30 días y la web gratuita tarda ~1 min en despertar. Exige pagar y reabrir OPS-vercel.
- **Google Cloud:** Cloud SQL y AlloyDB son de pago; Firestore no tiene búsqueda de texto completo (rompe la parte léxica de EVAL-estrategia); Postgres en una VM e2-micro gratuita convierte al autor en administrador de sistemas.
- **Supabase gratis:** pausa el proyecto tras 7 días sin actividad y no tiene copias descargables. Su ventaja real, Supabase Auth, depende de la librería de autenticación, que sigue abierta.

**Qué se decidió.** Neon, plan gratuito: no caduca ni pausa el proyecto, no tiene API automática activa por defecto y da ramas de BD para las previews de Vercel. Se asume como riesgo residual que el endpoint de la BD es alcanzable desde internet; la barrera son TLS y credenciales (safety-first §2.3).

**Qué arrastró.** safety-first §2.3 deja de exigir "no expuesta a internet", que no se podía cumplir gratis. §2.4 fija la Data API de Neon sin activar, RLS como segunda barrera y una rama de Neon por preview.

---

## 2026-09-24 — SEG-roles: el admin ya no corrige en la app

**Qué se creía.** Que el admin revisa **y corrige** lo ingestado desde la app (SEG-roles, heredado de D16 tras derogar Drive).

**Qué lo tumbó.** La auditoría documental encontró la contradicción: SEG-roles pedía corregir en la app, y la fuente de verdad §8 ya dejaba `/admin/rag` como visor de solo lectura, con las correcciones en el JSON de `data/`. Pesaron tres cosas: (1) el CLI es idempotente por número de menú (ING-cli-local) y una corrección hecha en la BD se perdería en la siguiente reingesta; (2) con extracción determinista y 0 anomalías (ING-determinista) no hay casi nada que corregir; (3) EVAL-ground-truth ya exige guardar el JSON crudo y el corregido como ficheros, fuera de la app y a ciegas.

**Qué se decidió.** El admin **consulta**: informe de trazabilidad y consola de debug, en solo lectura. Las correcciones se hacen en el JSON de `data/` y se cargan con el CLI.

**Qué arrastró.** Desaparecen los endpoints de escritura de administración, así que hay menos superficie para A01 (control de acceso roto). `safety-first.md` y `OWASP-Top10.md` dejan de hablar de "corregir".

---

## 2026-09-24 — Las decisiones pasan de número a código

**Qué se creía.** Que un identificador numérico inmutable (`D1`…`D41`) bastaba para referirse a una decisión.

**Qué lo tumbó.** La lectura. Con 41 decisiones repartidas en cinco bloques, `D35` no dice nada sin abrir la tabla, y el autor tenía que hacerlo en cada referencia. El bloque "Datos e IA" había crecido hasta 18 decisiones de tres naturalezas distintas.

**Qué se decidió.** Cada decisión vigente recibe un código `ÁREA-tema` (ARQ, OPS, UI, ING, BUS, IA, EVAL, SEG, PROC). El código nombra el **tema, no el veredicto**: `ING-parser-menu` sigue siendo cierto aunque el parser pase de plan B a sistema, como ya le pasó. "Datos e IA" se parte en Ingesta, Buscador, IA transversal y Evaluación; el modelo de datos pasa a Arquitectura.

**Qué arrastró.** Se renombran todas las referencias de los ficheros vivos (fuente de verdad, roadmap, tareas, `AGENTS.md`, enfoque, ADR, prompts y scripts). **Este historial y `sesiones/` no se reescriben**: conservan `D<n>`, y esta tabla es la correspondencia. Las derogadas (D3, D8, D18) no reciben código: solo existen aquí.

| Antes | Ahora |
|---|---|
| D1 | `ARQ-app-desplegada` |
| D2 | `ARQ-nextjs` |
| D4 | `ING-menu-json` |
| D5 | `ING-lista-compra` |
| D6 | `BUS-vector-derivado` |
| D7 | `UI-flujo-semanal` |
| D9 | `EVAL-estrategia` |
| D10 | `OPS-vercel` |
| D11 | `OPS-ci-cd` |
| D12 | `SEG-owasp` |
| D13 | `OPS-calidad` |
| D14 | `PROC-sdd-memoria` |
| D15 | `UI-home-sin-login` |
| D16 | `SEG-roles` |
| D17 | `ING-sin-subida` |
| D19 | `ING-determinista` |
| D20 | `ING-temporada` |
| D21 | `EVAL-ground-truth` |
| D22 | `BUS-sin-despensa` |
| D23 | `UI-planner-buscador` |
| D24 | `IA-criterio-agente` |
| D25 | `ARQ-hexagonal` |
| D26 | `ING-recetas` |
| D27 | `UI-card-receta` |
| D28 | `BUS-unidad-plato` |
| D29 | `BUS-discrimina-plato` |
| D30 | `BUS-descomponedor` |
| D31 | `ING-lista-dato-primario` |
| D32 | `ING-cli-local` |
| D33 | `ING-trazabilidad` |
| D34 | `SEG-datos-nutricionista` |
| D35 | `ING-parser-menu` |
| D36 | `SEG-sistema-cerrado` |
| D37 | `PROC-enfoque` |
| D38 | `BUS-superficie-consulta` |
| D39 | `ARQ-modelo-datos` |
| D40 | `IA-proveedor` |
| D41 | `EVAL-golden-sets` |

---

## 2026-09-21 — Las recetas también son deterministas: D19 pierde su último LLM de ingesta

**Qué se creía.** Por la mañana, D19 había movido el agente extractor del menú a las recetas,
porque ahí quedaba un riesgo real sin medir: nombres de ingrediente partidos en dos líneas con los
dos puntos en la continuación, que un regex de una línea pierde en silencio. El spike T3 iba a
medir la tasa de parseo y, si superaba el 98 %, el agente pasaría a experimento.

**Qué lo tumbó.** Se midió antes del spike. Sobre el TXT de `pdftotext -layout`, el regex de una
línea pierde 567 de ~4.900 ingredientes (11,6 %), todos por ese caso. Pero el autor propuso probar
el camino del menú (`pdf-parse`) en las recetas: `getTable()` no vale (0 tablas: los recuadros son
decorativos), y en cambio el texto con coordenadas de `pdfjs-dist` muestra tres columnas fijas
(nombre x≈36, cantidad x≈171, preparación x≥300). Con la posición, la continuación del nombre no es
una heurística: está en la columna de nombre y no lleva guion. `parse-recetas-pdfjs.js` extrae las
639 recetas con 4.929/4.929 ingredientes, 639/639 tiempos y 0 anomalías estructurales
(`analisis-output/qa-recetas-pdfjs.md`). Ya no hay 98 % que medir.

**Qué arrastró.** D19 reescrita: la extracción es determinista en las tres patas y el agente es un
experimento de comparación para la memoria, no sistema. §6 pierde su punto 1. T2 cierra la pata 3
con el esquema de `recetas.json`. Desaparece la dependencia de `pdftotext` para menú y recetas.

**Hallazgo colateral.** 146 ficheros de receta se repiten entre menús y 105 de ellos con contenido
distinto (sal 5 g → 2 g, "180º" → "180ºC"): el nutricionista edita. D39 decía "433 distintas" como
si fueran idénticas; la spec de ingesta tiene que elegir versión (recomendación en T2 §4.5).

## 2026-09-21 — Siete veredictos de una sentada: se cierra todo lo que bloqueaba

**Qué pasaba.** Tras cerrar C9, quedaban seis puntos abiertos que llevaban días sin moverse (forma de D33 / C7, la contradicción del extractor, modelo de datos, proveedor, relajación, golden sets) y el autor avisó de que la definición sin código le estaba aburriendo. Se cambió el método: veredicto por punto, sí/no del autor, y a un spike.

**Qué se creía y qué lo tumbó, por punto.**

1. *Extractor.* D19 lo tenía sobre el menú y D35 llamaba "plan B" al parser determinista. T2 dio 0 anomalías en 36/36: un LLM ahí solo puede perder contra una regex. Se mueve a las recetas, que es donde el regex tiene riesgo conocido (nombres partidos, líneas que no casan). Si el spike mide ≥ 98 % de parseo, el agente queda como experimento y se cuenta como hallazgo.
2. *Forma de D33 y C7.* Se descartó la pantalla de corrección in situ (días de trabajo para un flujo que se ejecuta una vez) a favor del informe estático del CLI + correcciones en un JSON de `data/`. Genkit entra, pero tras un puerto en `infrastructure/`. C7 cerrada.
3. *Modelo de datos.* La unidad pasa a ser `Recipe` (433 distintas), no "plato": 138 platos se repiten entre semanas y se indexan una vez. `Selection` guarda historial, no solo la actual.
4. *Proveedor.* Gemini vía Genkit; `gemini-embedding-001` porque `text-embedding-004` es inglés. Juez de otra familia para que el tribunal no objete que el modelo se evalúa a sí mismo.
5. *Relajación.* Solo con `hard` y vacío; dos movimientos, dos vueltas. "Soltar la menos cubierta" salió: con todo blando por defecto no hace nada.
6. *Golden sets.* 50 + 40, a ciegas. Dos ablaciones.
7. *Temporada.* Se queda (D20): es lo que hace interesante "de verano".

**Qué arrastró.** D19, D30, D33 y D35 reescritas; D39, D40 y D41 nuevas; §6 se queda con seis puntos, ninguno bloqueante; §7 incorpora el spike T3 como paso previo a la spec de ingesta. La regla "todavía no se escribe código de la aplicación" sigue en pie para la app; el spike es código tirable fuera de ella.

## 2026-09-21 — D38 se ajusta: el criterio real es el historial, no el tiempo

**Qué se creía.** El ejemplo insignia de restricción de atributo era "cenas de menos de 25 minutos", heredado del diagrama externo y de la medición de tiempos de C9.

**Qué lo tumbó.** El autor: el tiempo de cocinado nunca le ha influido al elegir menú; lo que sí hace es **descartar los últimos N menús** para no repetir. Es un criterio que no sale del dataset sino del uso, y exige guardar el historial de selecciones por usuario (el modelo solo tenía la selección actual).

**Qué se decidió.** El atributo de historial entra en D38(d) como ejemplo principal; `totalTimeMin` sigue enriqueciéndose (gratis, determinista) pero deja de ser ejemplo. Se fija además cómo se refina: la petición acumula (texto nuevo → chips nuevos anexados), y el "demasiados resultados" se expresa como contador de empates en cabeza, no como estado.

**Qué arrastró.** `SelectionHistory` al modelo de datos (§6.2); dos casos nuevos al golden set (§6.8); la fila de `/planner` (§8).

## 2026-09-20 — Batch cooking: idea de una tarde, descartada por no evaluable

**Qué se propuso.** El autor quiere hacer batch cooking y los menús no lo contemplan. La idea: una herramienta que reordene los platos de la semana (y monte un plan de preparación del domingo) para cocinar por lotes, como parte del TFM, "aunque el buscador final sea más simple".

**Qué la tumbó.** Tres cosas, en orden de peso:

1. **No es evaluable.** Una semana reordenada no tiene ground truth: nada dice si sigue siendo nutricionalmente equivalente a la original. Y los atributos que el planificador necesitaría —cuántos días aguanta cada plato cocinado, qué partes se preparan antes, si recalienta bien— no existen en los datos; habría que inventarlos (LLM sobre `PREPARACIÓN`) o etiquetarlos a mano, sin nadie que valide.
2. **Los días no son intercambiables.** Medido sobre el nombre del plato de comida ([c9-superficie-consulta.md §6](analisis-output/c9-superficie-consulta.md)): lunes legumbre 75 %, martes pasta 72 %, miércoles pescado 67 %, jueves arroz 58 %, viernes carne 61 %, sábado cuscús/quinoa 78 %. Mover platos de día deshace un reparto que es diseño del nutricionista.
3. **Tamaño y momento.** Atributos nuevos + planificador con restricciones + plan generado y anclado + UI es un TFM entero, no "una parte", y llega sin spec cuando el núcleo (D37, D38) ya tiene números. "Buscador más simple" es la frase peligrosa: sin comparativa de recuperación por tipo el TFM deja de ser lo que D37 dice que es.

Se reconoció lo que tenía de bueno: sus comprobaciones estructurales (cobertura de platos, ingredientes existentes, caducidad respetada, tiempos) serían deterministas y más duras que un juez LLM, y el valor para el autor como usuario es alto. No es peor académicamente; es otro TFM.

**Qué se decidió.** Fuera del alcance en cualquier forma (§3 de la fuente de verdad). Va a la memoria como línea futura **con diseño esbozado** (los cuatro componentes de arriba y su evaluación), que ante un tribunal vale más que una feature a medias. Si algún día entra, actúa *sobre el menú elegido por el buscador*, nunca en su lugar.

**Qué arrastró.** Nada en las decisiones vigentes. El hallazgo del esqueleto semanal queda en §4.1 de la fuente de verdad y en el script de C9 como dato del dominio.

## 2026-09-20 — C9 → D38: la superficie de consulta, medida desde dos lados

**Qué se creía.** Tres preguntas abiertas desde el 2026-09-19: si "pollo y brócoli" era un plato o una semana; si "sin pescado" aplicaba a la semana o a los platos mostrados; y si hacía falta una capa de enriquecimiento con cinco atributos (tiempo, fuente de proteína, alérgenos, método de cocción, vegetariano). Alrededor, dos supuestos nunca comprobados: que "alitas de pollo" no aparecía en el dataset y era *el* caso que justificaba los embeddings, y —en un diagrama de pipeline traído de otra conversación— que los filtros duros (sin cerdo, todas las cenas ≤ 25 min) dejaban siempre un "Top 3".

**Qué lo tumbó.** Medir sobre `data/menu-platos.json` y las 589 recetas legibles (reproducible: `scripts/analisis/c9-superficie-consulta.js` → `analisis-output/c9-superficie-consulta.md`, con traza de cada tiempo al fichero de receta):

- **Ningún menú de los 36 está libre de pescado, huevo, legumbre o lácteo.** Solo 9 sin cerdo, 5 sin gluten. Toda exclusión global de esos grupos como filtro duro devuelve vacío. Todas las semanas tienen 4–6 fuentes de proteína: el nutricionista diseña semanas variadas y "una semana de X" no existe.
- **"Todas las cenas ≤ 25 min" deja 2/36.** La consulta de ejemplo del diagrama (salmón + garbanzos, sin cerdo, cenas ≤ 25) deja **1** menú con filtros duros; con puntuación blanda da un ranking útil de cinco. La explicación que el diagrama ponía en boca del LLM sobre el "Menú 4" era falsa en sus tres afirmaciones (no tiene salmón, sí tiene jamón, 3 cenas lentas): redactada sin mirar los datos, es la ilustración exacta de para qué existe el juez de faithfulness.
- **"Alitas de pollo al curry" está en 3 menús.** La búsqueda léxica sobre nombres de plato lo encuentra; el ejemplo estrella de `enfoque-academico.md` era falso. Y "salmón" como subcadena casa con "salmonete": la léxica ingenua da falsos positivos.
- `Total:` de TIEMPOS existe en el 100 % de las recetas (mediana 25 min, p90 55): atributo gratis. El método de cocción se lee del nombre en el 59 % de los platos. "Cerdo" literal no ve el jamón: hace falta tabla ingrediente → grupo.

**Qué se decidió.** **D38.** El autor respondió las tres preguntas: "y" separa restricciones (y "con" las une); la exclusión aplica a lo que la petición nombra ("arroz sin pescado"), y la global queda blanda por los datos; enriquecimiento reducido a tiempo, grupo alimentario por ingrediente y temporada — el método de cocción se resuelve por texto y similitud, y "vegetariano" se deriva del grupo. Se añade lo que las mediciones impusieron: todo blando por defecto con `hard` opt-in, ranking de los 36 siempre, cuatro tipos de restricción con mecanismo propio, `meal_filter` por comida/cena, sin chat multi-turno (chips editables), y el LLM nunca genera la consulta.

**Qué arrastró.** §6 pierde su primer punto y queda con C7 como única contradicción. La política de relajación (D30) tiene por fin candidatos medidos: `hard` → blando, literal → hiperónimo, soltar la restricción menos cubierta. La spec de ingesta solo sigue bloqueada por la forma de D33. El vector store queda justificado **únicamente** por el tipo "intención difusa / hiperónimo", y la comparativa por tipo (D9) decide si se queda. `enfoque-academico.md` §4 se reescribe con casos verificados. Aparece la necesidad de un golden set propio para el **descomponedor** (petición → estructura esperada), pendiente de confirmar. Y dos avisos de método para la memoria: **ningún ejemplo se afirma sin comprobarlo contra los datos**, y un diagrama que no se ha ejecutado contra el dataset es una hipótesis, no una arquitectura.

---

## 2026-09-20 — D8 derogada: fuera "Sorpréndeme"

**Qué se creía.** Que hacía falta una función **sin IA** —"Sorpréndeme", un menú aleatorio de los 36— como contraste frente a la selección semántica del buscador. Venía del brainstorm inicial (ResumenIdeas, README) y arrastraba un puerto propio en ADR-001 (`RandomPort`) para poder testearla de forma determinista.

**Qué lo tumbó.** Al revisar la tabla de decisiones por áreas. El primer motivo que se dio fue de seguridad: exponer las recetas a usuarios no registrados. No se sostiene: "Sorpréndeme" vivía en `/planner`, ruta de rol registrado (§8), y el sistema es cerrado por allowlist (D36); un menú aleatorio para un usuario autenticado no enseña nada que ese usuario no vea ya en `/menu`. El motivo real es de **alcance**: es una función de brainstorm sin peso académico (no está en ninguno de los cuatro pilares de D37), consume un puerto y sus tests, y el contraste "con IA / sin IA" ya lo da la comparativa léxica vs. semántica vs. híbrida del pilar (2), que es medible y esta no.

**Qué se decidió.** D8 se deroga. El único camino para elegir menú es el buscador de `/planner` (D23).

**Qué arrastró.** Desaparece `RandomPort` de ADR-001 §4 y "Sorpréndeme" de la fila `/planner` en §8. §3 (fuera de alcance) lo recoge. El bloque Frontend de §5 queda con D7, D15, D23 y D27.

---

## 2026-09-20 — C5 → D37: el enfoque estaba decidido desde hacía dos semanas

**Qué se creía.** Que C5 ("Enfoque del TFM y diseño del RAG") era una contradicción abierta. Llevaba así desde el 2026-09-18 y aparecía en cada recuento de lo pendiente.

**Qué lo tumbó.** Revisarla para decidir dónde colocarla al partir el documento: no tenía **ninguna pregunta sin responder**. Su punto (a) era análisis ya incorporado; su punto (b) eran tres aclaraciones, las tres convertidas en decisiones (D20, D22, golden dataset); su punto (c) recomendaba el enfoque de IA aplicada, que es exactamente lo que se llevaba ejecutando desde entonces. Estaba abierta solo porque **nadie la había cerrado formalmente**.

**Qué se decidió.** **D37:** hybrid retrieval + grounded generation, y los cuatro pilares del peso académico. La argumentación se va a `enfoque-academico.md`.

**Qué arrastró.** Las contradicciones abiertas pasan de tres a dos: **C9 y C7**. El estado real del proyecto era mejor de lo que el documento aparentaba. Aviso que va con el cierre: **C5 no era el riesgo de "demasiado simple"** — ese riesgo no se cierra aquí, se ha desplazado a C9 (si la superficie de consulta se queda en ingredientes literales, la comparativa del pilar (2) se vuelve corta) y a si el vector store acaba siendo decorativo.

---

## 2026-09-20 — Reorganización documental: tres ficheros

**Qué se creía.** Que la fuente de verdad debía contener también su propio historial: el 2026-09-19 se decidió tachar en vez de borrar, "porque el error de inferencia es en sí material para la memoria".

**Qué lo tumbó.** Medición del propio fichero: 353 líneas, ~50 000 caracteres, 23 líneas con tachones, 7 de 36 filas de decisión con texto tachado dentro, 20 marcas de "DEROGADA / Revisado / Matiz / Corregido", y las ocho secciones de contradicción en orden físico C1, C5, C8, C2, C6, C9, C10, C7 — ni numérico, ni cronológico, ni por estado. D25 estaba después de D36. El autor: *"se está convirtiendo en un monstruo con anexos/reanexos"*.

**Qué se decidió.** La decisión de no borrar **se mantiene**; lo que estaba mal era guardarlo dentro del documento normativo. Tres ficheros con lectores distintos: `Fuente-de-Verdad.md` (presente, sin tachones), este historial (append-only), `enfoque-academico.md` (la argumentación). Regla dura: una decisión se escribe en uno o en otro, **nunca en los dos**.

**Qué arrastró.** La fuente de verdad baja de 353 a 178 líneas. Los números D se mantienen como identificadores inmutables; agruparlos por bloques temáticos queda pendiente, en una pasada aparte para que el diff sea revisable.

---

## 2026-09-20 — D36: el sistema pasa a ser cerrado

**Qué se creía.** Que D34 podía afirmar *"no se redistribuyen: no forman parte del repositorio ni de ningún entregable público"* mientras se cargaba el texto de elaboración de ~640 recetas en la BD de una app desplegada.

**Qué lo tumbó.** Revisión del commit de D34: D15 no pide login en la landing, D16 define el rol "registrado", y **en ningún sitio estaba decidido quién puede registrarse**. Con registro abierto, cualquiera se da de alta y accede a las 640 recetas: eso es redistribución pública, y la cita de la memoria sería falsa. No era un problema de derechos, era un agujero de decisión.

**Qué se decidió.** **D36:** alta por allowlist de correos gestionada fuera de la app. Sin registro público.

**Qué arrastró.** D15 mantiene la home informativa pero **sin "crear cuenta"**. El *stretch goal* de usuario anónimo con "Sorpréndeme" de D16 queda **descartado, no aplazado**. Efecto lateral bueno: es un caso real de control de acceso por diseño (D12).

---

## 2026-09-20 — D22 pierde su segunda frase

**Qué se creía.** D22 (2026-09-18) decía: *"El matching por ingrediente opera sobre la lista asociada a cada menú"*. Estaba marcada ✅ cerrada.

**Qué lo tumbó.** T1: el matching sobre la semana agregada devuelve mediana de **15.5 menús de 36**, frente a **2/36** a nivel de plato (D28, D29). La frase prescribía el índice que la medición descartó. D22 se escribió antes de saber que existían las recetas.

**Qué se decidió.** Derogada esa frase. Sobrevive lo que nunca se midió ni se discutió: **el usuario no declara lo que tiene en casa**. Sobre qué índice se resuelve la consulta lo decide C9, que sigue abierta.

**Qué arrastró.** Quita el riesgo concreto de que un agente leyendo la tabla de decisiones implementara el buscador contra la lista de la compra semanal. Es el **mismo patrón que tumbó a D18**: una decisión tomada antes de mirar los datos, falsada después por medirlos.

---

## 2026-09-20 — C10 → D35: la extracción va sobre texto, no sobre imagen

**Qué se creía.** D19 (2026-09-18): se envía la **página renderizada** a un LLM multimodal, "no el texto plano", porque al extraer texto la tabla se aplana y las columnas se entremezclan. El parser por coordenadas quedaba como opcional, fuera del camino crítico.

**Qué lo tumbó.** Los TXT de `data/raw/` están hechos con `pdftotext -layout` y **sí conservan las columnas** por posición x. La premisa que motivó D19 no describía los datos: describía la extracción *sin* `-layout`. Y `pdftotext` es un binario nativo, así que cualquier vía que dependa de él es solo offline — compatible con D32, incompatible con extracción en runtime.

**Qué se decidió.** La vía imagen se descarta. Entrada del extractor: el TXT con `-layout`. Y opción (c) de las tres que había: **LLM como sistema, parser determinista como baseline y plan B** contra el mismo ground truth (D21). → **D35**.

**Qué arrastró.** D19 conserva el agente extractor y cambia solo la modalidad de entrada. La opción (a) —solo parser— se descartó porque se llevaba por delante uno de los dos agentes plenos que sostienen el catálogo de D24. Riesgo asumido y contado en la memoria: si el parser acierta 36/36, el agente queda como demostración académica redundante en producción.

---

## 2026-09-20 — D3 y D17 derogadas: Google Drive sale del sistema

**Qué se creía.** D3: los PDF se leen de Google Drive vía Service Account sobre carpeta compartida. D17: un único botón "Sincronizar" en la app dispara la ingesta.

**Qué lo tumbó.** Ninguna de las dos aporta nada a lo que se evalúa (extracción, recuperación, evals, SDD), y las dos consumen plazo: API de Google, credenciales, secretos en Vercel, un job. Además la ingesta depende de `pdftotext`, que es un binario nativo y no corre en Vercel.

**Qué se decidió.** **D32:** ingesta por CLI local. El comando recorre `data/raw/`, extrae a JSON y carga en la BD de producción desde la máquina del autor. La app desplegada solo conoce la BD. Un puerto `DocumentSource` con una única implementación local, sin dejar "hueco" reservado para Drive.

**Qué arrastró.** Google Drive pasa a **fuera de alcance** en cualquier forma. D16 cambia: el admin ya no importa nada, solo revisa y corrige. Aparece **D33** (trazabilidad de la ingesta), porque sin botón ni job la única forma de saber qué se cargó es mirarlo. Y resuelve por la vía buena la restricción operativa de `safety-first.md` de no compartir la carpeta ni pasar credenciales: deja de ser una limitación de las sesiones y pasa a ser la arquitectura.

---

## 2026-09-20 — Dos documentos llamados T1, y 12 categorías que eran 13

**Qué se creía.** Que la lista de la compra tenía 12 categorías (análisis manual de `Menu 1`, 2026-09-18). Y se había creado un runbook de Poppler llamado también `T1-`.

**Qué lo tumbó.** El parser de T1 (`parse-lista-compra.js`) define **13** categorías, y así lo recogen el resumen de ejecución y el propio runbook. Gana la medición sobre el análisis manual. Lo del nombre: con dos "T1", cualquier referencia a T1 en la memoria es ambigua — y el runbook es además **anterior** a T1.

**Qué se decidió.** 13 categorías en §4.2 y en la ficha de `/shopping-list`. El runbook pasa a `T0-extraccion-previa.md`. Regla: no puede haber dos documentos con el mismo número.

---

## 2026-09-19 — Los menús son de lunes a sábado por diseño

**Qué se creía.** Que el domingo vacío de `Menu 1` podía ser un hueco de extracción o una particularidad de ese menú.

**Qué lo tumbó.** Confirmación del autor para los 36: el domingo se deja libre a propósito, como día de descanso, y así lo genera la herramienta del nutricionista.

**Qué se decidió.** Es una **regla del dominio**, no un dato que falte.

**Qué arrastró.** (a) La regla "6 días" del validador de D19 pasa de heurística a **normativa**: un menú con domingo relleno es un error de extracción que el agente debe rechazar. (b) Cuadra la aritmética que no encajaba: 12 slots por semana + las cenas de 2 platos de los menús ≥17 explican los 17.5 slots por menú medidos. (c) La UI no pinta 7 días.

---

## 2026-09-19 — D31: la lista de la compra no se recalcula

**Qué se creía.** Que la lista de la compra semanal y la suma de los ingredientes de las recetas de esa semana *"son dos fuentes independientes que deberían cuadrar"*, y que su desajuste medía la calidad de la extracción. Estaba escrito así en la fuente de verdad y en el resumen de T1.

**Qué lo tumbó.** El autor: la lista incluye la compra de desayunos, meriendas y relleno fijo, que **no son platos con receta**. No cuadran ni deben cuadrar.

**Qué se decidió.** **D31:** la lista es dato primario y nunca se deriva de los platos. La única relación esperable es *ingredientes de las recetas ⊆ lista de la compra*, en un solo sentido, y con ruido por variantes de nombre: es un *nice to have*, no una métrica limpia.

---

## 2026-09-19 — C8 → D24 + D30: el catálogo de agentes adelgaza y luego crece

**Qué se creía.** Cuatro agentes con roles distintos: extractor, descomponedor, explicador y juez de evaluación.

**Qué lo tumbó.** Aplicar la definición propia (`ConceptosRAG-y-agentes.md` §2.1: bucle + decisión + condición de parada). El **juez** es una llamada única con schema ejecutada en batch: es el patrón LLM-as-judge, no un agente. El **explicador** genera una vez y su control de calidad es externo (faithfulness). Llamarlos agentes contradice la propia definición y es un flanco innecesario en la defensa. Después, T1: el filtro a nivel de plato genera consultas con 0 resultados, así que el **descomponedor** deja de ser una llamada única y pasa a decidir qué restricción relajar en bucle.

**Qué se decidió.** **D24** (criterio y catálogo) + **D30** (el descomponedor es agente pleno). Foto final: **dos agentes plenos**, el resto documentado como pipeline.

**Qué arrastró.** Es más defendible enseñar dos agentes plenos y saber argumentar por qué los demás no lo son, que enseñar cuatro de los que dos no aguantan la definición propia.

---

## 2026-09-19 — D29: M5 medía la unidad equivocada

**Qué se creía.** Riesgo abierto desde C1: que los 36 menús, siendo del mismo profesional y el mismo hogar, no fueran distinguibles por lo que el usuario fuese a pedir — el ranking devolvería siempre lo mismo y la explicación sonaría a relleno.

**Qué lo tumbó.** T1 midió y el riesgo resultó **real pero mal localizado**: no era del dataset, era de la unidad de búsqueda. Una consulta proteína+verdura devuelve mediana de 15.5 menús de 36 filtrando por semana agregada, y **2 de 36** filtrando por plato.

**Qué se decidió.** **D29.** El workflow y el prompt del explicador se quedan en *por qué encaja*; no hay que invertirlos a *en qué se diferencia*.

**Qué arrastró.** El hallazgo metodológico más citable del TFM: **el mismo corpus discrimina o no según la unidad de indexación elegida**. M5, tal como se especificó en T1, medía la unidad equivocada; el resultado cambió al corregir la unidad de medida, no los datos. Esto salió de medir **antes** de diseñar.

---

## 2026-09-19 — C2 → D28: la unidad de indexación es el plato

**Qué se creía.** "Platos + ingredientes, por menú": la semana como bolsa agregada.

**Qué lo tumbó.** La misma medición de D29, y el descubrimiento de que cada plato tiene su receta con ingredientes propios (D26).

**Qué se decidió.** **D28:** la unidad es el plato con los ingredientes de su receta. No la semana, no el documento, no chunks. La lista de la compra no se indexa: alimenta la checklist (D5).

---

## 2026-09-19 — D18 derogada: las recetas sí existen

**Qué se creía.** **D18 (2026-09-18): "Recetas fuera del alcance. No existen en los datos; la historia 'ver receta' se elimina."** Y, en consecuencia, que no había relación ingrediente ↔ plato: solo se sabía que "este menú lleva salmón en algún sitio".

**Qué lo tumbó.** La premisa era falsa. El análisis original se hizo sobre `Menu 1` y **se infirió de ahí la estructura del Drive completo**. Al ejecutar T1 aparecieron **~620 PDF de receta**, uno por plato, en las mismas carpetas, con sus ingredientes estructurados en el mismo formato que la lista de la compra.

**Qué se decidió.** **D26** (el hecho: las recetas entran en el dataset, parser determinista, cobertura 621/629) y **D27** (el alcance: fuente de datos + card desplegable en `/menu`, sin pantalla propia ni escalado de raciones ni cálculo nutricional).

**Qué arrastró.** Prácticamente todo lo demás: hace posible D28, D29 y el buscador entero. **Es el error más instructivo del proyecto** y por eso está aquí y no borrado: una decisión de alcance tomada por inferencia sobre una muestra de uno, que costó una semana de diseño mal orientado.

---

## 2026-09-19 — C6 → D25: hexagonal, y verificable

**Qué se creía.** README decía vertical slices; el Estado del arte decía monolito modular + Clean Architecture. Se había valorado que eran compatibles.

**Qué se decidió.** **D25:** hexagonal (puertos y adaptadores), con App Router como adaptadores primarios. Se descartan los vertical slices. Regla añadida por el autor: **no se adopta norma de arquitectura que no se pueda verificar automáticamente** — las reglas de dependencia las comprueba ESLint en pre-commit y CI. Detalle en ADR-001.

---

## 2026-09-19 — C1 → D23: buscador, no planificador generativo

**Qué se creía.** El wireframe del Planificador (Frontend-Architecture §2.2) mostraba un bot que compone menús día a día: "pasta exprés el martes", "menos hidratos", "añadir invitados".

**Qué lo tumbó.** El generativo por días rompe la relación 1:1 menú ↔ lista de la compra (D5/D7), exige recetas con cantidades y es el mayor riesgo de plazo. Con los datos reales, el de selección es el único viable.

**Qué se decidió.** **D23:** `/planner` es un buscador de menús con explicación. El usuario elige uno de los 36.

**Qué arrastró.** Invalidó el wireframe de `/planner`, y con él buena parte del material de brainstorm de `context/`.

---

## 2026-08-27 → 2026-09-18 — De la idea a la fuente de verdad (entrada retroactiva)

> Escrita el 2026-09-21 a partir del `git log` y de la sesión del 18. Es la única entrada del
> historial que no se redactó el día que ocurrió: el registro sistemático de decisiones empieza
> el 19. Va aquí para que el arranque del proyecto no dependa de la memoria del autor.

**Qué se creía (27 de agosto).** El repo nace con tres ficheros: `README.md` (checklist de
pasos: MVP, reglas para agentes, pirámide de testing, CI/CD), `ResumenIdeas.md` (la idea en
212 líneas) y `context/Requirements.md` (cuatro líneas). La idea ya tenía lo que hoy sigue en
pie: 36 semanas con menú y lista de la compra en PDF, **la IA extrae y recupera, no genera**,
"¿qué menú de los que tengo encaja mejor con lo que busco?", el JSON como fuente de verdad y el
vector store como índice derivado, y el ciclo semanal menú actual → lista actual → nueva semana.
También tenía lo que después cayó: el menú se parsea "mediante IA", el RAG se alimenta **solo de
los menús** (las listas no entran), usuario anónimo con menú de ejemplo, "Sorpréndeme" como
contraste sin IA, y un "valor del TFM" enumerado en diez capacidades genéricas ("crear
embeddings", "implementar un RAG"). La misma semana entra `OWASP-Top10.md`.

**16 de septiembre.** Tres semanas sin commits y después `Frontend-Architecture.md` con seis
pantallas y un visor de wireframes interactivo. La pantalla `/planner` es un **planificador
conversacional por días** ("pasta exprés el martes", "menos hidratos") y `/admin/rag` un gestor
documental con pipeline de chunking. Ninguna de las dos había pasado por los datos reales; se
diseñó la interfaz antes de saber qué se podía recuperar. Ese mismo día aparece el `.gitignore`
para los atajos de Google Drive: los PDF se leían desde una carpeta sincronizada.

**18 de septiembre: la constitución.** En una sesión se crean `CLAUDE.MD`, `Fuente-de-Verdad.md`
(con D1–D22 y las contradicciones C1–C8), `safety-first.md`, `ConceptosRAG-y-agentes.md`,
`Seguir.md` y el prompt de continuación. `ResumenIdeas.md` y `Requirements.md` se fusionan en la
fuente de verdad y desaparecen. Lo que quedó cerrado ese día y **sigue** cerrado: Next.js +
TypeScript (D2), JSON como fuente de verdad (D4), lista de la compra determinista en BD (D5),
índice derivado (D6), ciclo semanal (D7), golden dataset + LLM-as-judge (D9), Vercel y GitHub
Actions (D10, D11), seguridad por diseño (D12), la memoria documenta el proceso con IA (D14),
roles registrado + admin sin premium (D16). Lo que quedó cerrado ese día y **cayó** después, todo
por medición: Drive vía Service Account (D3, D17 → D32), "Sorpréndeme" (D8), **recetas fuera
porque "no existen en los datos"** (D18, cayó al día siguiente: existían 639), extracción del
menú con LLM multimodal y agente validador (D19, dos veces reescrita hasta ser determinista), y
la segunda frase de D22, que prescribía el índice semanal que T1 descartó. D20 (temporada) sigue
en pie, pero hoy la calcula el CLI de ingesta desde las recetas (D38c), no el LLM en la extracción.

**Qué lo tumbó (visto desde hoy).** El 18 se decidió sobre un solo menú abierto a mano (`Menu 1`)
y sobre wireframes. El 19 empezó T1 sobre los 36 y a partir de ahí cada entrada de este historial
es una medición contradiciendo una creencia del 18. El patrón que se repite: **lo que se
diseñó antes de mirar los datos duró menos de 72 horas**; lo que se decidió sobre restricciones
del dominio (stack, roles, ciclo semanal, seguridad) no se ha tocado.

**Qué arrastró.** Es el argumento de la memoria sobre método: la fase de definición no fue
"escribir requisitos" sino **medir el corpus antes de diseñar**, y el historial existe porque
hubo que revocar en tres días la mitad de lo cerrado en uno. Los wireframes del 16 y el
planificador conversacional son el contraejemplo documentado.

---

## Índice de contradicciones históricas

| # | Título | Estado |
|---|---|---|
| C1 | ¿RAG de selección o planificador generativo? | ✅ → D23 |
| C2 | Qué se indexa | ✅ → D28 |
| C3 | Roles de usuario | ✅ → D16 |
| C4 | Forma de la ingesta | ✅ → D17, luego D32 |
| C5 | Enfoque del TFM y diseño del RAG | ✅ → D37 (+ [enfoque-academico.md](enfoque-academico.md)) |
| C6 | Arquitectura interna | ✅ → D25 / ADR-001 |
| C7 | Evaluación / debug: ¿Genkit o consola propia? | ✅ → D33 (forma) + D40: Genkit tras un puerto, informe estático para lo determinista |
| C8 | Catálogo de agentes | ✅ → D24 + D30 |
| C9 | Superficie de consulta | ✅ → D38 |
| C10 | Extracción: ¿imagen o texto con layout? | ✅ → D35 |
