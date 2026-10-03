# T0 — Generación local de los datos

> **Tipo:** Runbook.
> **Objetivo:** cargar en la BD de Neon, desde los PDF del nutricionista, los menús y las recetas, y generar en local los JSON que consumen los scripts de evaluación. Los ficheros viven en `data/`, que está gitignoreado (SEG-datos-nutricionista): ni los PDF ni los JSON se suben al repo.
> **Contrato de los JSON:** [T2](T2-esquema-json-ingesta.md).

---

## 1. Qué sale de aquí

| Paso | Entrada | Herramienta | Salida |
|---|---|---|---|
| 1 | `Lista_de_la_compra.pdf` | `pdftotext -layout` (Poppler) | `Lista_de_la_compra.pdf.txt`, junto al PDF |
| 2 | un PDF por receta | `pnpm ingest recipes` (CLI de `src/`) | `data/recetas.json` (T2 §4) y la BD |
| 3 | `menu.pdf` | `pnpm ingest menu` (CLI de `src/`) | `data/menu-platos.json` (T2 §2) y la BD |
| 4 | `Lista_de_la_compra.pdf.txt` | `parse-lista-compra.js` | CSV de ítems (T2 §3, pendiente de documentar) |

Las recetas van **antes** que el menú, porque cada plato de la BD apunta a su receta (MF-41). Menú y recetas se leen **directamente del PDF**. Solo la lista de la compra pasa por TXT, y por eso es la única que necesita Poppler.

Cada paso escribe además una QA en `data/qa/`, para revisión manual. La del menú lista uno a uno, también en consola, los platos con `*` sin receta resuelta.

## 2. Requisitos

- Los PDF en `data/raw/Dieta/Menu 1` … `Menu 36`, cada carpeta con `menu.pdf`, `Lista_de_la_compra.pdf` y un PDF por receta. Los `valoracion-*.pdf` se ignoran.
- Node y `pnpm install` (dependencias: `pdf-parse` para el menú y `pdfjs-dist` para las recetas; pnpm no deja usar una dependencia que no esté declarada en `package.json`).
- Poppler (`pdftotext`), solo para el paso 1.
- `.env.local` (gitignoreado) con `DATABASE_URL_UNPOOLED` (la conexión directa de Neon), para los pasos 2 y 3, y `GEMINI_API_KEY` (nivel de pago, IA-proveedor), para los embeddings. Opcional: `DATABASE_URL_TEST`, la conexión directa de una rama de Neon solo para pruebas (nunca `production`), con la que `pnpm test:run` ejecuta también los tests de integración de Postgres; sin ella se saltan. Vitest solo lee esa variable de `.env.local`.
- `data/marca.json`, creado a mano y nunca versionado, con los patrones del pie de la lista de la compra (eslogan y marca). Así el parser los descarta sin que el texto del nutricionista aparezca en el código (SEG-datos-nutricionista):

  ```json
  { "footerPatterns": ["^<inicio del eslogan>"] }
  ```

  Son expresiones regulares sin barras, que se aplican sin distinguir mayúsculas. Si falta el fichero, el pie no se filtra y aparece como aviso en la QA. Las recetas no lo necesitan, porque su pie se descarta por posición.

### Poppler en Windows

Con WSL (Ubuntu / Debian):

```bash
sudo apt update && sudo apt install -y poppler-utils
pdftotext -v
```

O nativo en Windows: `winget install --id osdn.poppler` o `choco install poppler`.

## 3. Paso 1 — Lista de la compra a TXT

`-layout` es imprescindible: conserva los huecos entre columnas, que es lo que el parser usa para leer la lista (dos columnas, 13 categorías). Los scripts esperan la extensión concatenada **`.pdf.txt`**, no `.txt`.

Desde la raíz del repo, en WSL o Linux:

```bash
find data/raw -name "Lista_de_la_compra.pdf" -exec pdftotext -layout {} {}.txt \;
```

Desde PowerShell con Poppler nativo:

```powershell
Get-ChildItem -Path "data/raw" -Filter "Lista_de_la_compra.pdf" -Recurse | ForEach-Object {
    pdftotext -layout $_.FullName "$($_.FullName).txt"
}
```

Comprobación: deben salir 36 ficheros.

```bash
find data/raw -name "Lista_de_la_compra.pdf.txt" | wc -l
head -n 25 "data/raw/Dieta/Menu 1/Lista_de_la_compra.pdf.txt"
```

## 4. Pasos 2–4 — Parsers

```bash
pnpm ingest migrate # → aplica las migraciones pendientes de postgres/migrations a la BD
pnpm ingest recipes # → data/recetas.json y la BD (sale con 1 si alguna receta falla)
pnpm ingest menu    # → data/menu-platos.json y la BD (sale con 1 si algún menú falla)
pnpm ingest embed   # → embeddings de las recetas en la BD; solo calcula los nuevos o cambiados
pnpm datos:lista    # → data/qa/lista-compra-items.csv
```

Todos son idempotentes: se pueden relanzar. Los JSON se sobrescriben enteros; en la BD, cada receta o menú recibido sustituye a su versión anterior y no se borra lo que no llega (ING-cli-local). Las garantías esperadas de cada uno (recuentos, anomalías) están en T2 §2.5 y §4.4.

## 5. Regenerar desde cero

Si cambian los PDF:

```bash
find data/raw -name "*.pdf.txt" -delete
```

y se repiten los pasos 1–4.

## 6. Golden set de recuperación (MF-12)

Necesita `data/menu-platos.json` y `data/recetas.json` (pasos 2 y 3).

```bash
pnpm evals:golden-set            # → evals/retrieval/golden-set.json (se commitea) y data/golden/golden-set-report.md
```

Lee las entradas versionadas de `evals/retrieval/`: `queries.json`, `dish-labels.json` e `ingredient-groups.json`. También lee la revisión de las literales, `data/golden/literal-candidates.md`, que es local porque dice qué platos tiene cada menú. Si falta algo, lista todos los errores y no escribe nada. Con las mismas entradas, la salida es idéntica byte a byte.

La revisión de las literales solo se vuelve a generar si cambian las consultas literales. El script nunca sobrescribe una revisión existente, así que primero hay que apartar la anterior:

```bash
pnpm evals:literal-candidates    # → data/golden/literal-candidates.md, para marcar ✅/❌ a mano
```
