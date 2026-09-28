# Enfoque y peso académico del TFM

> **Qué es este documento:** la argumentación de **por qué esto es un TFM de IA aplicada y no un CRUD con un embedding**. No contiene decisiones normativas (esas están en [decisiones.md](decisiones.md)) ni historia (esa está en [historial-de-decisiones.md](historial-de-decisiones.md)).
>
> Es la **semilla de la memoria**: los apartados de aquí son, casi tal cual, los de introducción y justificación.
>
> Vivió hasta 2026-09-20 dentro de la fuente de verdad, como "contradicción C5". Nunca fue una contradicción: es la tesis. Lo que de ella era normativo quedó como **PROC-enfoque**; esto es el razonamiento que lo sostiene.

---

## 1. Qué problema es este, en realidad

La visión del autor (2026-09-18): vectorizar nombres de platos e ingredientes; el usuario pide *"quiero comer alitas de pollo y salmón esta semana"*; el sistema busca y propone menús candidatos.

Eso **no es "top-k chunks"**. Es **matching multi-restricción**: la petición lleva varias condiciones (pollo AND salmón), los candidatos son 36 semanas, y cada semana es un conjunto de ~12 platos con sus recetas.

Y tiene un fallo conocido si se resuelve de forma ingenua: una única *embedding* de la frase completa contra una *embedding* de cada menú funciona **mal con "A y B"**, porque premia a los menús que tienen mucho de A y nada de B. Ese fallo es, precisamente, lo que hace interesante el diseño.

El pipeline defendible:

1. **Descomponer** la petición en restricciones (`["alitas de pollo", "salmón"]`). Con LLM o con un *split* sencillo — las dos se pueden comparar, y esa comparación es resultado.
2. **Puntuar** cada restricción contra los platos e ingredientes indexados; la puntuación del menú es una agregación (suma de máximos por restricción, penalizando las no cubiertas).
3. **Explicar**, generando texto **anclado** en lo recuperado ("Menú 4: pollo al curry el viernes, salmón al horno el jueves"). Aquí es donde entra el LLM y donde se mide *faithfulness*.

Esto es **hybrid retrieval + grounded generation**. Es legítimo llamarlo RAG, pero en la memoria hay que describirlo así, **no como RAG documental clásico**: no hay chunking, ni problema de ventana de contexto, ni escala.

## 2. Dónde está el peso académico

Con 36 menús no hay problema de escala. Si el tribunal ve "36 registros + un embedding", el proyecto queda **demasiado simple**. Lo que lo sostiene, por orden de importancia:

1. **Extracción estructurada, evaluada.** Menú (tabla aplanada en columnas) y recetas (tres columnas fijas) se extraen por posición desde el PDF, con 0 anomalías estructurales sobre 504 slots y 4.929 ingredientes ([T2](tareas/T2-esquema-json-ingesta.md)). Se midió la alternativa por texto con layout (pierde el 11,6 % de los ingredientes) y **se descartó el LLM en la ingesta con esa cifra** (ING-determinista); queda como experimento de comparación contra el mismo ground truth etiquetado a ciegas (EVAL-ground-truth). El resultado no es "extraje con IA", sino "medí dónde no hacía falta".
2. **Evaluación comparada de recuperación:** léxica (Postgres full-text) vs. semántica vs. híbrida multi-restricción, sobre el golden dataset. **Si la léxica gana en este dataset, es un resultado válido y honesto**, no un fracaso.
3. **Faithfulness de la explicación**, con LLM-as-judge (EVAL-estrategia).
4. **Flujo SDD con agentes**, documentado como proceso (PROC-sdd-memoria).

Sin (1) y (2), el proyecto es un CRUD con un embedding. Con ellos, es IA aplicada con evaluación.

**Enfoque elegido: proyecto de IA aplicada; la app es la interfaz**, no el objeto de estudio.

## 3. Cómo ha evolucionado el riesgo de "demasiado simple"

**2026-09-18.** Riesgo alto. La comparativa (2) se haría sobre 36 bolsas agregadas de ingredientes. Poco corpus, poco que comparar.

**2026-09-19, tras T1.** Baja de forma apreciable, por dos motivos:

- Con BUS-unidad-plato la comparativa se hace sobre **~629 platos con ingredientes propios**, no sobre 36 bolsas.
- Aparece un caso de estudio que no teníamos: **el mismo corpus discrimina o no según la unidad de indexación elegida** (mediana 2/36 por plato frente a 15.5/36 por semana). Es un resultado de recuperación de información defendible por sí mismo, y salió de **medir antes de diseñar**.

