# ADR-001 — Arquitectura interna: hexagonal sobre Next.js

- **Estado:** aceptada (2026-09-19); **enmendada 2026-09-27**: la CLI pasa a ser un segundo adaptador primario, con su propio composition root (§2, §3, §5); la §2 solo fija lo decidido y la §4 incluye `RateLimiter`. **Segunda enmienda 2026-09-27**: la UI se organiza con la Scope Rule (`features/` y `shared/ui/`) y `app/` queda como capa de entrada (§2, §3, §5). **Tercera enmienda 2026-09-27**: el parseo que depende de la maquetación del documento de origen va en su adaptador, no en el dominio; el ejemplo de la §4 pasa a ser el parser del menú (MF-11). **Cuarta enmienda 2026-09-27**: la §4 añade `RecipeRepository`, que faltaba: `MenuDish` apunta a `recipeId`, así que las recetas se persisten igual que el menú y la lista. **Quinta enmienda 2026-10-01**: la §2 precisa que "capacidad" es un concepto del dominio, y dos reglas para agentes (reutilizar un puerto antes de crear otro; nombrar por concepto del dominio) pasan a `AGENTS.md`, tras el rediseño de MF-41
- **Decisión en [decisiones.md](../decisiones.md):** ARQ-hexagonal
- **Audiencia:** este documento es **entrada directa de los agentes** que generen código (SDD). Las reglas de la §3 son normativas y verificables en CI.
- **Punto único:** la estructura de `src/` y sus reglas solo se describen aquí, salvo dos reglas obligatorias para agentes que viven en `AGENTS.md`: reutilizar un puerto antes de crear otro y nombrar por concepto del dominio. `AGENTS.md` remite a este documento para lo demás; no lo copia.

## 1. Contexto

Arquitectura **hexagonal** (puertos y adaptadores), siguiendo la estructura mínima enseñada en el máster, con Next.js App Router como capa de adaptadores primarios.

Se descartan los vertical slices. Razones: alineación con el marco teórico del máster (quien evalúa reconoce el patrón), reglas de dependencia **verificables automáticamente** —algo que importa más de lo habitual porque el código lo generan agentes—, y aislamiento natural del dominio respecto de Next.js, que es la dependencia más volátil del proyecto.

## 2. Estructura

```
src/
  domain/            # entidades, value objects, reglas puras. CERO dependencias externas
  application/
    use-cases/       # un caso de uso = una operación del sistema
    ports/           # interfaces de lo que el dominio necesita del exterior
    dto/             # formas de entrada/salida de los casos de uso
  infrastructure/    # implementaciones de los ports (BD, ficheros, LLM, embeddings)
  composition/       # composition roots: única capa que conoce implementaciones concretas
    web-container.ts # para app/
    cli-container.ts # para cli/
  cli/               # CLI = ADAPTADOR PRIMARIO: ingesta, alta de cuentas, evaluación
    commands/
    index.ts
  app/               # Next.js App Router = ADAPTADOR PRIMARIO, no una capa más. SOLO entrada
    <ruta>/page.tsx  # pide datos al caso de uso y los pasa por props
    <ruta>/actions.ts  # server actions de esa ruta
    api/**/route.ts
  features/          # UI organizada con la Scope Rule: UI pura, sin backend
    <feature>/
      components/
      hooks/
  shared/
    result.ts        # Result<T, E> compartido, sin dependencias
    ui/              # componentes y hooks usados por 2+ features
```

**La UI sigue la Scope Rule.** Un componente o hook vive en la feature que lo usa (`features/<feature>/`) hasta que lo necesita una segunda; entonces, y no antes, sube a `shared/ui/`. Las features se nombran por lo que pintan, no por la ruta: una página compone varias features (el dashboard de `/` pinta piezas de `weekly-menu` y `shopping-list`). Features iniciales, de las pantallas previstas ([producto.md §4](../producto.md)): `auth`, `dashboard`, `menu-search`, `weekly-menu`, `shopping-list`.

**Por qué features en la UI y capas en el resto.** Se divide por feature donde las piezas son independientes y por capa donde comparten el modelo. Cada pantalla pinta cosas distintas; el backend, en cambio, es un único modelo (`Menu`, `Recipe`, `ShoppingList`) que usan casi todas las pantallas. Aplicarle la Scope Rule subiría casi todo el dominio y los puertos a `shared/`, dejando las features con un caso de uso cada una.

