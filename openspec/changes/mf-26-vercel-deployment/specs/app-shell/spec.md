## ADDED Requirements

### Requirement: The account menu shows the deployed version

The panel of the account menu SHALL show the version the running application was built from, as "Versión v<version>", where `<version>` is the version declared by the project (for example "Versión v0.1.0"). The version SHALL reach the browser only inside responses for a user with a session: a response without a valid session SHALL NOT contain it, and no public script bundle SHALL contain it.

#### Scenario: The menu shows the version
- **WHEN** a signed-in user opens the account menu of an application whose declared version is `0.1.0`
- **THEN** the panel shows "Versión v0.1.0"

#### Scenario: A visitor does not get the version
- **WHEN** a request without a valid session asks for `/` or `/login`
- **THEN** the response body does not contain the version
