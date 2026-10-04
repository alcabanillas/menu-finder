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
| 2. Lista de la compra | `Lista_de_la_compra.pdf` | `pnpm ingest shopping-list` (`src/`, MF-10) | ✅ Cerrado (§3) |
| 3. Listado de recetas | un PDF por receta (639) | `pnpm ingest recipes` (`src/`, MF-38) | ✅ Cerrado (§4) |

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
  `JsonFileMenuRepository`, antes de que el mismo comando guarde los menús en la BD (MF-41).
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
  (`src/infrastructure/local-documents/pdf/split-cell.ts`) los separa por dos señales: una
  línea que termina en `*` cierra un plato, y una línea que empieza por mayúscula (mientras
  la anterior no termina en preposición o artículo — de/con/al/en/y/la/el/...) señala el
  inicio de un plato nuevo. El relleno genérico sin `*` (una pieza de fruta, un yogur o
  kéfir sin azúcar) no es un plato y se descarta (`src/domain/menu/filler.ts`).
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

### 3.1 Origen

`pnpm ingest shopping-list` (CLI de `src/`, MF-10) lee cada `data/raw/Dieta/Menu N/Lista_de_la_compra.pdf` directamente con `pdfjs-dist` y trabaja sobre el **texto con coordenadas**, sin paso intermedio por TXT ni Poppler. A diferencia del menú y las recetas, la lista de la compra **no genera fichero JSON**: se persiste directamente en la base de datos relacional (tabla `shopping_item`), cumpliendo ING-lista-compra como dato primario sobre el que operará la checklist (MF-24).

La página del PDF tiene una disposición en dos columnas con cabecera y pie:

| Zona | Posición (puntos, origen abajo-izquierda) | Tratamiento |
|---|---|---|
| Título `Lista de la compra` | `y > 750` | Descartado por texto |
| Columna izquierda | `x < 280` | Categorías e ítems ordenados por `y` descendente |
| Columna derecha | `x ≥ 280` | Categorías e ítems ordenados por `y` descendente |
| Pie de página (eslogan, generador) | `y ≤ 40` (`FOOTER_MAX_Y`) | Descartado por posición (SEG-datos-nutricionista) |

El descarte por posición por debajo de $y \le 40$ garantiza que el eslogan y la marca del nutricionista nunca se incorporen al dominio, a la base de datos ni a los reportes de calidad.

### 3.2 Forma y modelo en base de datos (`shopping_item`)

Cada ítem se persiste en la tabla relacional `shopping_item` con clave foránea a `menu(number) ON DELETE CASCADE`:

```sql
CREATE TABLE shopping_item (
  menu_number integer NOT NULL REFERENCES menu (number) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  category text NOT NULL,
  name text NOT NULL,
  quantity numeric,
  unit text CHECK (unit IN ('g', 'ml')),
  optional boolean NOT NULL,
  PRIMARY KEY (menu_number, position)
);
```

- **`menu_number`:** número del menú al que pertenece la lista.
- **`position`:** entero correlativo ($1, 2, \dots$) que preserva estrictamente el orden de lectura original del PDF.
- **`category`:** una de las 13 categorías reconocidas (p. ej. `Cárnicos y derivados`, `Verduras, hortalizas y derivados`).
- **`name`:** nombre del ingrediente o ítem (si está partido en dos líneas consecutivas, se une con un espacio).
- **`quantity`:** número decimal o entero (admite coma y punto en origen), o `null` si no indica cantidad medible (recuentos o categorías de texto libre).
- **`unit`:** `'g'`, `'ml'` o `null` (para unidades por piezas/recuentos o texto libre).
- **`optional`:** booleano `true` si incluye la marca `(opcional)` al final de la línea o en la línea inmediatamente siguiente.

### 3.3 Categorías de texto libre (`Especias` y `Grasas y aceites`)

