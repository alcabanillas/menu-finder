# menu-finder

Buscador en lenguaje natural sobre 36 menús semanales, con la lista de la compra como checklist. Trabajo Fin de Máster en Desarrollo con IA.

La IA extrae, estructura y recupera información existente: no genera menús ni recetas.

## Documentación

Empieza por [`AGENTS.md`](AGENTS.md), que es el mapa de lectura. La referencia normativa es [`context/decisiones.md`](context/decisiones.md); el alcance, [`context/producto.md`](context/producto.md).

## Desarrollo

```bash
pnpm install
pnpm dev
```

Los datos no están en el repositorio. Se generan en local siguiendo [T0](context/tareas/T0-extraccion-previa.md).

## Datos

Los datos (36 menús semanales, listas de la compra y recetas) fueron elaborados por un nutricionista profesional para el autor y se usan con fines exclusivamente educativos y personales. No se redistribuyen: no forman parte del repositorio ni de ningún entregable público.
