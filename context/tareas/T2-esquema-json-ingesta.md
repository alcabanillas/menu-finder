# T2 — Esquema JSON de ingesta (menú · lista de la compra · recetas)

> **Tipo:** Spec / contrato de datos.
> **Objetivo:** Documentar la forma del JSON que cada uno de los tres "patas" de una semana
> (menú, lista de la compra, listado de recetas) entrega a la app, tal y como sale del
> parser correspondiente. Es la spec de la que habla PROC-sdd-memoria (SDD): existe antes de tocar el
> modelo de datos de BD, y BD se construye leyendo esto, no al revés.
> **Relación con [decisiones.md](../decisiones.md):** documenta ING-menu-json ("El menú se extrae a JSON
> estructurado (día → comida/cena → platos). Ese JSON es la fuente de verdad de la app")
> y es la primera pieza de la **spec de ingesta** que el [roadmap](../roadmap.md) da como pendiente (ING-cli-local+ING-parser-menu+ING-trazabilidad).
> **Estado:** 2/3 patas cerradas (menú, recetas). Lista de la compra: pendiente.

---

## 1. Contexto: las tres patas de una semana

Cada una de las 36 semanas del dataset se compone de tres documentos PDF independientes
por parte del nutricionista, que hoy se ingestan con tres parsers distintos:

| Pata | PDF origen | Parser | Estado |
|---|---|---|---|
| 1. Menú | `menu.pdf` | `pnpm ingest menu` (`src/`, MF-11) | ✅ Cerrado (este documento) |
| 2. Lista de la compra | `Lista_de_la_compra.pdf` | `scripts/datos/parse-lista-compra.js` | ⏳ Pendiente de revisión/documentar |
| 3. Listado de recetas | un PDF por receta (639) | `scripts/datos/parse-recetas-pdfjs.js` | ✅ Cerrado (§4) |

Las tres alimentan el mismo modelo de datos de BD (ARQ-modelo-datos), pero **cada JSON es independiente y se
valida por separado** antes de cruzarlos — el cruce (p. ej. "los ingredientes de una
receta deberían estar contenidos en la lista de la compra de esa semana", ING-lista-dato-primario) es
validación cruzada *a posteriori*, no parte del contrato de cada pata.

---

## 2. Pata 1 — Menú (`menu-platos.json`)

### 2.1 Origen

- **Comando:** `pnpm ingest menu`, la CLI del hexágono (`src/cli/`, ADR-001). La spec de la
  capacidad es `menu-ingestion` (cambio MF-11).
- **Entrada:** `data/raw/Dieta/Menu <n>/menu.pdf` (directo, sin paso intermedio por TXT —
  usa `pdf-parse`/`getTable()` para reconstruir la tabla real del PDF, no una
  reconstrucción heurística de un dump de texto. Ver §2.4 para por qué se descartó ese
  camino). Los candidatos a receta son los `.pdf` de la carpeta del menú.
- **Salida:** `data/menu-platos.json` (un array con los 36 menús). **Gitignoreado** (SEG-datos-nutricionista):
  contiene nombres de plato reales, así que no se sube al repo público. Lo escribe
  `JsonFileMenuRepository`, un adaptador temporal: en MF-16 se sustituye por la carga en BD.
  El comando escribe además la QA en `data/qa/` (`menu-platos-pdftable.csv`, un plato por
  fila con su score, y `qa-menu-platos-pdftable.md`, el resumen): **no forma parte del
  contrato**, es para revisión manual.

### 2.2 Forma

```
WeeklyMenu[]        // en orden de número de menú
```

El fichero es la entidad de dominio serializada tal cual (`src/domain/menu/weekly-menu.ts`):

```ts
type WeeklyMenu = {
  number: number;            // número de menú, 1..36, el de la carpeta `Menu <n>`
  meals: Meal[];             // siempre 14: lunes..domingo × comida/cena, por día y comida antes que cena
};

type Meal = {
  day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  type: "lunch" | "dinner";  // lunch = fila Comida, dinner = fila Cena
  dishes: MenuDish[];
};

type MenuDish = {
  position: number;          // orden dentro de la celda, desde 1
  name: string;              // nombre del plato, texto extraído del PDF
  hasRecipeMark: boolean;    // el PDF lo marca con "*" (ver §2.3)
  recipeFile: string | null; // nombre de fichero (sin extensión) de la receta resuelta, o null
};
```

Solo se procesan las filas **Comida** y **Cena** de la tabla del PDF (Desayuno, Almuerzo
y Merienda quedan fuera de alcance: no son platos, [datos.md §1](../datos.md) — la app no muestra esas filas). Domingo llega
siempre con `dishes: []` en sus dos comidas: el nutricionista no rellena esa columna en ninguno
de los 36 PDFs (verificado, es esperado, no un fallo de extracción).

### 2.3 Semántica de cada campo

- **`name`** — texto tal cual sale de la celda de la tabla. Una celda puede traer 2+ platos
  apilados en líneas distintas sin separador explícito; el separador de celdas
  (`src/infrastructure/menu-ingestion/pdf/split-cell.ts`) los separa por dos señales: una
  línea que termina en `*` cierra un plato, y una línea que empieza por mayúscula (mientras
  la anterior no termina en preposición o artículo — de/con/al/en/y/la/el/...) señala el
  inicio de un plato nuevo. El relleno genérico sin `*` (una pieza de fruta, un yogur o
  kéfir sin azúcar) no es un plato y se descarta (`src/domain/menu-ingestion/filler.ts`).
- **`position`** — orden del plato en su celda, contado después de descartar el relleno.
- **`hasRecipeMark`** — dato **literal del PDF**, no inferido: el nutricionista
  marca con un asterisco los platos que llevan receta propia (el propio PDF lo explicita:
  *"(\*) vienen acompañadas de una receta"*). No se fuerza ningún match contra ficheros
  cuando es `false` — hacerlo solo produce ruido (coincidencias parciales accidentales
  contra la receta de *otro* plato de la misma carpeta; confirmado en revisión manual).
- **`recipeFile`** — **no viene del PDF**: es el resultado de comparar el nombre del plato
  con los nombres de fichero de receta de la carpeta de ese menú
  (`data/raw/Dieta/Menu <n>/*.pdf`, excluyendo `menu`, `Lista_de_la_compra`, `valoracion*`
  y las dos recetas de desayuno conocidas). Solo se calcula si `hasRecipeMark` es `true`.
  El score es *containment*: fracción de las palabras del plato (normalizadas, sin
  tildes, >2 letras) que también aparecen en el nombre del fichero candidato — no
  Jaccard, porque el nombre extraído suele ser más corto que el título completo de la
  receta. Se acepta el mejor candidato solo si su score es **1** (`MATCH_THRESHOLD`: todas
  las palabras del plato están en el nombre del fichero); si no, `recipeFile` queda en
  `null` aunque `hasRecipeMark` sea `true` (caso "receta esperada no encontrada": o falta
  el PDF en `data/raw/`, o el nombre de fichero no coincide con el del PDF — no es una
  garantía, es una pista para revisar).

Cuando `hasRecipeMark` es `false`, `recipeFile` es siempre `null` por construcción (no se
intenta el match).

**El score no está en el dataset.** Solo aparece en la QA: el CSV da `match_receta` y
`score_match` para los platos resueltos, y `discarded_candidate` y `discarded_score` para
los platos con `*` sin resolver. Estos se listan además uno a uno en la consola.

### 2.4 Por qué `pdf-parse`

`getTable()` lee la tabla real del PDF (filas y columnas) en Node puro, sin TXT intermedio
ni dependencias externas. Descartados: el parser posicional sobre `pdftotext -layout`
(`parse-menu.js`, frágil con celdas de 2 platos) y `pdftotext -bbox-layout` (viable, pero
exige Poppler/WSL).

### 2.5 Validación / garantías actuales

Ejecutado sobre los 36 menús (`pnpm ingest menu`, 2026-09-27), con el mismo resultado plato
a plato que el script anterior (comparación de paridad de MF-11):

- 36/36 menús procesados sin error.
- 504 comidas (día × comida/cena); 72 vacías, todas en domingo (esperado, 2 por menú).
- 176 comidas con 2+ platos, todas separadas correctamente.
- 608 platos: 591 con `hasRecipeMark: true`, todos resueltos con score 1.
- 0 platos con `hasRecipeMark: true` sin fichero de receta encontrado.
- 17 platos con `hasRecipeMark: false` (correctamente no matcheados).
- 34 ficheros de receta no reclamados por ningún plato — revisados: son recetas de
  Desayuno (fuera de alcance de este parser, que solo procesa Comida/Cena).

Esta validación es sobre la **estructura** (¿se separan bien los platos de cada celda?,
¿se resuelve bien el fichero de receta?), no sobre el **contenido** semántico de cada
plato contra un ground truth etiquetado a mano — eso sigue pendiente (EVAL-ground-truth).

### 2.6 Limitaciones conocidas / fuera de alcance de esta pata

- No incluye el **texto ni los ingredientes** de la receta — solo el nombre de fichero
  que la identifica. Eso es la pata 3 (§4).
- No incluye Desayuno, Almuerzo ni Merienda (no son platos, [datos.md §1](../datos.md)).
- El campo `recipeFile` es un nombre de fichero, no un id estable de BD — el mapeo
  fichero → id de receta se resolverá al cargar la pata 3.
- `data/menu-platos.json` se reescribe entero en cada ejecución: un menú que falle
  desaparece del fichero. La carga en BD (MF-16) debe ser un upsert por menú.

---

## 3. Pata 2 — Lista de la compra

*Pendiente. Existe `scripts/datos/parse-lista-compra.js` de la fase T1, sin
documentar aquí todavía ni revisado contra el mismo criterio de calidad que la pata 1.*

## 4. Pata 3 — Listado de recetas (`recetas.json`)

### 4.1 Origen

`scripts/datos/parse-recetas-pdfjs.js` lee cada `data/raw/Dieta/Menu N/<plato>.pdf`
(todo PDF de la carpeta salvo `menu`, `Lista_de_la_compra` y `valoracion-*`) con
`pdfjs-dist` — la librería que `pdf-parse` lleva debajo — y trabaja sobre el **texto con
coordenadas**, no sobre el TXT de `pdftotext -layout`. Ya no hace falta el TXT: dos recetas
que nunca se convirtieron (637 TXT frente a 639 PDF) entran igual.

`getTable()` (lo que resolvió el menú) **no** sirve aquí: devuelve 0 tablas. Los recuadros
verdes del PDF son rectángulos decorativos, no una rejilla de celdas. Pero la página tiene
una geometría fija que hace innecesaria cualquier heurística de texto:

| Zona | Posición (puntos, origen abajo-izquierda) |
|---|---|
| Título (y subtítulo) | `y > 700` |
| Etiqueta de tiempo / nombre de ingrediente | `x ≈ 36` |
| Valor de tiempo / cantidad | `x ≈ 171` (umbral `x ≥ 150`) |
| Preparación | `x ≥ 300` (umbral `x ≥ 290`) |
| Pie de página (eslogan, generador) | `y < 40` — se descarta (SEG-datos-nutricionista) |

El caso que preocupaba en T1 — nombre de ingrediente partido en dos líneas con los dos
puntos en la continuación (`- Aceite de oliva virgen` / `extra:`) — se resuelve solo:
la continuación está en la columna de nombre y no empieza por guion, luego pertenece al
ingrediente anterior. Ocurre en 570 de los 4.929 ingredientes.

### 4.2 Forma

```
RecetaJson[]        // una entrada por fichero PDF, 639 en total
```

```ts
type RecetaJson = {
  menu: string;                 // "1".."36": carpeta de la que sale este PDF
  fichero: string;              // nombre de fichero sin extensión; casa con `recipeFile` de la pata 1
  titulo: string;               // título + subtítulo del PDF, en una línea ("Alcachofas rellenas de huevo y gambas")
  tiempos: {                    // minutos enteros; null si la casilla está vacía
    total: number | null;
    elaboracion: number | null;
    coccion: number | null;
    espera: number | null;      // "Espera/reposo"
  };
  ingredientes: Ingrediente[];  // en el orden del PDF
  preparacion: string[];        // un párrafo por elemento, en el orden del PDF; [] si no hay
  anomalias: number;            // cuántas anomalías registró el parser en este fichero (0 = limpio)
};

type Ingrediente = {
  nombre: string;               // sin el guion ni los dos puntos ("Aceite de oliva virgen extra")
  cantidadTexto: string | null; // la medida casera, tal cual ("1 cucharada", "al gusto", "2-3 unidades"); null si solo hay gramos
  cantidad: number;             // el número entre paréntesis
  unidad: 'g' | 'ml' | 'kg' | 'l';
  opcional: boolean;            // el PDF lo marca con "*"
};
```

### 4.3 Semántica y decisiones de forma

- **`tiempos` en minutos**, no en `hh:mm:ss`: es lo que consume `totalTimeMin` (BUS-superficie-consulta) y lo
  único que se hace con un tiempo es comparar o mostrar. Se redondea al minuto.
- **`cantidadTexto` y `cantidad` separados.** El PDF da siempre las dos cosas: la medida
  casera ("1/2 diente") y el peso entre paréntesis ("(2 g)"). El peso es el dato
  comparable; la medida casera es lo que se muestra en la card (UI-card-receta). Nunca se intenta
  convertir uno en otro.
- **`preparacion` como párrafos**, no como texto plano: el corte de párrafo lo da el hueco
  vertical del PDF (interlineado 12,5 pt; salto de párrafo 25 pt). La "VERSIÓN RÁPIDA" que
  traen muchas recetas es un párrafo más; separarla es cosa de la app, si alguna vez hace
  falta.
- **Nada del nutricionista** (SEG-datos-nutricionista): el bloque desde "Los ingredientes con un asterisco…"
  hacia abajo (incluye el email de contacto) y el pie de página no se copian. Verificado
  con `grep` sobre el JSON y la QA: 0 apariciones de marca, email o eslogan.
- **Sin deduplicar.** Cada PDF es una entrada, aunque el mismo `fichero` aparezca en varios
  menús. La deduplicación es decisión de la ingesta, no del parser, porque hay versiones
  (§4.5).

### 4.4 Validación / garantías actuales

Sobre los 639 PDF de los 36 menús (QA agregada que escribe el propio script):

- 639 recetas extraídas, 639 con `Total` legible, 637 con preparación (las 2 sin ella son
  la misma tostada en los menús 15 y 16, y el PDF no trae texto: no es fallo del parser).
- **4.929 ingredientes, 4.929 con nombre terminado en dos puntos, cantidad numérica y unidad.**
  1.055 opcionales. 267 nombres distintos sin normalizar. Unidades: solo `g` y `ml`.
- **2 anomalías**, las dos preparaciones vacías de arriba. Ninguna estructural.

Como en la pata 1, esto es validación **estructural** del parser (¿encuentra cada bloque?,
¿casa cada línea?), no del contenido. La precisión real contra ground truth etiquetado a
mano sigue siendo EVAL-ground-truth (30 recetas a ciegas).

**Consecuencia para ING-determinista:** con 100 % de líneas parseadas y 0 anomalías estructurales, el
agente extractor con LLM no tiene nada que corregir. Queda como **experimento de
comparación** contra este parser; no es sistema.

### 4.5 Versiones de una misma receta

- **Dato.** De los 434 ficheros distintos, 146 aparecen en 2+ menús y **105 cambian entre
  menús** (92 con dos versiones, 13 con tres): ingredientes en 90, preparación en 63,
  título y tiempos en 2 cada uno. Son ediciones del nutricionista (sal 5 g → 2 g,
  "180º" → "180ºC"), no ruido del parser.
- **Contrato.** El parser no deduplica: una entrada por PDF (§4.3).
- **Pendiente de la spec de ingesta** (ARQ-modelo-datos): qué versión carga `Recipe`.
  Recomendación: una fila por `fichero` con el contenido del menú de número más alto, y el
  informe de ING-trazabilidad cuenta las versiones descartadas. Una `Recipe` por versión
  llenaría el ranking de filas casi iguales sin aportar nada al usuario.

### 4.6 Limitaciones conocidas / fuera de alcance de esta pata

- Los nombres de ingrediente **no se normalizan** ("Cebolla", "Cebolla cruda", "Cebolla
  tierna" son tres). La tabla ingrediente → grupo de alimento de BUS-superficie-consulta (c) se construye sobre
  estos 267 nombres, en la ingesta.
- Las constantes geométricas (`COL_RIGHT_X`, `COL_VALUE_X`, `TITLE_MIN_Y`) están medidas
  sobre esta plantilla. Si el nutricionista cambiara la maquetación, el parser lo diría
  (anomalías), pero no se adaptaría solo.
