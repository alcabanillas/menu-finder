# T4 — Evaluación de la extracción (semilla)

> **Tipo:** Semilla de spec. **No es la spec:** la spec se escribe con OpenSpec (`propose`) antes de escribir código (PROC-sdd).
> **Objetivo:** construir el ground truth de extracción por adjudicación ciega de las discrepancias entre el parser y un LLM, y medir la precisión de ambos (EVAL-ground-truth, ING-determinista).
> **Origen:** planificada en `tfm-brainstorm` durante la auditoría de documentación (2026-09-27).

---

## 1. Piezas

| # | Pieza | Qué hace | Estado |
|---|---|---|---|
| 1 | Sorteo | 10 menús (5 obligatorios) y 30 recetas, reproducible por semilla, con exclusiones | ✅ `scripts/datos/sorteo-ground-truth.js` (`pnpm datos:sorteo`) |
| 2 | Extractor LLM | Flujo Genkit + Gemini. Entra el **PDF**, no el texto del parser, que heredaría sus errores. Sale `RecetaJson` validado con Zod (tipos de T2) | ⬜ |
| 3 | Comparador | Normaliza (espacios, mayúsculas, números), alinea ingredientes y lista coincidencias y discrepancias | ⬜ |
| 4 | Adjudicador ciego | CLI: receta, campo, "Valor A / Valor B" en orden aleatorio y ruta del PDF; se elige A, B o un valor a mano. Guarda el ground truth y el registro, crudo y corregido (EVAL-ground-truth) | ⬜ |
| — | Métricas | Precisión del parser y del LLM, por campo; coste y latencia del LLM (Genkit) | Salen de 3 y 4 |

## 2. Lo que hace el autor

- **Sorteo:** 2 minutos; se puede hacer ya.
- **Clave de Gemini** en `.env` local, **en plan de pago**. El plan gratuito puede usar los datos para mejorar productos de Google, y eso choca con SEG-datos-nutricionista.
- **Adjudicación:** ~1 h.

Los PDF solo están en local. Claude escribe y prueba con PDF sintéticos; el autor ejecuta sobre los reales.

## 3. Preguntas abiertas para la spec

- ¿Los menús también por adjudicación? Recomendación: sí (de ~50 min a mano a ~10 min).
- Preparación de las recetas: ¿se compara el texto o solo el número de párrafos? Recomendación: número de párrafos.

## 4. Decidido por el autor (2026-09-27)

- **T4 va después de los golden sets de búsqueda y del spike T3.** T3 es el riesgo del producto y T4 no bloquea nada; T4 reutiliza la base de Genkit, Zod y la clave de Gemini que monta T3.
- **El ground truth se guarda como `evals.json`.** La forma exacta se define en la spec.
