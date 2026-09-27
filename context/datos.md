# TFM — Los datos reales

> **Qué es este documento:** hechos medidos sobre los PDF del nutricionista. No contiene decisiones: las que se apoyan en estos datos están en [decisiones.md](decisiones.md).
>
> **Última actualización:** 2026-09-27.

---

Medidos sobre los 36 menús en el análisis T1 (repo `tfm-brainstorm`, no viaja). Los tres tipos de PDF son **texto** generado por TCPDF, sin OCR necesario. **El menú y las recetas se extraen directamente del PDF**, sin paso intermedio por TXT: el menú con `pdf-parse` (`getTable()`, §1) y las recetas con `pdfjs-dist` (texto con coordenadas, §3); ver [T2](tareas/T2-esquema-json-ingesta.md). Solo la lista de la compra sigue extrayéndose vía TXT con `pdftotext -layout` ([T0](tareas/T0-extraccion-previa.md)).

## 1. `menu.pdf` (1 página)

- Tabla de 7 columnas (L–D) × 5 filas: Desayuno, Almuerzo, Comida, Merienda, Cena.
- **Todos los menús van de lunes a sábado.** El domingo se deja libre a propósito, como día de descanso: así lo genera la herramienta del nutricionista. **No es un hueco de extracción**, es una regla del dominio. Consecuencias: (a) la regla "6 días" del validador de ING-determinista es normativa —un menú con domingo relleno es un error de extracción—; (b) una semana son **12 slots de comida/cena**, y los 629 slots totales (17.5 por menú) cuadran con las cenas de 2 platos de los menús ≥17; (c) la UI **no pinta 7 días**.
- Almuerzo está vacío. Desayuno y Merienda son celdas fusionadas iguales para todos los días (texto genérico, no son "platos").
- Cada celda de Comida/Cena tiene 1–2 platos marcados con `*`, más relleno fijo ("una pieza de fruta", "un yogur sin azúcares añadidos") que hay que filtrar.
- Los platos marcados con `*` tienen una receta, en un PDF independiente de la misma carpeta (§3).
- **No hay ninguna indicación de temporada**: ni en el PDF ni en el número de menú.
- Las celdas no son triviales de leer: nombres de plato partidos en varias líneas, el `*` a veces solo en una línea, y en los menús ≥17 las cenas traen 2 platos apilados sin separador. Cómo se resuelve: [T2 §2.3–2.4](tareas/T2-esquema-json-ingesta.md).

## 2. `Lista_de_la_compra.pdf` (1 página)

- Estructura muy regular: `Categoría` → líneas `- Ingrediente: cantidad unidad [(opcional)]`. **13 categorías**, ~70 ítems.
- Especias y Grasas usan otro formato (lista separada por comas, sin cantidades).
- Hay duplicados (Sésamo ×2, Ajo ×2 con y sin "opcional") que hay que fusionar o mantener como filas distintas.
- Cantidades en gramos por persona, estilo nutricionista ("Fruta: 1050g"). Válidas para checklist; poco naturales para "comprar".
- **Se parsea de forma determinista (regex), sin LLM.** Buen contraste académico frente al menú.

## 3. Recetas individuales (un PDF por plato)

- **639 ficheros PDF**, uno por plato, en la misma carpeta que `menu.pdf`. El nombre del fichero es el nombre del plato. **434 distintos**; 146 se repiten en varios menús y 105 de ellos con **versiones** distintas (ediciones del nutricionista: sal 5 g → 2 g, "180º" → "180ºC"). Ver [T2 §4.5](tareas/T2-esquema-json-ingesta.md).
- Se extraen a JSON con **parser posicional determinista** (`parse-recetas-pdfjs.js`, [T2 §4](tareas/T2-esquema-json-ingesta.md)): título, tiempos en minutos, **4.929 ingredientes** con nombre / medida casera / gramos / opcional, preparación en párrafos. 100 % de líneas parseadas, 0 anomalías estructurales, sin `pdftotext`.
- El pie (marca, email, eslogan) y el bloque de contacto del nutricionista no llegan al JSON (SEG-datos-nutricionista). Cómo se leen las recetas: [T2 §4.1](tareas/T2-esquema-json-ingesta.md).
- Cobertura medida sobre `data/menu-platos.json` (T2, ING-parser-menu): **608 platos**, **591 con receta marcada por asterisco y fichero resuelto**, 17 sin receta (relleno tipo "tomate y cebolla asada"). Las 176 celdas con 2+ platos vienen ya separadas; no queda ningún plato concatenado.
- Consecuencia: la búsqueda opera **a nivel de plato**, no de semana agregada. Es lo que hace viable el buscador (BUS-unidad-plato, BUS-discrimina-plato).
