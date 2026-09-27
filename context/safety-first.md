# Safety First — Especificación de seguridad para agentes de IA

> **Ámbito:** este documento aplica a cualquier agente de IA (Claude Code u otro) que genere, modifique o revise código en este proyecto — frontend, backend, base de datos, infraestructura o scripts.
> **Estado:** normativo. Un agente que proponga una implementación que viole una regla `DEBE` sin justificar y documentar la excepción está incumpliendo esta especificación.

## Cómo leer este documento

- **DEBE / NO DEBE** = obligatorio. No es negociable salvo excepción documentada explícitamente en el código o PR (con motivo y mitigación).
- **DEBERÍA** = fuertemente recomendado; desviarse requiere justificación razonable en el PR o commit.
- **PUEDE** = opcional, a criterio del agente/equipo.

Objetivo: construir algo que **resista** ataques y fallos, no solo algo que funcione en el caso feliz.

---

## 1. Principios rectores

| # | Principio | Regla |
|---|-----------|-------|
| P1 | Security by Design | La seguridad DEBE considerarse en requisitos, historias de usuario y criterios de "Done", no añadirse al final. |
| P2 | Security by Default | Toda configuración DEBE partir del estado más restrictivo (fail-safe default): denegar salvo permiso explícito. |
| P3 | Anticipar fallos | El sistema DEBE asumir que algo fallará: backups cifrados, capacidad de restauración, monitorización de errores. |
| P4 | Mínimo privilegio | Cada servicio, proceso, usuario, clave de API o rol de BD DEBE tener solo los permisos que necesita, ni uno más. |
| P5 | Separación de responsabilidades | Las decisiones y validaciones críticas DEBEN residir en el backend. El cliente muestra, no decide. |
| P6 | Defensa en profundidad | NO DEBE existir un único control de seguridad del que dependa todo (auth + validación + cifrado + logging, en capas). |
| P7 | Auditabilidad por diseño | Toda acción sensible (login, cambio de datos, denegación de acceso) DEBE generar un log que permita reconstruir qué pasó, cuándo y quién. |
| P8 | Frameworks probados | Se DEBE usar librerías/frameworks maduros para auth, validación y cifrado. NO reinventar criptografía o mecanismos de sesión propios. |

---

## 2. Reglas por componente

### 2.1 Frontend

- NO DEBE almacenar tokens de sesión persistentes en `localStorage` (usar cookies `httpOnly`, `Secure`, `SameSite` gestionadas por el backend, o almacenamiento en memoria).
- NO DEBE realizar validaciones de seguridad o de negocio como única barrera (roles, permisos, límites de cuota): son UX, no control de acceso. La validación real DEBE repetirse en el backend.
- DEBE manejar la mínima cantidad de datos sensibles posible en el cliente (evitar guardar PII, tokens o claves en el estado de la app o en el bundle).
- DEBE mostrar solo los datos que el backend decide exponer; NO DEBE filtrar internamente en el cliente datos que el servidor no debería haber enviado.
- Cualquier input de usuario que se renderice DEBE pasar por el escapado/sanitización del framework (evitar XSS vía `dangerouslySetInnerHTML`/`innerHTML` sin sanitizar). Lo mismo vale para la salida del LLM (§2.6).
- NO DEBE usarse `eval`, `new Function` ni ejecución de comandos (`exec`, `child_process` con shell) sobre datos externos, en la app ni en el CLI de ingesta.

### 2.2 Backend / API

