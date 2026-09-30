# TFM — Producto

> **Qué es este documento:** qué se construye y qué no. Visión, restricciones, alcance y pantallas. Cambia poco.
>
> Las decisiones técnicas están en [decisiones.md](decisiones.md), los hechos medidos sobre los PDF en [datos.md](datos.md) y el orden de trabajo en [roadmap.md](roadmap.md).
>
> **Última actualización:** 2026-09-27.

---

## 1. Idea en una frase

Aplicación web (responsive, uso principal en móvil) para elegir el menú semanal del hogar a partir de una base de **~36 menús históricos en PDF**, elaborados por un nutricionista profesional para el autor, con su lista de la compra asociada como checklist. La IA se usa para **extraer, estructurar y recuperar** información existente, no para generar menús nuevos.

Sustituye el flujo actual del autor en Notion.

**Enfoque (PROC-enfoque): proyecto de IA aplicada; la app es la interfaz.** El sistema es **hybrid retrieval + grounded generation**, no RAG documental clásico: no hay chunking, ni problema de ventana de contexto, ni de escala, y en la presentación se describe así. El peso académico descansa en cuatro pilares, por orden:  
1. **extracción estructurada del menú** medida contra ground truth etiquetado a ciegas (EVAL-ground-truth, ING-parser-menu)  -
2. **evaluación comparada de recuperación** —léxica vs. semántica vs. híbrida— sobre el golden dataset (EVAL-estrategia). 
3. **faithfulness de la explicación** con LLM-as-judge (EVAL-estrategia). 
4. **flujo SDD con agentes** documentado como proceso (PROC-sdd-memoria). Sin (1) y (2) el proyecto es un CRUD con un embedding, así que los cuatro se protegen frente a cualquier recorte de alcance. Argumentación completa en [enfoque-academico.md](enfoque-academico.md).

## 2. Restricciones duras

| Restricción | Valor |
|---|---|
| Plazo | **3 semanas** de desarrollo + **1 semana** para los entregables |
| Entregables | **Diapositivas**, un **vídeo** que explica lo hecho y un **README** que cuenta qué hace el producto y cómo instalarlo. No hay memoria escrita ni defensa ante tribunal |
| Contexto | TFM de Máster en Desarrollo con IA. Debe demostrar: desarrollo asistido por IA, arquitectura, web moderna, LLM/RAG, testing, despliegue, seguridad, observabilidad |
| Modo de trabajo | Desarrollo asistido por agentes bajo **SDD (Spec-Driven Development)**: las especificaciones viven en el repo y son la entrada de los agentes. Reglas de seguridad en [safety-first.md](safety-first.md) |
| Coste | Proveedor LLM y hosting con capa gratuita o coste muy reducido |
| Datos | Mono-cuenta. Estructura `Dieta/Menu N/` con `menu.pdf`, `Lista_de_la_compra.pdf` y **un PDF por plato con su receta**. Copia local en `data/raw/Dieta/` (710 PDF + 710 TXT vía `pdftotext -layout`, gitignoreado). La app **no accede a Drive** (ING-cli-local). No multi-tenant |

## 3. Fuera de alcance (MVP)