Las subcarpetas de `domain/` e `infrastructure/` no se fijan de antemano: las crea la spec que las necesite, agrupando por capacidad (`domain/search/`, `infrastructure/llm/`). "Capacidad" es aquí un concepto del dominio (menú, receta, búsqueda), no el nombre de un cambio o una capability de OpenSpec; la regla de nombres para agentes está en `AGENTS.md`.

Fuera de `src/` está `scripts/datos/`: los scripts de generación local de datos (runbook T0). No forman parte del hexágono y se sustituyen por la CLI de ingesta (ING-cli-local).

Hay **dos adaptadores primarios sobre el mismo hexágono**: la web (`app/`) y la CLI (`cli/`). La CLI hace lo que la app no debe hacer (ING-cli-local, SEG-sistema-cerrado): ingesta desde `data/`, alta de cuentas y evaluación. Cada uno tiene su composition root porque necesitan dependencias distintas; por ejemplo, solo la CLI conoce `DocumentSource` y el rol de administración de la BD (safety-first §2.4).

**Tres desviaciones respecto de la estructura mínima del máster**, todas por Next.js y todas justificables en la presentación:

1. **La web no tiene `main.ts`.** Next.js no tiene un punto de entrada único: cada route handler es una entrada. Su composition root pasa de "se ejecuta al arrancar" a "módulo que construye y cachea las dependencias la primera vez que se importa" (ver §5). La CLI sí tiene punto de entrada (`cli/index.ts`) y su container se construye al arrancar, como en la estructura del máster.
2. **`src/app/` y `src/cli/` conviven con las capas.** No son capas: son adaptadores primarios (HTTP y línea de comandos). `app/` se llama así porque Next.js lo exige, no por decisión de diseño.
3. **Un solo hexágono, sin módulos.** Con ~6 entidades no se justifican contextos separados. Si `use-cases/` pasa de ~15 ficheros, se subdivide **por capacidad dentro de cada capa** (`use-cases/search/`, `use-cases/ingest/`); **nunca** se crea un segundo hexágono.

## 3. Reglas de dependencia (normativas)

| Capa | Puede importar | No puede importar |
|---|---|---|
| `domain` | `domain`, `shared` (salvo `shared/ui`) | todo lo demás, **incluidas librerías de terceros** |
| `application` | `domain`, `shared` | `infrastructure`, `composition`, `app`, `cli`, Next.js |
| `infrastructure` | `application` (ports, dto), `domain`, `shared`, librerías externas | `composition`, `app`, `cli` |
| `composition` | todas | — |
| `app` (Next.js) | `composition/web-container`, `application` (dto y tipos de caso de uso), `features`, `shared` | **`domain` e `infrastructure` directamente**; `composition/cli-container`; `cli` |
| `features` | `application` (dto), `shared` (incluido `shared/ui`), la propia feature | **otras features**; `domain`, `infrastructure`, `composition`, `app`, `cli` |
| `shared/ui` | `shared`, `application` (dto) | `features`, `domain`, `infrastructure`, `composition`, `app`, `cli` |
| `cli` | `composition/cli-container`, `application` (dto y tipos de caso de uso), `shared` | **`domain` e `infrastructure` directamente**; `composition/web-container`; `app` |

**Estas reglas se validan con ESLint (`import/no-restricted-paths` o `eslint-plugin-boundaries`) y se ejecutan en el hook de pre-commit (OPS-calidad) y en CI (OPS-ci-cd).** Una regla de arquitectura que no comprueba una herramienta acaba incumpliéndose sin que nadie lo note, sobre todo si el código lo generan agentes. Regla derivada: **no se adopta ninguna norma de arquitectura que no se pueda verificar automáticamente** — se queda en recomendación, no en norma.

## 4. Qué merece un puerto y qué no

El mayor riesgo de plazo de esta decisión es el boilerplate: entidad + port + caso de uso + DTO + adaptador + wiring + route handler son 7 ficheros para "dame el menú actual". Los agentes los generan en segundos; tú los revisas en minutos, y ahí se va el tiempo. Regla para acotarlo:

**Hay puerto solo donde hay una frontera externa real:**