- DEBE tratar toda solicitud entrante como no confiable: validar, autenticar y autorizar antes de procesar, incluso si "el cliente ya validó".
- DEBE implementar autenticación y autorización en **cada** endpoint, incluidos los internos o "solo llamados desde el frontend propio".
- Cada endpoint DEBE tener un contrato explícito: qué datos expone, a quién (qué rol/scope) y bajo qué condiciones (rate limit, cuota).
- Las respuestas DEBEN devolver solo los campos necesarios (no serializar el modelo completo de BD "por comodidad").
- Hay **un solo rol** (SEG-roles): toda ruta y endpoint que devuelva datos DEBE exigir sesión válida en el backend; sin sesión solo son accesibles el login y la home informativa (UI-home-sin-login), que no muestra datos del catálogo. NO DEBE existir ningún endpoint de administración ni de debug en la app (OPS-observabilidad).
- El usuario sobre el que se opera DEBE salir de la sesión, nunca de un parámetro de la petición (`userId` en query, body o ruta). Un registrado solo accede a sus propios datos (p. ej. su historial de selecciones); un id ajeno se trata como denegación, no como filtro.
- Los inputs DEBEN normalizarse (Unicode NFC, espacios) y después validarse por tipo, rango, longitud y formato con un validador de esquema, no con checks ad-hoc dispersos.
- El login DEBE limitar los intentos fallidos y responder lo mismo si el usuario no existe que si la contraseña es incorrecta. Las contraseñas las guarda la librería de autenticación con un hash adaptativo (Argon2id, scrypt o bcrypt); no DEBE haber hash propio.
- Las contraseñas las genera el CLI al crear la cuenta, aleatorias y de al menos 20 caracteres; así no pueden estar en listas de contraseñas filtradas. Si algún día el usuario elige la suya, DEBE comprobarse contra esas listas.
- Al iniciar sesión DEBE emitirse un identificador de sesión nuevo (contra la fijación de sesión). Si la sesión usa JWT, DEBE verificarse la firma con un algoritmo fijado en el servidor, nunca el que declare el token, y rechazar `alg=none`.
- Las sesiones DEBEN caducar y poder revocarse desde el servidor: desactivar una cuenta (p. ej. la de demo tras la evaluación) o cambiar su contraseña DEBE invalidar sus sesiones activas. Un JWT sin estado no se revoca hasta que caduca, así que la sesión DEBE guardarse en BD o la cuenta comprobarse como activa en cada petición.
- Toda llamada al LLM DEBE pasar por los límites de SEG-rate-limit: por usuario y un tope global diario. Superarlos responde `429` y NO DEBE llegar al proveedor. Los contadores viven en la BD, no en memoria de la instancia.
- Los secretos (API keys, credenciales de BD, claves JWT) NO DEBEN estar hardcodeados ni commiteados; DEBEN venir de variables de entorno o un gestor de secretos.

### 2.3 Base de datos

- Solo el servidor de la app (y el CLI de ingesta) se conecta a la BD; NO DEBE ser accesible desde el frontend. En el plan gratuito de un proveedor gestionado el endpoint de la BD es alcanzable desde internet (la app corre en Vercel sin IPs fijas), así que la barrera son las credenciales: conexión solo con TLS, credenciales fuertes fuera del repo y ninguna API automática sobre las tablas (§2.4). Una red privada entre app y BD no está al alcance del plan gratuito; es riesgo residual asumido.
- La conexión a la BD DEBE usar `sslmode=verify-full` (valida certificado y nombre de host, recomendado por Neon contra ataques de intermediario). NO DEBE desactivarse la verificación del certificado (`rejectUnauthorized: false` o equivalente) para resolver un error de conexión.
- Los datos sensibles (credenciales, PII, tokens) DEBEN cifrarse en reposo.
- El acceso DEBE controlarse con precisión: un servicio solo tiene el rol/permisos mínimos sobre las tablas que usa (evitar un único usuario de BD "admin" compartido por todos los servicios).
- Toda consulta DEBE protegerse contra inyección: usar queries parametrizadas u ORM; NO concatenar input de usuario en SQL/consultas.
- Los backups DEBEN estar cifrados y su generación/restauración DEBE monitorizarse.

### 2.4 Plataforma y despliegue

Se revisa al montar el entorno y antes de cada despliegue a producción, no en cada cambio de código.