En `Especias` y `Grasas y aceites`, el nutricionista no utiliza el formato `- nombre: cantidad` sino texto corrido separado por ` , ` (espacio antes de coma) que puede saltar de línea y contener ítems opcionales individuales (p. ej. `Ajo, en polvo (opcional) , Perejil`).

El parser une las líneas continuas de la categoría y separa por ` , `, creando ítems individuales sin cantidad ni unidad (`quantity: null`, `unit: null`), respetando comas internas en nombres (`Laurel, hoja`).

### 3.4 El caso de dos páginas

De los 36 menús, exactamente 17 ocupan dos páginas (menús 4, 5, 6, 11, 15, 16, 17, 20, 22, 23, 26, 30, 31, 32, 34, 35, 36). La segunda página continúa el flujo de la primera sin repetir título; una categoría puede iniciarse al final de la página 1 y continuar con sus ítems en la página 2. El lector procesa todas las páginas del documento como un único flujo continuo y reporta el número de páginas por menú en consola y en el informe de QA (`data/qa/qa-lista-compra.md`).

### 3.5 Garantías y validación de aceptación

La ejecución contra los 36 PDF reales del nutricionista produce:
- **36 listas leídas:** 17 de dos páginas y 19 de una página.
- **2.918 ítems** almacenados en base de datos.
- **658 ítems opcionales** detectados.
- **577 ítems sin cantidad** (especias, aceites y recuentos sin unidad).
- **0 fallos** y **0 anomalías**.
- **Idempotencia transaccional:** reejecutar el comando realiza un `DELETE WHERE menu_number = ANY(...)` e `INSERT` en una sola transacción, manteniendo idénticos los 2.918 registros sin duplicados.

### 3.6 Límites

- **Dependencia de menú:** requiere que los menús correspondientes ya existan en la tabla `menu` (orden `migrate → recipes → menu → shopping-list → embed`). Si un menú no está cargado, el comando falla con código 1 y no guarda datos huérfanos.
- **Sin normalización semántica:** los nombres se extraen literalmente del PDF sin asignar grupos de alimentos ni normalizar sinónimos (alcance de MF-16).
- **Sin estado de checklist:** el estado marcado/comprado por usuario se gestiona en la capa de aplicación y UI de la checklist (MF-24).

---

## 4. Pata 3 — Listado de recetas (`recetas.json`)

### 4.1 Origen

`pnpm ingest recipes` (CLI de `src/`, MF-38) lee cada `data/raw/Dieta/Menu N/<plato>.pdf`
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
Recipe[]            // una entrada por fichero de receta, 434, ordenadas por `file`
```

Es la entidad de dominio `Recipe` (`src/domain/recipe/recipe.ts`) serializada tal cual,
como `WeeklyMenu` en la pata 1. El fichero es temporal: MF-16 lo sustituye por la BD.

```ts
type Recipe = {
  file: string;                 // nombre de fichero sin extensión; casa con `recipeFile` de la pata 1
  sourceMenu: number;           // menú del que sale la versión guardada (el de número más alto, §4.5)
  title: string;                // título + subtítulo del PDF, en una línea ("Alcachofas rellenas de huevo y gambas")
  times: {                      // minutos enteros; null si la casilla está vacía
    total: number | null;
    preparation: number | null; // "Elaboración"
    cooking: number | null;     // "Cocción"
    resting: number | null;     // "Espera/reposo"
  };
  ingredients: RecipeIngredient[]; // en el orden del PDF
  preparation: string[];        // un párrafo por elemento, en el orden del PDF; [] si no hay
};

