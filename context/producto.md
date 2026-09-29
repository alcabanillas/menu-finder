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
- **Batch cooking** en cualquier forma: reordenar los platos entre días, generar un plan de preparación del domingo o reescribir recetas. Descartado el 2026-09-20 porque no es evaluable (no hay ground truth de una semana reordenada ni de la caducidad/batchabilidad de cada plato). Se cuenta en la presentación como **línea futura con diseño esbozado**; el porqué, en el historial.
- **URL Shortener**: plan B de TFM si esta idea resulta inviable en plazo.

## 4. Pantallas previstas

Qué falta por hacer de cada pantalla está en [roadmap.md](roadmap.md).

| Ruta | Pantalla |
|---|---|
| `/` | Sin sesión, home informativa; con sesión, dashboard (UI-home-sin-login): menú activo, "qué toca hoy", progreso de la compra |
| `/planner` | **Buscador de menús**: petición en lenguaje natural → candidatos con explicación. Forma fijada por **BUS-superficie-consulta**: caja de texto que permanece, chips de restricciones editables que acumulan, ranking de los 36 con contador de empates en cabeza, evidencia por chip y explicación. Modelo de datos: ARQ-modelo-datos |
| `/menu` | Menú semanal activo, rejilla L–S / tabs en móvil. Card de receta desplegable al pulsar un plato (UI-card-receta) |
| `/shopping-list` | Checklist agrupada por las 13 categorías del PDF ([datos.md §2](datos.md)) |