- Generación de menús o recetas (ING-menu-json). Mostrar el texto de una receta existente **sí** entra (UI-card-receta).
- Búsqueda dentro del texto de las recetas, escalado de raciones, cálculo nutricional (UI-card-receta).
- **Integración con Google Drive** en cualquier forma (Service Account, OAuth, adaptador). Los ficheros se descargan a mano (ING-cli-local).
- Subida manual de ficheros; detección automática de cambios en origen; versionado del índice (ING-sin-subida).
- **Usuario anónimo** y registro de usuarios (SEG-sistema-cerrado).
- **"Sorpréndeme" / menú aleatorio**. El único camino para elegir menú es el buscador de `/planner`.
- Multi-tenant, perfiles premium, pagos, gestión de usuarios.
- App nativa, notificaciones, PWA offline.
- OCR, imágenes, nutrición avanzada, supermercados, precios, pedidos.
- Multiidioma, social. Microservicios, Kubernetes.
- **Batch cooking** en cualquier forma: reordenar los platos entre días, generar un plan de preparación del domingo o reescribir recetas. Descartado el 2026-09-20 porque no es evaluable. Diseño en [§5](#5-mejoras-futuras).
- **Relajación automática de restricciones**: aplazada el 2026-09-30 para recortar plazo; de momento la afloja el usuario desde el chip. Diseño en [§5](#5-mejoras-futuras).
- **URL Shortener**: plan B de TFM si esta idea resulta inviable en plazo.

## 4. Pantallas previstas

Qué falta por hacer de cada pantalla está en [roadmap.md](roadmap.md).

| Ruta | Pantalla |
|---|---|
| `/` | Sin sesión, home informativa; con sesión, dashboard (UI-home-sin-login): menú activo, "qué toca hoy", progreso de la compra |
| `/planner` | **Buscador de menús**: petición en lenguaje natural → candidatos con explicación. Forma fijada por **BUS-superficie-consulta**: caja de texto que permanece, chips de restricciones editables que acumulan, los 5 mejores de los 36 menús puntuados, evidencia por chip y explicación. Modelo de datos: ARQ-modelo-datos |
| `/menu` | Menú semanal activo, rejilla L–S / tabs en móvil. Card de receta desplegable al pulsar un plato (UI-card-receta) |
| `/shopping-list` | Checklist agrupada por las 13 categorías del PDF ([datos.md §2](datos.md)) |

## 5. Mejoras futuras

No entran en el MVP, pero tienen el diseño esbozado y se cuentan en la presentación como líneas futuras.

### Relajación automática de restricciones (agente)

Es el diseño original del descomponedor como agente pleno (IA-criterio-agente), aplazado el 2026-09-30 para recortar plazo. El porqué está en el proposal de `openspec/changes/mf-39-roadmap-dashboard/`.

```
petición → descomponedor → buscador → top 5
                               ↓
         ¿las restricciones duras dejan menos de 5 menús?
            no → fin
            sí → el agente recibe cuántos menús elimina cada restricción dura
                 decide, por restricción: pasarla a blanda o sustituirla
                 por su hiperónimo ("garbanzos" → legumbre)
                 lo avisa en el chip y reconsulta
                 máximo 2 vueltas → si no, el mejor ranking parcial
```

- **Por qué sería agente:** observa el resultado, decide entre dos movimientos según la intención ("sin gluten" suena a salud, "salmón" a preferencia) y tiene condición de parada.
- **Qué deja preparado el MVP** (BUS-descomponedor): `searchMenus` recibe la estructura, no el texto, y devuelve cuántos menús elimina cada restricción dura. El agente sería un caso de uso nuevo que envuelve al buscador, sin reescribirlo.
- **Qué haría falta:**
  - un golden set propio de decisiones de relajación, etiquetado a ciegas antes de construirlo;
  - para el hiperónimo, la tabla ingrediente → grupo de BUS-superficie-consulta (c).
- **Versión reducida, si se quiere abaratar:** un solo movimiento, decidir cuál pasar a blanda, sin hiperónimo ni tabla de grupos.

### Batch cooking

Una herramienta que reorganiza la semana para cocinar por lotes: agrupa preparaciones y monta un plan del domingo. Se descartó del MVP el 2026-09-20; el porqué está en [historial-de-decisiones.md](historial-de-decisiones.md), entrada "Batch cooking".

- **Componentes:**
  1. atributos nuevos por plato: cuántos días aguanta cocinado, qué partes se preparan antes y si recalienta bien;
  2. un planificador con restricciones;
  3. el plan generado, anclado al menú;
  4. su UI.
- **Evaluación:** comprobaciones estructurales deterministas (todos los platos cubiertos, ingredientes existentes, caducidad respetada, tiempos). Serían más duras que un juez LLM.
- **Límite:** actúa **sobre el menú elegido por el buscador**, nunca en su lugar.
- **Qué falta para que sea evaluable:**
  - Los atributos del punto 1 no existen en los datos: habría que etiquetarlos, a mano o con un LLM sobre `PREPARACIÓN`, y validarlos.
  - Los días no son intercambiables: el nutricionista reparte legumbre, pasta, pescado, arroz, carne y cuscús por día, así que reordenar deshace su diseño.
