# T0 — Generación local de los datos

> **Tipo:** Runbook.
> **Objetivo:** generar en local, desde los PDF del nutricionista, los JSON que consume el resto del proyecto. Todo ocurre en `data/`, que está gitignoreado (SEG-datos-nutricionista): ni los PDF ni los JSON se suben al repo.
> **Contrato de los JSON:** [T2](T2-esquema-json-ingesta.md).

---

## 1. Qué sale de aquí

| Paso | Entrada | Herramienta | Salida |
|---|---|---|---|
| 1 | `Lista_de_la_compra.pdf` | `pdftotext -layout` (Poppler) | `Lista_de_la_compra.pdf.txt`, junto al PDF |
| 2 | `menu.pdf` | `parse-menu-pdftable.js` | `data/menu-platos.json` (T2 §2) |
| 3 | un PDF por receta | `parse-recetas-pdfjs.js` | `data/recetas.json` (T2 §4) |
| 4 | `Lista_de_la_compra.pdf.txt` | `parse-lista-compra.js` | CSV de ítems (T2 §3, pendiente de documentar) |

Menú y recetas se leen **directamente del PDF**. Solo la lista de la compra pasa por TXT, y por eso es la única que necesita Poppler.

Cada script escribe además una QA agregada (recuentos, sin el dataset) en `data/qa/`, para revisión manual.

## 2. Requisitos

- Los PDF en `data/raw/Dieta/Menu 1` … `Menu 36`, cada carpeta con `menu.pdf`, `Lista_de_la_compra.pdf` y un PDF por receta. Los `valoracion-*.pdf` se ignoran.
- Node y `pnpm install` (dependencia: `pdf-parse`, que trae `pdfjs-dist`).
- Poppler (`pdftotext`), solo para el paso 1.
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
pnpm datos:menu      # → data/menu-platos.json
pnpm datos:recetas   # → data/recetas.json
pnpm datos:lista     # → data/qa/lista-compra-items.csv
```

Los tres son idempotentes: se pueden relanzar y sobrescriben su salida. Las garantías esperadas de cada uno (recuentos, anomalías) están en T2 §2.5 y §4.4.

## 5. Regenerar desde cero

Si cambian los PDF:

```bash
find data/raw -name "*.pdf.txt" -delete
```

y se repiten los pasos 1–4.