**2026-09-20. El riesgo se ha desplazado, no ha desaparecido.** Hoy está en dos sitios:

- **La superficie de consulta (C9).** T1 midió el poder discriminante sobre **ingredientes literales**, y solo sobre eso. Si el buscador se queda ahí, el núcleo del sistema es un `WHERE ingrediente IN (...)` con envoltorio en lenguaje natural. Lo que lo saca de ahí es aceptar consultas por **atributo derivado** (tiempo total, fuente de proteína, alérgenos, método de cocción) y por **intención difusa**, y eso exige una capa de enriquecimiento en ingesta que está sin decidir. *Se cerró ese mismo día con BUS-superficie-consulta: se enriquecen el tiempo total, el grupo alimentario de cada ingrediente (del que salen la fuente de proteína y los grupos de exclusión) y la temporada; el método de cocción **no** se enriquece, se resuelve por texto sobre el nombre del plato y por similitud.*
- **El vector store podría ser decorativo.** Si la capa estructurada es buena, las consultas por plato concreto, por ingrediente literal y por atributo derivado se resuelven **sin embeddings**; solo la intención difusa los necesita de verdad. Es un riesgo para la etiqueta "RAG" de todo el TFM, y hay que decidirlo a la vista, no por inercia. Por eso la comparativa léxica vs. semántica vs. híbrida deja de ser un extra y pasa a ser **la justificación arquitectónica** de si el vector store entra o no.

**2026-09-21. La ingesta deja de ser riesgo y pasa a ser resultado.** El parser posicional de recetas ([T2 §4](tareas/T2-esquema-json-ingesta.md)) cierra la extracción con 100 % de líneas y 0 anomalías; el agente extractor queda como experimento. El riesgo de "demasiado simple" ya no está en la ingesta ni en la superficie de consulta (BUS-superficie-consulta la cerró): está **solo** en la comparativa de recuperación y en la evaluación (golden sets EVAL-golden-sets, juez IA-proveedor). Lo que T0, T1 y T2 dejan para la memoria no es infraestructura: es el capítulo de análisis del corpus (T1, con el resultado plato vs. semana) y el de ingesta (T2, con la comparativa de enfoques, la decisión sobre el LLM y el hallazgo de las 105 recetas con versiones).

## 4. Los casos que justifican los embeddings

Los casos concretos, verificados contra el vocabulario del dataset, están en [datos.md §4](datos.md). Aquí va el argumento.

Hasta el 2026-09-20 el ejemplo era *"alitas de pollo no aparece en ningún menú"*. **Era falso**: está en 3 menús y la búsqueda léxica lo encuentra. Se cambió al comprobarlo contra los datos, y queda aquí como aviso: **ningún ejemplo de la memoria se afirma sin haberlo comprobado contra los datos.** El sinónimo por variante de nombre lo resuelve una tabla de normalización, no un embedding.

Los casos que la búsqueda léxica **no** puede resolver y la semántica sí son los términos que no existen como token en el dataset:

- **Hiperónimos.** El usuario pide la categoría ("marisco"); el nutricionista escribe el miembro ("sepia").
- **Intención difusa.** "Algo de cuchara" no está en ningún campo: es similitud entre la petición y la descripción del plato con sus ingredientes.
- **Errores y variantes de escritura.** Parte lo cubre un *stemmer* español; parte no.

Y el contraejemplo, que también va al golden dataset: hay consultas que la léxica encuentra igual de bien o mejor. La comparativa del pilar (2) se hace por tipo de consulta, no en agregado, y se espera que cada tipo tenga un ganador distinto: ese es el resultado, no que "gane la semántica".

Junto a estos van las consultas multi-restricción y las **consultas sin resultados**, que existen porque el filtro a nivel de plato las genera (BUS-descomponedor).

## 5. Seguridad, como argumento y no como anexo

El PDF es **input no confiable que entra en un LLM**. La mitigación es de diseño, no de parcheo: schema estricto (el modelo solo puede emitir campos tipados) y nada de lo que venga del documento se ejecuta. Debe constar en la memoria y en [safety-first.md](safety-first.md).

A eso se le añade el **control de acceso por diseño** de SEG-sistema-cerrado: el sistema es cerrado porque los datos son de un profesional y no se redistribuyen. Es una restricción real del dominio resuelta con una decisión de arquitectura, que es justo lo que se pide demostrar.
