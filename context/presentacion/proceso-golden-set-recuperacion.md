# Cómo se hizo la plantilla para evaluar el buscador

> **Tipo:** material para las diapositivas y el vídeo, en palabras sencillas. Cuenta el **proceso** de MF-12 (2026-09-28), con lo que funcionó y lo que no. Lo normativo está en EVAL-golden-sets (`decisiones.md`) y en la spec `retrieval-golden-set`. El argumento académico, en [enfoque-academico.md](../enfoque-academico.md) §5.

---

## 1. Para qué sirve

El proyecto va a comparar tres formas de buscar menús: por palabras, por significado y una mezcla de las dos. Para saber cuál es mejor hace falta un **examen con las respuestas correctas**: una lista de preguntas de prueba y, para cada una, qué menús son buenas respuestas.

Eso es la plantilla (en la jerga, *golden set*). Se hizo **antes** de construir el buscador, a propósito: si se hace después, sin querer se acaba haciendo a medida de lo que el buscador ya sabe hacer.

Cada menú recibe una nota por pregunta: **2** muy buena respuesta, **1** a medias, **0** no sirve.

## 2. Paso 1: las preguntas

El autor no recordaba el contenido de los 36 menús ni tenía tiempo de inventar 40 preguntas variadas. Así que se le pidió a **otra IA, en una conversación aparte y sin ver los menús**, que generara preguntas como las haría una persona. El autor las filtró y editó, y añadió tres suyas.

Que la IA no viera los menús es importante: así las preguntas no están elegidas para que salgan bien.

Se agruparon en **cinco tipos**:

| Tipo | Ejemplo |
|---|---|
| Palabra concreta | «salmón», «garbanzos» |
| Exclusión | «sin cerdo», «vegetariano» |
| Característica | «cenas rápidas», «para el invierno» |
| Idea vaga | «de cuchara», «algo fresquito» |
| Combinada | «pollo y brócoli sin pescado» |

Algunas se descartaron por sentido común. Por ejemplo, «comida contundente»: todos los menús son de nutricionista y ninguno es contundente.

## 3. Paso 2: un primer intento que no funcionó

La primera idea fue pedirle a una IA (Claude Haiku) que leyera los 36 menús y pusiera la nota de cada pregunta directamente. **Falló:** al principio se negó, luego se saltó 27 de las 39 preguntas, y para «marisco» dio los 36 menús por buenos.

Conclusión: juzgar una semana entera de golpe es demasiado para la IA. Hay que partir el problema.

## 4. Paso 3: juzgar platos, no menús

En lugar de preguntar «¿este menú es de cuchara?», se preguntó **plato a plato**: «¿este plato es de cuchara?». Son ~430 platos distintos, y cada uno se juzga **una sola vez**, aunque aparezca en varios menús.

- **La IA propuso las listas:** qué platos son de cuchara, ligeros, para niños, de invierno...
- **El autor revisó cada lista entera** y tachó lo que no encajaba. Tachó 9 de unos 460 (por ejemplo, «Dorada al horno» no es tan «ligera» como parecía). Es decir, la IA acertó en torno al 98 %.
- **Los ingredientes se agruparon** igual: qué ingredientes son pollo, cerdo, pescado, queso... para las exclusiones.

Después, unas **reglas fijas** calculan la nota de cada menú a partir de sus platos. Ventaja: el mismo plato cuenta igual en todas las semanas, y el resultado no depende del humor de nadie.

## 5. Paso 4: las preguntas de palabra concreta

Para «salmón» o «garbanzos» no hizo falta la IA. Un pequeño programa buscó los platos que contenían la palabra, **a propósito con manga ancha**: «salmón» también encontraba «Salmonete».

Después, **el autor revisó cada candidato** y descartó los falsos: «salmonete no es salmón». También aceptó casos que una búsqueda por palabras no vería, como unas sardinas enlatadas para «sardinas en lata».

Esto es clave: **si la plantilla se hubiera hecho con el mismo método que el buscador por palabras, ese buscador sacaría siempre un 10.** Sería corregir un examen con las respuestas del propio alumno. La red ancha más la criba humana lo evita.

## 6. Paso 5: las reglas para poner nota

Tres ideas, en palabras sencillas:

- **«y» no es lo mismo que «con».** «Pollo y arroz» vale con que la semana tenga algún plato con pollo y alguno con arroz. «Pollo con arroz» exige que sea el mismo plato.
- **Cuando no hay respuesta perfecta, se premia acercarse.** Ningún menú está libre de pescado, así que para «sin pescado» nadie sacaría nota. En su lugar, el **cuarto de menús con menos pescado** saca un 2, la siguiente cuarta parte un 1 y el resto un 0. Es lo que querría el usuario: no «no hay resultados», sino «lo mejor que hay».
- **Tres niveles, no porcentajes.** Un menú con 25 % de pescado y otro con 27 % se tratan igual. Esa pequeña diferencia puede venir de una sola etiqueta mal puesta, y no debe decidir la evaluación. El informe sí muestra el porcentaje, para poder revisar cada nota a ojo.

