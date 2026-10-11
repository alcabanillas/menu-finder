## Purpose

Ensures every HTTP response served by the web application includes mandatory HTTP security headers to protect against framing, clickjacking, MIME sniffing, cross-site scripting (XSS), and unauthorized browser feature access.

## ADDED Requirements

### Requirement: Nonce-based Content-Security-Policy on pages
The web application SHALL attach a restrictive `Content-Security-Policy` header to every page response, with a nonce generated for each request. API routes, static assets and `next/link` prefetches do not receive it.

#### Scenario: CSP header present on page responses
- **WHEN** a page is requested
- **THEN** the response headers include `Content-Security-Policy` with `default-src 'self'` and `frame-ancestors 'none'`

#### Scenario: Scripts allowed only by nonce
- **WHEN** a page is requested
- **THEN** the `script-src` directive contains `'nonce-<value>'` and `'strict-dynamic'`, and does not contain `'unsafe-inline'`

#### Scenario: A fresh nonce on every request
- **WHEN** the same page is requested twice
- **THEN** the two responses carry different nonce values

#### Scenario: Production CSP does not allow eval
- **WHEN** the policy is built with `NODE_ENV` set to `production`
- **THEN** the `script-src` directive does not contain `'unsafe-eval'`

#### Scenario: Development CSP allows eval
- **WHEN** the policy is built with `NODE_ENV` set to `development`
- **THEN** the `script-src` directive contains `'unsafe-eval'`

### Requirement: Content type sniffing protection
The web application SHALL instruct browsers not to override or sniff content types.

#### Scenario: Nosniff header present
- **WHEN** an HTTP response is served
- **THEN** response headers include `X-Content-Type-Options` with value `nosniff`

### Requirement: Framing and clickjacking prevention
The web application SHALL forbid framing on all pages.

#### Scenario: Framing denied
- **WHEN** an HTTP response is served
- **THEN** response headers include `X-Frame-Options` with value `DENY`

### Requirement: Referrer policy enforcement
The web application SHALL attach a strict referrer policy to prevent leaking path data on cross-origin requests.

#### Scenario: Strict referrer policy present
- **WHEN** an HTTP response is served
- **THEN** response headers include `Referrer-Policy` with value `strict-origin-when-cross-origin`

### Requirement: Browser permissions policy
The web application SHALL disable unused browser features and hardware APIs.

#### Scenario: Unused hardware APIs disabled
- **WHEN** an HTTP response is served
- **THEN** response headers include `Permissions-Policy` disabling `camera=()`, `microphone=()`, and `geolocation=()`

### Requirement: No framework disclosure
The web application SHALL NOT announce the framework it runs on in its response headers.

#### Scenario: No X-Powered-By header
- **WHEN** an HTTP response is served
- **THEN** the response headers do not include `X-Powered-By`

### Requirement: Fixed headers on every kind of route
The web application SHALL attach `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` to pages, API routes and static assets alike.

#### Scenario: API routes and static assets receive the fixed headers
- **WHEN** an API route or a static asset is requested
- **THEN** the response headers include the four fixed headers with the same values as a page response
