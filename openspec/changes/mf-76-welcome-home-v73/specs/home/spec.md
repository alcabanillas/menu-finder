# Spec Delta

## MODIFIED Requirements

### Requirement: The informative home describes the product without data

Without a session, `/` SHALL show a page inside the shell's variant for a visitor that says what the product does and offers "Acceder" links to `/login`: a cover with the level-one heading and the first link, a sample search beside it, three features each with a sample piece of the app, and a closing block with the second link. The sample pieces SHALL be hidden from screen readers and SHALL hold no control. Their dishes SHALL be invented: the page SHALL NOT contain a dish of the catalogue, data of any user, the deployed version, nor any control to create an account or recover a password (SEG-sistema-cerrado).

#### Scenario: The visitor sees the description and the way in
- **WHEN** a visitor opens `/`
- **THEN** the page has the level-one heading "Planifica la semana sin darle vueltas", the text "Dile qué te apetece como se lo dirías a alguien de casa. Te enseña los menús de la nutricionista que encajan y el plato que lo demuestra.", the line "36 menús · recetas con tiempos · compra por categorías" and two links "Acceder" to `/login`

#### Scenario: Three features and a closing block
- **WHEN** a visitor opens `/`
- **THEN** the page has the level-two headings "La semana, de un vistazo", "Cada plato, con su receta", "La compra, por categorías" and "¿Qué os apetece esta semana?", in that order, and the sentence "Menu Finder no inventa menús ni recetas: solo encuentra y ordena los que ya existen."

#### Scenario: The sample pieces show the app
- **WHEN** a visitor opens `/`
- **THEN** the page shows the request "de cuchara, sin cerdo y con garbanzos" with the chips "de cuchara", "cerdo" and "garbanzos", the card "Menú 14" with the line "✓ cerdo · no aparece en la semana", six day cards from Monday to Saturday, an open recipe card with its ingredients and steps, and one shopping category with three items

#### Scenario: The sample pieces are not operable
- **WHEN** a visitor opens `/`
- **THEN** every sample piece is hidden from screen readers and out of the tab order, and the only links or buttons a screen reader or the keyboard reaches in the page's main content are the two "Acceder" links

#### Scenario: The cover beside the sample search from 800 px
- **WHEN** a visitor opens `/` in an 800 px container or wider
- **THEN** the sample search is to the right of the heading; below 800 px it is below the "Acceder" link

#### Scenario: The visitor reaches the sign-in
- **WHEN** a visitor opens `/` and follows "Acceder"
- **THEN** the browser is on `/login` with the sign-in form

#### Scenario: No data and no sign-up for the visitor
- **WHEN** `/` is requested with no valid session
- **THEN** the response contains no dish of the menus in the database, no email, no version and no control to create an account or recover a password

#### Scenario: The sample dishes are not from the catalogue
- **WHEN** the sample dishes of the home are compared with the dishes and recipes of the local catalogue
- **THEN** none of them matches a dish or a recipe title of the catalogue