## 7. Paso 6: quitar las preguntas que no sirven

Una pregunta que no distingue entre menús no sirve para medir. Se retiraron las que:

- **Casi todos aprueban.** «Pollo y arroz»: 31 de 36 menús con la nota máxima. «Huevos» aparece en los 36.
- **Nadie aprueba.** «Tortilla de patatas»: ningún plato la tiene.
- **No tienen sentido con estos datos.** «Para cenar»: todos los menús tienen cenas.

No se borran: quedan anotadas con el motivo, para contarlo.

Quedan **43 preguntas**: palabra concreta 10, exclusión 7, característica 9, idea vaga 8 y combinada 9.

## 8. Paso 7: dejarlo automático y repetible

Todo lo anterior se hizo primero a mano, con programas de usar y tirar. Al final se convirtió en dos programas limpios:

1. Uno **propone los candidatos** de las preguntas de palabra concreta, para que el autor los revise.
2. Otro **junta todo** (preguntas, etiquetas revisadas y reglas) y escribe la plantilla.

Con los mismos datos, el segundo da **siempre exactamente el mismo resultado**. Si mañana se corrige una etiqueta, se vuelve a ejecutar y todas las notas afectadas se recalculan solas.

Antes de escribir, el programa se comprueba a sí mismo: que cada pregunta tiene una nota por menú y que en el fichero que se sube al repositorio **no aparece qué platos lleva cada menú**, porque los menús son del nutricionista y no se publican.

## 9. Qué hizo la IA y qué hizo el autor

| Tarea | IA | Autor |
|---|---|---|
| Inventar las preguntas | Las generó, sin ver los datos | Filtró, editó y añadió tres |
| Juzgar menús enteros | Lo intentó y falló | Detectó el fallo y cambió de enfoque |
| Etiquetar platos | Propuso las listas | Revisó cada lista y tachó los errores |
| Palabras concretas | — (un programa sencillo buscó candidatos) | Decidió cada candidato |
| Reglas de nota | Propuso las reglas | Las discutió y aprobó |
| Programas finales | Los escribió | Los revisó y los ejecutó |

La idea de fondo: **la IA propone, la persona decide.** Y la IA funciona bien en tareas pequeñas y concretas (un plato), no en juicios grandes (una semana entera).

## 10. Limitaciones, dichas claramente

- **Es una muestra, no todas las preguntas posibles.** Lo que se generaliza no son las 43 frases, sino el resultado por tipo de pregunta.
- **Unas 8 preguntas por tipo** dan tendencias, no certezas.
- **La revisión encuentra errores de lo que la IA etiquetó, pero no lo que se dejó sin etiquetar.** Ejemplo real: «Puré de patata» no está marcado como «de cuchara», y nadie lo vio porque no estaba en la lista.

## 11. Lo que se aprendió de los menús

Los ingredientes comunes están en casi todas las semanas: «pollo y arroz» no distingue nada. Lo que diferencia una semana de otra son **los platos concretos**: «pollo con arroz» (el mismo plato) solo lo cumplen 7 menús de 36. Coincide con lo medido antes en el análisis del corpus (T1), y justifica que el buscador tenga que entender la diferencia entre «y» y «con».

## 12. Por qué esto protege al proyecto

**Qué está decidido y qué no.** Cada tipo de pregunta tiene ya un mecanismo de partida (BUS-superficie-consulta (d)):
- las palabras concretas se buscan por texto;
- las exclusiones, con la tabla de grupos de ingredientes;
- las ideas vagas («de cuchara»), por significado, con *embeddings*.

Lo que **no** está decidido es si la búsqueda por significado se gana su sitio. Eso lo decide la evaluación con esta plantilla (MF-18), no la intuición ni la moda.

**Cualquier resultado es un resultado:**
- Si la búsqueda por significado gana en las ideas vagas, queda justificado usarla.
- Si gana la búsqueda por palabras, es igual de válido: se demuestra que en este dataset no hacía falta, y se quita (enfoque-académico §2).
- Lo más probable es que cada tipo de pregunta tenga su ganador. Esa es la respuesta interesante: un buscador que usa cada mecanismo donde funciona.

**Lo único que haría fallar el proyecto** es lo contrario: elegir el buscador por intuición y no poder demostrar que funciona. La plantilla existe para que eso no pase.
