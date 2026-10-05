# Copia de los tokens del design system

Esta carpeta guarda una copia de los tokens del design system del autor, el artifact «Menu Finder Design System» de claude.ai (<https://claude.ai/code/artifact/2b9c8f4b-b06b-4b2d-a22a-221b23edc61a>). El design system es la fuente de verdad visual y la sincronización va en un solo sentido: del design system a la app (`context/decisiones.md` UI-design-system).

| Fichero | Qué es |
|---|---|
| `tokens.json` | Copia literal de `project/tokens.json` del artifact. No se edita a mano |
| `VERSION` | Versión del artifact de la que sale la copia |

`pnpm ds:tokens` genera con ellos `src/app/theme.css`, el tema de Tailwind que importa `src/app/globals.css`. Un test (`scripts/design-system/theme.test.ts`) falla si el tema y la copia no cuadran.

## Cuándo se refresca

En el `propose` de una pantalla cuyo mock usa tokens que han cambiado en el design system. No hay descarga automática: el artifact es privado y solo se lee desde una sesión de Claude con la cuenta del autor.

## Cómo se refresca (en una sesión de Claude)

1. Leer `project/tokens.json` del artifact con la herramienta Artifact. La lectura guarda el fichero en local e indica la versión del artifact.
2. Copiarlo tal cual a `design-system/tokens.json` y escribir esa versión en `design-system/VERSION`.
3. Ejecutar `pnpm ds:tokens`. Si un token no tiene la forma esperada, el comando falla, nombra el token y no escribe nada: se corrige en el design system, no aquí.
4. Ejecutar `pnpm test:run scripts/design-system`.
5. Enseñar al autor el diff de `src/app/theme.css` antes del commit.

Los valores que el design system guarda fuera de `tokens.json` (curvas y duraciones de movimiento, escala al pulsar, tracking) están copiados a mano en `src/app/globals.css` con su versión. Si cambian en `components/bundle.css` del artifact, se actualizan allí.