`MenuRepository`, `RecipeRepository`, `ShoppingListRepository`, `DocumentSource` (sistema de ficheros local, ING-cli-local), un puerto para los flujos LLM (descomponedor y explicador; Genkit queda detrás, ING-trazabilidad), `EmbeddingsPort`, `VectorSearchPort`, `ClockPort`, `RateLimiter` (SEG-rate-limit).

**No hay puerto para lógica interna.** Un servicio de dominio es una función, no una interfaz con una única implementación.

**El parseo de documentos se divide por lo que cambia con el origen.** Lo que cambiaría si el mismo contenido llegara con otra maquetación (otra forma de tabla, una hoja de cálculo con un plato por fila) es del **adaptador de ese origen**. Lo que vale para cualquier origen es del **dominio**. El puerto devuelve estructuras independientes del origen, no tablas ni texto crudo.

Ejemplo que fija el criterio — **el parser del menú (MF-11)**: leer el PDF (`pdf-parse`), localizar las filas Comida/Cena y separar los platos apilados en una celda es maquetación del PDF y vive en su adaptador (`infrastructure/local-documents/pdf/`); `DocumentSource` devuelve el menú como comidas con platos y su marca de receta. El relleno que no es plato, la resolución de recetas y la construcción del `WeeklyMenu` son **funciones puras de dominio, sin puerto**. Las dos mitades se testean con strings, sin PDFs ni BD, que es lo que pide el plan de testing. La pureza de las funciones de maquetación es convención (en `infrastructure` ESLint permite librerías): se mantienen sin E/S, separadas del código que lee ficheros.

## 5. Decisiones específicas de Next.js

- **El composition root de la web (`web-container.ts`) es un módulo con caché perezosa**, no un objeto creado al arrancar. En desarrollo, el hot-reload reinstancia módulos: las conexiones y clientes se cachean en `globalThis` para no multiplicarlos. El de la CLI (`cli-container.ts`) se construye al arrancar el comando y se cierra al terminar.
- **En Vercel (OPS-vercel) no hay proceso de larga vida**: el contenedor puede recrearse en cada invocación. El acceso a BD usa el **pooler** de Neon; prohibido asumir un pool de conexiones persistente.
- **Los route handlers y los comandos de la CLI son adaptadores finos**: parsear, autenticar y autorizar (la web), llamar a un caso de uso, mapear `Result` a HTTP o a código de salida. Cero lógica de negocio. Si un handler o un comando pasa de ~30 líneas, la lógica está en el sitio equivocado.
- **Server Components y Server Actions son la trampa del patrón**: pueden importar cualquier cosa y hacerlo parecerá natural. Norma: **un Server Component solo puede invocar casos de uso a través del composition root**, nunca repositorios, clientes de BD o SDK del LLM. Toda escritura pasa por un caso de uso. Esto además es lo que exige `safety-first.md` P5 (las decisiones viven en el backend).
- **Solo `app/` toca el `web-container`.** Las features reciben los datos (DTO) y las server actions por props, y se limitan a pintar. Así se testean con Testing Library sin servidor ni BD, y la sesión y la autorización no se pueden saltar desde la UI.
- **Errores:** `domain` y `application` devuelven `Result<T, E>`; los adaptadores de infraestructura pueden lanzar, y su propio adaptador captura y convierte a `Result` en la frontera. No se propagan excepciones de librerías hacia dentro.

## 6. Consecuencias

**A favor:** el dominio se testea sin BD, sin red y sin Next.js (adaptadores en memoria), lo que sostiene la base de la pirámide de testing (OPS-calidad); el proveedor de LLM y el de BD, ya elegidos (IA-proveedor, ARQ-modelo-datos), siguen siendo sustituibles porque están detrás de puertos —relevante para el vector store, que sale si la comparativa por tipo no lo justifica—; y las reglas son legibles por un agente.

**En contra:** más ficheros por funcionalidad y más tiempo de revisión. Riesgo real de plazo, mitigado por la [§4](#4-qué-merece-un-puerto-y-qué-no).

**Revisar si:** la [§4](#4-qué-merece-un-puerto-y-qué-no) se incumple y aparecen puertos con una sola implementación que nunca se sustituye, o si `use-cases/` supera los 15 ficheros (entonces se aplica la subdivisión de la [§2, punto 3](#2-estructura)).