type RecipeIngredient = {
  name: string;                    // sin el guion ni los dos puntos ("Aceite de oliva virgen extra")
  householdMeasure: string | null; // la medida casera, tal cual ("1 cucharada", "al gusto", "2-3 unidades"); null si solo hay gramos
  quantity: number | null;         // el número entre paréntesis; null solo si la cantidad no se pudo leer (anomalía)
  unit: 'g' | 'ml' | 'kg' | 'l' | null;
  optional: boolean;               // el PDF lo marca con "*"
};
```

Las anomalías del parser ya no van en el dataset: salen en la QA, por menú y fichero.

### 4.3 Semántica y decisiones de forma

- **`times` en minutos**, no en `hh:mm:ss`: es lo que consume `totalTimeMin` (BUS-superficie-consulta) y lo
  único que se hace con un tiempo es comparar o mostrar. Se redondea al minuto.
- **`householdMeasure` y `quantity` separados.** El PDF da siempre las dos cosas: la medida
  casera ("1/2 diente") y el peso entre paréntesis ("(2 g)"). El peso es el dato
  comparable; la medida casera es lo que se muestra en la card (UI-card-receta). Nunca se intenta
  convertir uno en otro.
- **`preparation` como párrafos**, no como texto plano: el corte de párrafo lo da el hueco
  vertical del PDF (interlineado 12,5 pt; salto de párrafo 25 pt). La "VERSIÓN RÁPIDA" que
  traen muchas recetas es un párrafo más; separarla es cosa de la app, si alguna vez hace
  falta.
- **Nada del nutricionista** (SEG-datos-nutricionista): el bloque desde "Los ingredientes con un asterisco…"
  hacia abajo (incluye el email de contacto) y el pie de página (`y < 40`) no se copian. Lo
  fija un test con una marca ficticia, y en MF-38 se verificó sobre los 639 PDF: ninguna
  cadena del pie ni del bloque de cierre llega al JSON ni a la QA (la única coincidencia es
  el fragmento genérico "son opcionales" dentro de una preparación).
- **Una receta por fichero** (§4.5). El PDF que falla (sin cabecera `INGREDIENTES` o
  ilegible) es un error de ese fichero: no entra, se informa y el comando sale con 1.

### 4.4 Validación / garantías actuales

Sobre los 639 PDF de los 36 menús (QA que escribe `pnpm ingest recipes` en
`data/qa/qa-recetas-pdfjs.md`):

- 639 PDF leídos sin error. En los 639, **4.929 ingredientes con nombre terminado en dos
  puntos, cantidad numérica y unidad**, y 2 sin preparación (la misma tostada en los menús
  15 y 16: el PDF no trae texto, no es fallo del parser).
- En el dataset, una por fichero: **434 recetas**, 434 con `total`, 433 con preparación
  (1.852 párrafos), **3.451 ingredientes**, todos con cantidad y unidad, 743 opcionales,
  267 nombres distintos sin normalizar. Unidades: `g` 2.888, `ml` 563.
- **2 anomalías**, las dos preparaciones vacías de arriba. Ninguna estructural.
- **Paridad (MF-38):** cada una de las 434 recetas es idéntica, campo a campo, a la entrada
  del script anterior (`parse-recetas-pdfjs.js`, ya retirado) para el mismo fichero y menú.

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
- **Decisión (MF-38, spec `recipe-ingestion`).** Una `Recipe` por fichero, con el contenido
  del menú de número más alto cuyo PDF se pudo leer (`sourceMenu`). Las otras versiones no
  se guardan: la QA lista cada fichero con versiones distintas, el menú conservado, los
  menús que difieren y los campos. Una `Recipe` por versión llenaría el ranking de filas
  casi iguales sin aportar nada al usuario.

### 4.6 Limitaciones conocidas / fuera de alcance de esta pata

- Los nombres de ingrediente **no se normalizan** ("Cebolla", "Cebolla cruda", "Cebolla
  tierna" son tres). La tabla ingrediente → grupo de alimento de BUS-superficie-consulta (c) se construye sobre
  estos 267 nombres, en la ingesta.
- Las constantes geométricas (`COL_RIGHT_X`, `COL_VALUE_X`, `TITLE_MIN_Y`) están medidas
  sobre esta plantilla. Si el nutricionista cambiara la maquetación, el parser lo diría
  (anomalías), pero no se adaptaría solo.