- La BD (Neon, ARQ-modelo-datos) solo se consulta desde el servidor de la app, por conexión directa. La Data API de Neon (API REST automática sobre las tablas) NO DEBE activarse. Como segunda barrera, toda tabla DEBE tener RLS activado; sin políticas, RLS deniega el acceso a los roles de esa API si alguien la activa por error.
- La clave o el rol de administración de la BD (el propietario de la BD en Neon) NO DEBE llegar al cliente ni usarse en la app en ejecución. La app usa un rol propio con los permisos de §2.3; el rol de administración solo lo usa el CLI de ingesta y las migraciones.
- La cuenta de demo (SEG-sistema-cerrado) es una credencial en producción: DEBE tener contraseña fuerte fuera del repo y desactivarse o rotarse tras la defensa. Sus credenciales se entregan al tutor por un canal privado (plataforma de entrega o correo), NUNCA en la memoria, el README ni el repo: quien las lea tiene acceso a las recetas (SEG-datos-nutricionista). No DEBE existir ninguna otra cuenta por defecto.
- El repo DEBE tener activado el escaneo de secretos con push protection de GitHub. Si se filtra un secreto, se rota; borrarlo del historial no basta.
- Los despliegues de preview de Vercel DEBEN tener la protección de acceso activada y NO DEBEN usar la BD de producción: cada preview usa su rama de Neon.
- La app DEBE servir cabeceras de seguridad: CSP restrictiva, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'` (o `X-Frame-Options: DENY`) y `Referrer-Policy`. Se configuran en `next.config` o en el middleware y se comprueban en el despliegue.
- La clave de Gemini (IA-proveedor) DEBE estar restringida a la API de Gemini y con alerta de gasto en Google Cloud. Es la barrera si la clave se filtra y se usa fuera de la app, donde SEG-rate-limit no llega. Las alertas avisan, no cortan: ante un aviso, se rota la clave.
- Los workflows de GitHub Actions DEBEN declarar `permissions:` mínimos; los tokens de Vercel y de la BD usados en CI DEBEN estar acotados al proyecto y guardarse como secretos del repo.

### 2.5 Dependencias (cadena de suministro)

Desarrolla OWASP A03 para este stack. `pnpm audit` y Dependabot solo detectan vulnerabilidades conocidas (CVEs), no paquetes maliciosos.

- CI DEBE instalar con `pnpm install --frozen-lockfile` (OPS-paquetes): falla si el lockfile no cuadra con `package.json`, y nunca resuelve versiones nuevas.
- Antes de añadir una dependencia, el agente DEBE comprobar que existe en npm, que es el paquete que se pretende y que está mantenido. Un nombre sugerido por un modelo puede no existir o estar registrado por un atacante (*slopsquatting*).
- Dependabot DEBE configurarse con un periodo de espera (`cooldown`) de al menos 7 días para actualizaciones de versión. Las versiones maliciosas suelen retirarse en horas o días; las actualizaciones de seguridad quedan fuera de la espera.
- CI DEBERÍA escanear las dependencias contra bases de paquetes maliciosos, además de CVEs (p. ej. OSV-Scanner, que incluye los avisos `MAL-` de OpenSSF).
- Los scripts de instalación DEBEN seguir desactivados. pnpm 10 no los ejecuta por defecto; habilitar uno (`onlyBuiltDependencies` en `pnpm-workspace.yaml`) exige justificarlo en el PR.
- CI PUEDE generar un SBOM (CycloneDX o SPDX) como artefacto de cada build.


### 2.6 LLM (descomponedor y explicador)

El prompt es un intérprete más: aquí la inyección entra por el texto del buscador (directa) y por el texto de las recetas que llega al explicador (indirecta).

