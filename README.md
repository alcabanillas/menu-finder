# menu-finder

Buscador en lenguaje natural sobre 36 menús semanales, con planificación semanal y lista de la compra interactiva.  - Trabajo Fin de Máster (TFM) del Máster en Desarrollo con Inteligencia Artificial.

---

## Tabla de contenidos

1. [Idea general del proyecto](#1-idea-general-del-proyecto)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Instalación y ejecución](#3-instalación-y-ejecución)
4. [Estructuración](#4-estructuración)
5. [Funcionalidades principales](#5-funcionalidades-principales)
6. [Despliegue](#6-despliegue)
7. [Entregables](#7-entregables)
8. [Protección de datos](#8-protección-de-datos)

---

## 1. Idea general del proyecto

**menu-finder** nace de un problema doméstico. Durante una dieta, un nutricionista me entregó 36 menús semanales en PDF, cada uno con sus recetas y su lista de la compra. Nos gustaron y los adoptamos como menús rotativos pero usarlos cada semana tenía dos limitaciones:

1. **Buscar era manual.** Saber qué semana encajaba con una petición como *"pollo y verduras, pero nada de pescado el martes"* obligaba a abrir los PDF uno a uno, sin poder buscar por plato ni por ingrediente.
2. **La compra se copiaba a mano.** Los ingredientes se pasaban del PDF a otra herramienta para tenerlos como lista de tareas.

El proyecto cubre el ciclo completo en tres partes:

- **Ingesta:** extrae de los PDF los menús, las recetas y la lista de la compra, los guarda en PostgreSQL, clasifica los ingredientes en grupos alimentarios y calcula los embeddings de las recetas.
- **Buscador:** traduce la petición en lenguaje natural a restricciones y puntúa los 36 menús con ellas.
- **Aplicación web:** muestra los resultados con su explicación, permite planificar las semanas y gestionar una lista de la compra activa.

### Qué hace la IA y qué no

El catálogo es cerrado y lo elaboró un profesional, así que la IA no genera menús ni recetas. Su papel es entender la petición del usuario y ayudar a recuperar lo que ya existe:

- Un LLM descompone la petición en un esquema tipado de restricciones: platos o ingredientes que deben aparecer, exclusiones globales o por día y preferencias difusas.
- Otro uso del LLM, en la ingesta, clasifica los ingredientes en grupos alimentarios.
- La explicación de cada resultado no la redacta el LLM: se compone con una plantilla a partir de los platos y los días que cumplen cada restricción.

### El reto técnico: varias restricciones a la vez

Una petición suele combinar condiciones (*"alitas de pollo y salmón"*). Comparar el embedding de la frase entera con un vector por menú favorece a los menús que cumplen muy bien una condición aunque ignoren la otra. Por eso:

- **Se indexan platos y recetas, no menús enteros.** Un plato aparece en pocos menús y distingue mucho mejor entre ellos que una semana completa.
- **La recuperación es híbrida:** búsqueda léxica en PostgreSQL, similitud semántica con pgvector y coincidencia por grupo alimentario.
- **La agregación es determinista:** un algoritmo puntúa cada menú y descarta los que incumplen una restricción obligatoria.

---

## 2. Stack tecnológico

### Aplicación
- **Framework:** [Next.js 16](https://nextjs.org/) (App Router) con React 19 y TypeScript.
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) con tokens de diseño propios.
- **Autenticación:** [Better Auth](https://www.better-auth.com/), con sesiones en base de datos y cookies `HttpOnly`.

### Datos e IA
- **Base de datos:** [Neon](https://neon.tech/) (PostgreSQL serverless) con la extensión `pgvector`.
- **Orquestación de IA:** [Genkit](https://genkit.dev/) para TypeScript.
- **Modelos de Gemini:**
  - `gemini-3.8-flash`: descompone la petición en restricciones, con salida estructurada validada con [Zod](https://zod.dev/), y clasifica los ingredientes.
  - `gemini-embedding-2`: embeddings de 3072 dimensiones para las recetas.

### Calidad
- **Tests:** [Vitest](https://vitest.dev/) con Testing Library en jsdom, para unitarios y componentes, y [Playwright](https://playwright.dev/) para E2E.
- **Cobertura:** `@vitest/coverage-v8`, con un umbral del 100 % en `src/domain` y `src/application`, y del 80 % en `src/features`, `src/shared/ui` y `src/cli`.
- **Análisis estático:** ESLint con `eslint-plugin-boundaries` e `import/no-cycle` para verificar las reglas de la arquitectura, más `eslint-plugin-sonarjs`; `knip` para el código muerto; `tsc --noEmit` para los tipos.

### Infraestructura
- **Hosting:** [Vercel](https://vercel.com/).
- **Errores:** [Sentry](https://sentry.io/), en cliente y servidor, sin datos personales.
- **CI:** GitHub Actions, con escaneo de vulnerabilidades con [OSV-Scanner](https://google.github.io/osv-scanner/).
- **Dependencias:** [Dependabot](https://docs.github.com/code-security/dependabot) revisa cada semana los paquetes npm y las GitHub Actions. Agrupa las actualizaciones menores y de parche, y espera 7 días antes de proponer una versión nueva, porque las versiones maliciosas suelen retirarse en ese plazo. Las actualizaciones de seguridad no esperan.

---

## 3. Instalación y ejecución

### Requisitos
- Node.js 24 (la versión de la CI) y pnpm 10.
- Una base de datos PostgreSQL con `pgvector`; el proyecto usa [Neon](https://neon.tech/).
- Una clave de la API de Gemini.
- Los PDF originales en `data/raw/`. No están en el repositorio (ver [Protección de datos](#8-protección-de-datos)).

### 1. Clonar e instalar

```bash
git clone https://github.com/alcabanillas/menu-finder.git
cd menu-finder
pnpm install
```

### 2. Variables de entorno

Crea `.env.local` en la raíz con estas variables:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión de la app a Neon (con pooling) |
| `DATABASE_URL_UNPOOLED` | Conexión directa, la que usan los comandos `pnpm ingest …` |
| `DATABASE_URL_TEST` | Opcional: rama de Neon solo para tests. Sin ella se saltan los tests de integración con Postgres |
| `GEMINI_API_KEY` | API de Gemini |
| `BETTER_AUTH_SECRET` | Secreto aleatorio de 32 caracteres como mínimo |
| `BETTER_AUTH_URL` | URL de la app, por ejemplo `http://localhost:3000` |
| `SENTRY_DSN` | DSN del proyecto de Sentry, adonde el servidor y el navegador envían los errores no capturados. Sin ella, Sentry no arranca, la app funciona igual pero sin enviar errores |

### 3. Base de datos e ingesta

Los comandos se ejecutan en este orden. El detalle de cada paso está en `context/tareas/T0-extraccion-previa.md`.

```bash
pnpm ingest migrate            # aplica las migraciones de postgres/migrations
pnpm ingest recipes            # recetas → data/recetas.json y la BD
pnpm ingest menu               # menús → data/menu-platos.json y la BD
pnpm ingest shopping-list      # lista de la compra → la BD
pnpm ingest ingredient-groups  # clasifica los ingredientes en grupos alimentarios
pnpm ingest embed              # embeddings de las recetas (solo los nuevos o cambiados)
```

### 4. Crear una cuenta

No hay registro público: las cuentas se crean desde la CLI. El comando pide la contraseña sin mostrarla; no se pasa como argumento.

```bash
pnpm ingest account usuario@ejemplo.com "Nombre"
```

### 5. Arrancar la app

```bash
pnpm dev
```

La app queda en [http://localhost:3000](http://localhost:3000).

### Tests y calidad

El proyecto sigue TDD: el test de cada escenario se escribe primero y se ve fallar.

```bash
pnpm test:run        # tests unitarios y de componentes
pnpm test:coverage   # los mismos, con los umbrales de cobertura de la CI
pnpm test:e2e        # tests E2E con Playwright
pnpm typecheck       # tipos
pnpm lint            # ESLint (incluidas las reglas de arquitectura) y knip
```

### Evaluación de la IA

Las partes con IA se miden contra golden sets en `evals/`:

```bash
pnpm ingest evaluate-search      # compara las estrategias léxica, semántica e híbrida
pnpm ingest evaluate-decomposer  # mide la descomposición de peticiones
```

---

## 4. Estructuración

El backend sigue una arquitectura hexagonal con un solo hexágono y dos adaptadores primarios: la web (`src/app/`) y la CLI (`src/cli/`). La interfaz sigue la Scope Rule. La norma completa está en [ADR-001: Arquitectura interna](context/adr/ADR-001-arquitectura-interna.md).

```text
menu-finder/
├── src/
│   ├── domain/            # Reglas de negocio en TypeScript puro
│   │   ├── menu/          # Menús semanales y platos
│   │   ├── recipe/        # Recetas
│   │   ├── search/        # Restricciones, puntuación y texto para embeddings
│   │   ├── selection/     # Planificación de semanas
│   │   ├── shopping/      # Lista de la compra
│   │   └── evaluation/    # Métricas de los golden sets
│   ├── application/
│   │   ├── ports/         # Interfaces hacia el exterior (repositorios, embeddings, reloj…)
│   │   ├── use-cases/     # Casos de uso
│   │   ├── services/
│   │   └── dto/
│   ├── infrastructure/    # Adaptadores: postgres, genkit, auth, sentry, logging…
│   ├── composition/       # Ensamblado de dependencias para la web y para la CLI
│   ├── app/               # Adaptador web: rutas y Server Components de Next.js
│   ├── cli/               # Adaptador CLI: migración, ingesta, cuentas y evaluación
│   ├── features/          # Componentes de cada pantalla (Scope Rule)
│   └── shared/            # Utilidades y componentes comunes (shared/ui)
├── postgres/migrations/   # Migraciones SQL
├── e2e/                   # Tests de Playwright
├── evals/                 # Golden sets y resultados de evaluación
├── openspec/              # Specs y cambios (SDD con OpenSpec)
├── scripts/               # Scripts de evaluación, diseño, roadmap y release
└── context/               # Decisiones, ADR y roadmap
```

### Reglas de dependencia

ESLint las comprueba en el pre-push y en la CI:

1. `domain` no depende de ninguna otra capa ni de librerías externas.
2. `application` depende solo de `domain` y define los puertos.
3. `infrastructure` implementa los puertos y es la única capa que conoce Neon, Genkit o Sentry.
4. `app` y `cli` llegan a los casos de uso a través de `composition/`.
5. Cada carpeta de `features/` expone solo su componente principal; el resto es privado.

### Cómo encaja Next.js

- **Server Components y Server Actions como adaptador web.** Las páginas de `app/` son Server Components: comprueban la sesión, llaman a los casos de uso a través de `web-container.ts` y pasan el resultado a la interfaz. Lo que el usuario dispara desde la interfaz (buscar, elegir el menú de una semana, marcar artículos de la compra, entrar y salir) son Server Actions, que también pasan por un caso de uso. Ninguno de los dos llega a repositorios, a la base de datos ni al SDK del LLM.
- **Contenedor y presentación.** Solo `app/` toca el contenedor. Los componentes de `features/` reciben los datos y las Server Actions por props y se limitan a pintar, así que se prueban con Testing Library sin servidor ni base de datos, y la autorización no se puede saltar desde la interfaz.
- **Adaptadores finos.** Las páginas, las acciones y los comandos de la CLI parsean, autentican, llaman a un caso de uso y traducen su `Result`. La lógica de negocio queda en `domain` y `application`.

---

## 5. Funcionalidades principales

- **Búsqueda en lenguaje natural:** acepta varias restricciones a la vez, exclusiones de ingredientes (en toda la semana o en un día) y preferencias difusas como "algo rápido". Muestra las restricciones que ha entendido y ofrece peticiones de ejemplo.
- **Explicación de cada resultado:** cada menú muestra qué plato cumple cada parte de la petición y en qué día.
- **Planificador semanal:** asigna menús a semanas concretas, a partir de la búsqueda o al azar. Antes de elegir se puede ver la semana completa, y la app pregunta antes de sustituir un menú ya planificado. Cada día muestra sus comidas y cenas, con la receta de cada plato.
- **"Qué toca hoy":** el menú del día y del siguiente, con los domingos libres, un aviso si falta planificar y lo que queda de la lista de la compra.
- **Lista de la compra:** se deriva de las semanas planificadas, se ordena por categoría con un índice para saltar entre ellas, permite ver todo o solo lo que falta por comprar, y guarda por usuario lo que ya se ha comprado.
- **Sistema cerrado:** sin registro público; solo entran usuarios con cuenta creada desde la CLI.

---

## 6. Despliegue

- **App:** Vercel, en la región de Frankfurt (`fra1`), con el runtime de Node.js.
- **Base de datos:** Neon en `eu-central-1`, la misma zona que la app.
- **Errores:** Sentry, sin datos personales.

La app desplegada está en [https://menu-finder-mbs.vercel.app](https://menu-finder-mbs.vercel.app). Como el sistema es cerrado, las credenciales de prueba se entregan aparte, en el formulario de entrega del máster. El proceso de publicación está en `context/despliegue.md`.

---

## 7. Entregables

- **Repositorio:** [https://github.com/alcabanillas/menu-finder](https://github.com/alcabanillas/menu-finder)
- **Presentación:** *pendiente*
- **Vídeo:** *pendiente*. Muestra el producto funcionando, la arquitectura del código y los resultados de la evaluación de la IA.

---

## 8. Protección de datos

Los PDF originales y los JSON generados a partir de ellos viven en `data/`, que nunca se sube al repositorio. Nada que identifique al autor de los menús llega al código, a la base de datos ni a Sentry. Los tests usan datos ficticios.
