# Despliegue a producción

Cómo se publica una versión de la app en `https://menu-finder-mbs.vercel.app`. La decisión está en `context/decisiones.md` (OPS-ci-cd) y su porqué, en `openspec/changes/archive/2026-10-11-mf-26-vercel-deployment/design.md` (D3 a D7).

## Idea en una frase

Hacer merge a `main` **no** despliega. Para publicar, el autor etiqueta un commit de `main` con su versión y mueve la rama `production` a él. Vercel construye ese commit y solo lo publica cuando tres checks de GitHub están en verde.

```
PR ──merge──▶ main ──(ci.yml: checks, e2e)──▶ commit verde
                                                  │
                         pnpm release  ◀──────────┘
                         (tag vX.Y.Z y push a production)
                                                  │
              Vercel construye ◀──────────────────┤
                                                  ▼
                              release.yml: release (tag y main)
                                                  │
        Deployment Checks: checks ✓ e2e ✓ release ✓ ──▶ dominio de producción
```

## Quién hace qué

| Pieza | Dónde | Qué hace |
|---|---|---|
| `ci.yml` | GitHub Actions, en PR y en push a `main` | `checks` (lint, typecheck, tests con cobertura) y `e2e` (Playwright) |
| `pnpm release` | Tu máquina | Comprueba el último commit de `main`, lo etiqueta y mueve `production` |
| `release.yml` | GitHub Actions, solo en push a `production` | `release`: falla si el commit no está en `main` o si el tag `v<version de package.json>` no apunta a él |
| Production Branch | Vercel → Settings → Environments → Production → Branch Tracking | `production`: la única rama que Vercel publica |
| `vercel.json` | Repo | `"**": false, "production": true`: ninguna otra rama despliega, ni como preview. Funciones en `fra1` |
| Deployment Checks | Vercel → Settings → Build and Deployment | Retienen la publicación hasta que `checks`, `e2e` y `release` pasan en el commit |
| Variables de entorno | Vercel → Settings → Environment Variables, solo Production | `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY`, `LLM_DAILY_LIMIT` (opcional) |

Vercel asocia los checks al commit y al nombre del job. Por eso cada check corre **una sola vez por commit**: `checks` y `e2e` en `main`, y `release` en `production`. Si un mismo commit tuviera dos resultados de un job, Vercel podría usar el que no toca.

## Publicar una versión

1. **Sube la versión.** En una PR, cambia `"version"` en `package.json` (por ejemplo, de `0.1.0` a `0.2.0`) y haz merge.
2. **Si la versión trae migraciones**, aplícalas antes en la rama `production` de Neon (`pnpm ingest migrate`; ver OPS-ramas-bd en `context/decisiones.md`).
3. **Publica:**
   ```bash
   pnpm release
   ```
   El script (`scripts/release/`) publica el último commit de `main`. Antes de tocar nada comprueba que:
   - el tag `v<versión de package.json>` no existe, es decir, que subiste la versión;
   - `checks` y `e2e` pasaron en ese commit: ni faltan ni siguen corriendo;
   - `production` no tiene commits que no estén en `main`.

   Si algo falla, lo dice y no publica. Si cambió algo en `postgres/migrations/` desde la versión anterior, te lo lista y pregunta si ya está aplicado. Después pide confirmación, crea el tag, lo sube y mueve `production`. Necesita `gh` con sesión iniciada.
4. **Comprueba en Vercel** que el deployment aparece como retenido hasta que `release` pasa, y que después se publica.
5. **Comprueba la web:**
   - Cabeceras: `curl -sI https://menu-finder-mbs.vercel.app/login` debe mostrar `Content-Security-Policy` con `nonce-…`, `X-Frame-Options: DENY` y `X-Content-Type-Options: nosniff`, y no `X-Powered-By`.
   - Versión: entra, **recarga** la página y abre el menú de cuenta: debe decir "Versión v0.2.0". Una pestaña abierta antes del despliegue sigue con el código anterior hasta que se recarga.

## Si algo falla

| Síntoma | Causa | Qué hacer |
|---|---|---|
| `release` falla con "The commit is not tagged" | El tag no existe, apunta a otro commit o no coincide con `package.json` | Crea el tag correcto sobre ese commit y vuelve a lanzar `release.yml` desde Actions |
| `release` falla en "Check that the commit is in main" | Se movió `production` a un commit que no está en `main` | Mueve `production` a un commit de `main`. Nunca se hace commit directamente en `production` |
| `pnpm release` dice que `checks` o `e2e` no han corrido | El CI de ese commit en `main` se canceló porque entró otro merge detrás (`cancel-in-progress`) | Relanza el CI cancelado desde Actions, o espera al del merge siguiente |
| `pnpm release` dice que el tag ya existe | No subiste la versión de `package.json` | Súbela en una PR y vuelve a lanzar `pnpm release` |
| El build de Vercel falla | Error de build o de configuración del proyecto (Node.js 24) | Arréglalo en una PR. Lo publicado sigue sirviéndose |
| La versión publicada tiene un fallo grave | — | Vercel → proyecto → **Instant Rollback** al deployment anterior. Después, Vercel deja de publicar los push a `production` hasta que pulses **Undo Rollback**. Arregla en una PR y publica una versión nueva |

No uses **Force Promote** en Vercel: se salta los Deployment Checks.

## Configuración inicial (ya hecha, MF-26)

- Proyecto `menu-finder-mbs` conectado al repo con Vercel for GitHub.
- Production Branch `production`, Node.js 24, auto-assign de dominios de producción activado.
- Deployment Checks: `checks`, `e2e` y `release`.
- Sin CLI ni token de Vercel en GitHub: los secretos `VERCEL_*` están borrados. En GitHub solo queda `DATABASE_URL_TEST` (BD `ci` de Neon).
