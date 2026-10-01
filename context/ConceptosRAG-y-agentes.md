# Conceptos: RAG vs. buscador de menús, y qué es (y qué no es) un agente

> Documento explicativo, no normativo. Aclara dos ideas de [decisiones.md](decisiones.md) (PROC-enfoque, IA-criterio-agente y BUS-descomponedor) con ejemplos de los datos reales del proyecto. Sirve también como borrador para la parte conceptual de las diapositivas y el vídeo.

---

## Parte 1 — ¿Es esto un RAG o un buscador?

### 1.1 Qué es RAG "de libro"

RAG (Retrieval-Augmented Generation) nace para un problema concreto: **el LLM no conoce tus documentos**, y no caben en el prompt. La solución clásica:

```
Documentos (muchos, largos)
    ↓ trocear en fragmentos ("chunks") de ~500 palabras
    ↓ calcular embedding de cada chunk
    ↓ guardar en vector store
Pregunta del usuario
    ↓ embedding de la pregunta
    ↓ buscar los k chunks más parecidos
    ↓ meter esos chunks en el prompt como contexto
LLM genera la respuesta leyendo ese contexto
```

Ejemplo típico: 2.000 páginas de manuales técnicos; el usuario pregunta "¿cómo reseteo el router modelo X?"; el sistema recupera los 5 párrafos relevantes y el LLM redacta la respuesta a partir de ellos.

Las dos palabras clave son **retrieval** (recuperar lo relevante) y **generation** (el LLM redacta usando lo recuperado). El chunking y el vector store son *medios*, no la definición.

### 1.2 Por qué tu caso no encaja en el molde clásico

| RAG clásico | Tu proyecto |
|---|---|
| Miles de documentos largos | 36 menús de 1 página |
| Hay que trocear porque no caben | Cabe todo en un prompt (36 × ~80 líneas ≈ 15k tokens) |
| Se recuperan *fragmentos de texto* | Se recuperan *menús completos* (registros estructurados) |
| El LLM responde una pregunta abierta | El usuario tiene que **elegir uno** de los candidatos |
| La unidad es el chunk | La unidad es el menú, descrito por sus platos e ingredientes |

Si lo presentas como "RAG documental con chunking", quien evalúe preguntará *"¿para qué chunking si cabe todo en el prompt?"* y no tendrás buena respuesta.

### 1.3 Lo que realmente estás construyendo: un buscador semántico de menús con explicación

El flujo con el ejemplo *"quiero comer alitas de pollo y salmón esta semana"*:

```
1. Descomponer la petición
   "alitas de pollo y salmón"  →  restricciones: ["alitas de pollo", "salmón"]

2. Buscar cada restricción contra el índice de platos + ingredientes
   "alitas de pollo"  ≈  "Pollo (muslo)" 0.81,  "Arroz con brócoli y pollo" 0.74, ...
   "salmón"           ≈  "Salmón al horno" 0.95,  "Bacalao" 0.62, ...

3. Puntuar cada MENÚ por lo bien que cubre TODAS las restricciones
   Menú 1:  pollo 0.81  +  salmón 0.62 (solo bacalao)  →  cubre 1 de 2
   Menú 4:  pollo 0.79  +  salmón 0.95                 →  cubre 2 de 2  ← mejor
   Menú 17: pollo 0.30  +  salmón 0.94                 →  cubre 1 de 2

4. Mostrar ranking + explicación anclada en los datos
   "Menú 4: lleva solomillo de pollo al curry el viernes y salmón al horno el
    jueves. Menú 1 tiene pollo pero no salmón (lleva bacalao)."

5. El usuario elige → ese menú y su lista de la compra pasan a ser los actuales
```

**Sigue siendo RAG en sentido estricto** — hay retrieval (pasos 2–3) y generation anclada en lo recuperado (paso 4) — pero:

- El retrieval no es "top-k chunks" sino **matching multi-restricción**: cada condición se busca por separado y se combina, porque una única embedding de la frase entera premia menús con mucho pollo y nada de salmón.
- La generación **no responde**, **explica**: el LLM no decide nada, solo redacta por qué cada candidato encaja, y eso se puede verificar (¿lo que dice está en el menú? = *faithfulness*).
- El vector store es un índice derivado; la verdad está en el JSON estructurado.

Nombre honesto para la presentación: *"búsqueda híbrida multi-restricción sobre registros estructurados con generación anclada"*, o en corto, **hybrid retrieval + grounded generation**. Puedes decir "una variante de RAG" siempre que expliques en qué se aparta del clásico y por qué.

### 1.4 Por qué esto no es "demasiado simple"

Lo que da peso académico no es el tamaño del índice sino lo que puedes **medir**:

1. **¿Cuándo aporta la búsqueda semántica frente a la léxica?** "Marisco" no aparece en ningún PDF (hay "gamba", "sepia", "mejillón"); "algo de cuchara" tampoco. Una búsqueda por texto falla; una semántica acierta. Pero "salmón" o "pollo y brócoli" los encuentran las dos, y "alitas" lo encuentra la léxica porque el plato se llama "Alitas de pollo al curry". Con el golden dataset comparas léxica vs semántica vs híbrida **por tipo de consulta** y das cifras. Si la léxica gana en tu dataset, es un resultado válido. Casos verificados en [datos.md §4](datos.md).
2. **¿La explicación es fiel?** LLM-as-judge sobre las explicaciones: ¿inventa platos que no están? Métrica de faithfulness.
3. **¿La extracción del PDF es correcta?** Precisión de asignación plato→día contra menús etiquetados a mano.

Un CRUD con un embedding no mide nada. Esto sí.

---

