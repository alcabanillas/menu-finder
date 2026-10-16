# Proposal

## Why

The deployed app has no per-metric Core Web Vitals. Vercel Speed Insights on the Hobby plan shows only the Real Experience Score; LCP, INP, CLS, FCP, per-route and per-country data need Speed Insights Plus, which exists only on the Pro plan (seen on the Vercel dashboard on 2026-10-16). Sentry can show those four metrics from real browser sessions, but the archived spec `openspec/specs/error-reporting/spec.md` forbids it: Sentry starts "errors only", with no `tracesSampleRate` or `tracesSampler`, on the server and in the browser.

This change implements MF-67, **proposed here and not yet in `context/roadmap.md`**: the author confirms the item and its estimate (~2 h, under the 2 h split threshold of `AGENTS.md`) before `apply`.

## What Changes

- The browser SDK starts with tracing on at `tracesSampleRate` 1.0, so each page load and each navigation sends one Sentry transaction with LCP, INP, CLS, FCP and TTFB as measurements.
- The server SDK stays as it is: no `tracesSampleRate`, so no server transaction or span is sent (MF-40.5 and `context/decisiones.md` §1.2, OPS-observabilidad: Genkit spans carry the text of the request).
- `dataCollection` stays entirely off, from the one shared definition in `src/app/sentry-data-collection.ts`. A new check removes from each transaction the fields that could carry request data (see "Data touched").
- Tests that today assert "no traces in the browser" now assert the new rule. Tests that assert it on the server stay.
- Vercel Speed Insights is removed (`@vercel/speed-insights` and `<SpeedInsights />` in `src/app/layout.tsx`, PR #51). On Hobby it gives only the Real Experience Score, and Sentry now gives the metrics, so one third party receives performance data instead of two.
- **Contradiction with a decision, resolved by the author's choices below:** `context/decisiones.md` §1.2, OPS-observabilidad, says "sin trazas de rendimiento" and that Vercel Speed Insights "mide las Core Web Vitals de cada ruta". This change replaces both sentences (task 6.1).

## Decisions of the author (2026-10-16)

1. **Where tracing runs:** browser only. No server tracing, so no Genkit or database spans.
2. **Sample rate:** 1.0, every session. The app has few users, so the free quota is enough.
3. **Which transactions:** page loads and navigations.
4. **Speed Insights:** removed.

## Data touched

| Datum | Goes to Sentry today | With tracing |
|---|---|---|
| Error message, stack trace, route | Yes | Yes |
| Route of the page (`/planner`, `/menu`) | In errors | In every visit, as the transaction name |
| Full URL | In errors | In the transaction. Query parameters stay off (`urlQueryParams: false`) |
| Timings and Web Vitals | No | Yes: LCP, INP, CLS, FCP, TTFB, plus the SDK's own spans |
| Browser, OS, viewport | In errors | In every visit |
| Request text, chip terms, dish names | No | Must stay out: no span, breadcrumb or tag carries them |
| IP, cookies, headers, user | No | Must stay out (`dataCollection` off) |

Nutritionist data (SEG-datos-nutricionista) is not in the routes: `/planner`, `/menu`, `/shopping-list` and `/login` take no menu or recipe name in the path. Only `/menu` (`startsOn`) and `/shopping-list` (`vista`) read a query parameter, a date and a view name, checked in `src/app/(signed-in)/`. The planner search goes through a server action, not the URL.

## Possible abuses

- **The DSN is public by design.** Anyone can send fake transactions and use up the monthly quota. Tracing multiplies the volume per visitor. Mitigation: a sample rate, Allowed Domains and Spike Protection in Sentry (set by hand in MF-22.2), and the quota as the cap.
- **Trace headers.** Browser tracing adds `sentry-trace` and `baggage` headers to requests. The design decides which origins get them, so they stay on same-origin requests and never reach Gemini or any other third party.
- **Data creep.** A later change could add a span or tag with the request text. A test on the options of `Sentry.init` and on the transaction fields guards this.
- **CSP.** Transactions go to the same ingest host the CSP already allows in `connect-src` (MF-22.2). No new host and no wildcard.

## OWASP categories (`context/OWASP-Top10.md`)

- **A02:2025 - Configuración de seguridad incorrecta:** CSP `connect-src`, trace header propagation targets, Sentry options.
- **A09:2025 - Fallos de registro y alertas de seguridad:** what telemetry contains (`context/safety-first.md`, monitoring: no passwords, tokens, cookies or keys reach Sentry).
- **A10:2025 - Manejo incorrecto de condiciones excepcionales:** a Sentry failure or an ad blocker must not break the page.

## Decisions it relies on

- `context/decisiones.md` §1.2 OPS-observabilidad: errors only, `dataCollection` off, the CLI sends nothing. **This change contradicts its "sin trazas de rendimiento" clause for the browser** and its Speed Insights sentence (above).
- `context/decisiones.md` §1.8 SEG-datos-nutricionista and `context/safety-first.md` §2.6 (what the LLM flows may send).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `error-reporting`: "Errors only" becomes a rule for the server; "Browser errors reach Sentry" lets the browser send performance transactions, with the same data rules.

## Impact

- Code: `src/instrumentation-client.ts`, `src/instrumentation-client.test.ts`, `next.config.ts`, `src/app/layout.tsx` (Speed Insights removed); possibly `src/app/sentry-data-collection.ts` (a shared helper) and `src/app/content-security-policy.test.ts` (a check that `connect-src` is unchanged).
- Docs: `context/decisiones.md` §1.2 (OPS-observabilidad), `context/roadmap.md` (the MF-67 item), after the author decides.
- Dependencies: none new; `@vercel/speed-insights` is removed. `@sentry/nextjs` 11.6.0 already includes browser tracing.
- Systems: Sentry monthly quota (transactions count against it) and the Sentry dashboard Web Vitals page.