- El LLM NO DEBE generar consultas, HTML ni decisiones de permisos. El descomponedor devuelve una estructura tipada, Zod la valida y el SQL se construye desde ella (BUS-superficie-consulta (f)). Una salida que no valida se rechaza; no se repara a mano.
- La petición del usuario y el texto de las recetas DEBEN ir en el prompt como datos delimitados, nunca como instrucciones. Los delimitadores ayudan, pero no bastan: la barrera real es el esquema.
- La explicación del LLM DEBE mostrarse como texto. Si se renderiza Markdown, sin HTML crudo ni enlaces o imágenes externas.
- NO DEBEN insertarse secretos ni datos de otros usuarios en el prompt.
- Cada llamada DEBE tener límite de tamaño de entrada, timeout y pasar por SEG-rate-limit.

---

## 3. Prácticas en el ciclo de vida

- **Threat modeling continuo:** cada feature nueva (no solo la app entera) DEBE evaluarse: ¿qué puede salir mal aquí? ¿qué datos toca? ¿quién puede abusar de esto?
- **Requisitos con seguridad explícita:** una historia de usuario o requisito DEBERÍA indicar riesgos asociados y controles mínimos, no solo el comportamiento feliz.
- **Entorno de despliegue desde el día uno:** un agente que proponga código DEBE considerar dónde correrá (variables de entorno, CORS, HTTPS, exposición de puertos), no solo que compile en local.
- **Monitorización:** errores, accesos anómalos y fallos de auth DEBERÍAN quedar registrados y ser observables. DEBERÍA haber una alerta (Sentry) ante picos de logins fallidos o de respuestas `429` de SEG-rate-limit. Lo que se envía a Sentry NO DEBE incluir contraseñas, tokens, cookies ni claves; el contenido de las trazas de los flujos LLM se fija en FdV §6.4.
- **Verificación activa:** DEBERÍA haber tests automatizados de los casos de seguridad relevantes (auth, autorización, validación de input) además de confiar en el framework; análisis de dependencias y revisión de código son parte del proceso, no un extra.
- **Autorización verificada en CI:** los tests negativos de autorización DEBEN ejecutarse en CI y bloquear el merge si fallan. Como mínimo: petición sin sesión y usuario contra datos de otro usuario.

---

## 4. Checklist rápida para un agente antes de dar por cerrado un cambio

Antes de considerar terminada una tarea que toque código de producto, el agente DEBE poder responder "sí" a:

- [ ] ¿Toda decisión de negocio/seguridad crítica vive en el backend?
- [ ] ¿Cada endpoint nuevo valida auth, permisos y forma de los datos de entrada?
- [ ] ¿El usuario y sus permisos salen de la sesión, no de parámetros enviados por el cliente?
- [ ] ¿Cada endpoint nuevo tiene sus tests negativos de autorización y corren en CI?
- [ ] ¿Los datos devueltos son el mínimo necesario, no el modelo completo?
- [ ] ¿Ningún secreto quedó hardcodeado o en el diff a commitear?
- [ ] ¿Cada dependencia nueva existe en npm, es la que se pretendía, está mantenida y está justificada (§2.5)?
- [ ] ¿Las queries a BD están parametrizadas (sin concatenación de strings)?
- [ ] ¿Cada entrada nueva tiene tests con valores inesperados (vacíos, enormes, Unicode raro, metacaracteres) y, si llega al LLM, con intentos de prompt injection?
- [ ] ¿Una acción sensible introducida (login, denegación de acceso) queda registrada en logs con quién, qué y cuándo? Quién = id de usuario, no email.
- [ ] Si algo se desvía de una regla DEBE de este documento, ¿está justificado y documentado en el PR/commit?

---

## 5. Cultura

Todo agente (humano o IA) que escriba código en este proyecto DEBE pensar en seguridad al escribirlo: anticipar cómo se podría abusar de la función (mentalidad de atacante), construir el control correspondiente (mentalidad de ingeniero) y encajarlo de forma coherente en la arquitectura existente (mentalidad de arquitecto). Seguir este documento es condición necesaria, no suficiente: ante un caso no cubierto aquí, aplicar los principios de la sección 1.