## Parte 2 — ¿Qué es un agente y qué es solo una llamada al LLM?

### 2.1 La distinción

Una **llamada al LLM** es: entra un prompt, sale una respuesta. Aunque uses structured output y un schema, sigue siendo una función `f(entrada) → salida`.

Un **agente** es un componente que **decide qué hacer a continuación** en función de lo que observa, típicamente en un bucle:

```
        ┌──────────────────────────────┐
        │  observar (entrada / estado)  │
        └──────────────┬───────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  decidir (llamada LLM)        │
        └──────────────┬───────────────┘
                       ↓
        ┌──────────────────────────────┐
        │  actuar (tool, validar, ...)  │
        └──────────────┬───────────────┘
                       ↓
              ¿objetivo cumplido?
               no ↺        sí → fin
```

Los tres ingredientes: **bucle**, **decisión** (no un camino fijo) y **condición de parada** (éxito, N intentos, o escalar a un humano). Sin bucle ni decisión, es un paso de pipeline.

Por qué importa para el TFM: si llamas "agente" a cada llamada al LLM, quien evalúe te lo discutirá y perderás credibilidad en todo lo demás. Si tienes pocos agentes reales bien definidos y el resto lo llamas pipeline, demuestras que entiendes la diferencia.

### 2.2 Los componentes del sistema, uno a uno

#### ❌ Descomponedor — no es agente; su relajación automática sería agente, y es línea futura (BUS-descomponedor)

```
entrada: "arroz con pollo y garbanzos, nada de cerdo"
  ↓
LLM con schema Zod → restricciones: "arroz con pollo" (un mismo plato), "garbanzos"
                      exclusión global: cerdo (penalización blanda)
  ↓
buscador → puntúa los 36 menús → muestra los 5 primeros
  ↓
¿las restricciones duras dejan menos de 5?  → el chip dice cuántos menús elimina cada una
                                              y el usuario la afloja y relanza
```

Es una llamada con schema: traduce una vez y no decide nada sobre el resultado. El bucle lo cierra el usuario (human-in-the-loop).

**Línea futura:** que el LLM observe cuántos menús elimina cada restricción dura, **decida** cuál soltar según la intención ("sin gluten" suena a salud, "salmón" a preferencia) y reconsulte, con un máximo de 2 vueltas. Eso sí cumpliría la definición. El diseño lo deja preparado: el buscador recibe la estructura y devuelve ese recuento.

#### 🧪 Extractor — agente, pero experimento (ING-determinista)

```
PDF → LLM con schema Zod → JSON candidato
  ↓
validar: schema, 6 días (L–S), 1–2 platos por celda, platos con * presentes
  ↓
¿válido?  sí → aceptar
          no → reintentar pasando los errores concretos; tras 3 fallos → revisión manual
```

Cumple la definición, pero **no está en la ingesta**: los parsers deterministas (por posición desde el PDF) extraen menú y recetas con 0 anomalías, así que un LLM no tiene nada que corregir. Se conserva como **experimento comparativo** para la presentación: parser vs. LLM con structured output vs. agente con reintento, sobre el mismo ground truth, en precisión y coste. Que el LLM no hiciera falta es un resultado, no un fracaso.

#### ❌ Explicador — no es agente (IA-criterio-agente)

Recibe los candidatos y qué platos cubren cada restricción, y redacta por qué encajan **usando solo ese contexto**. Genera una vez; su control de calidad (faithfulness) es **externo**, lo mide el juez. Es una llamada con schema, no un bucle.

#### ❌ Juez de evaluación — no es agente (IA-criterio-agente)

Patrón LLM-as-judge: puntúa faithfulness y relevancia de las explicaciones, en batch, fuera de producción. Entra contexto, sale una puntuación: no hay bucle, ni decisión, ni parada. Es de otra familia de modelo que el sistema (IA-proveedor).

#### ❌ Pipeline determinista (y está bien que lo sea)

| Componente | Qué es |
|---|---|
| Parsers de menú y recetas | Posición del texto en el PDF (ING-parser-menu, T2) |
| Parser de lista de la compra | Regex sobre líneas `- X: 120g` (ING-lista-compra) |
| Embeddings | Texto → vector, por plato |
| Ranking | Agrega, por restricción, el mejor plato de cada menú |
| CLI de ingesta | Recorre `data/raw/`, extrae a JSON y carga en BD (ING-cli-local) |

### 2.3 Cómo se cuenta esto en la presentación

> *El sistema es un buscador en lenguaje natural sobre un catálogo estructurado: traduce la petición a restricciones, las recupera plato a plato con búsqueda híbrida y explica el ranking con los datos recuperados. Combina componentes deterministas (parsers, ranking, ingesta) con tres usos de LLM —descomponer, explicar y evaluar—, clasificados según cumplan o no la definición de agente adoptada (bucle de observación, decisión y condición de parada). Solo la cumple el agente extractor, que se conserva como experimento comparativo porque la extracción de los PDF se resolvió de forma determinista. El descomponedor, el explicador y el juez se documentan como llamadas con schema, no como agentes; la relajación automática de restricciones, que sí sería un agente, queda como línea futura con el diseño preparado. Se ha evitado deliberadamente usar un LLM donde una solución determinista es suficiente.*

### 2.4 Relación con Genkit (IA-proveedor)

Genkit modela esto: *flows* con schema de entrada y salida (Zod), trazas de cada paso y un runner de evals. Descomponedor, explicador y extractor son flows; los componentes deterministas, funciones normales. Queda detrás de un puerto (ADR-001). Su Developer UI es la consola de debug en local, y en producción las trazas van a Sentry (OPS-observabilidad): la app no tiene pantalla de debug.
