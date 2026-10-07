## MODIFIED Requirements

### Requirement: Protected routes require a session checked on the server

Every route other than `/` and `/login` SHALL be protected. A protected route SHALL check the session on the server before reading any data or rendering its content, and SHALL send a request with no valid session to `/login`. A missing cookie, an expired session, a revoked session and a modified or foreign-signed cookie SHALL all count as no valid session (MF-20.1). `/planner` is the protected route of this change.

#### Scenario: No session cookie
- **WHEN** a request for `/planner` carries no session cookie
- **THEN** the response is a redirect to `/login`, and the body of `/planner` is not in the response

#### Scenario: A forged cookie
- **WHEN** a request for `/planner` carries a session cookie with a made-up or modified value
- **THEN** the response is a redirect to `/login`

#### Scenario: A signed-out cookie
- **WHEN** a request for `/planner` carries the cookie of a session that was signed out
- **THEN** the response is a redirect to `/login`

#### Scenario: A valid session
- **WHEN** a request for `/planner` carries the cookie of a valid session
- **THEN** the page renders inside the app shell and shows the name of the signed-in user, and the sign-out control is in the account menu of the shell
